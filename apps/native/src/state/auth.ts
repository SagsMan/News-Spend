import * as Sentry from "@sentry/react-native";
import { proxy, subscribe } from "valtio";

import { authClient } from "#/lib/authClient";
import { queryClient } from "#/lib/tanstackQuery";
import { storage } from "#/utils/storage";

import { routeState } from "./route-state";

const initialAuthState = {
  session: null,
  user: null,
  status: "idle" as "idle" | "signIn" | "signOut",
  isHydrating: false,
};

const storedAuthState = JSON.parse(
  storage.getString("AUTH_STATE") ?? JSON.stringify(initialAuthState)
);

/**
 * A persisted session is enough to render with.
 *
 * Starting as `idle` meant the splash stayed up until a network round trip to
 * the session endpoint came back — on every cold start, before a single pixel
 * of app UI. On a slow connection that is seconds of blank screen spent
 * re-confirming something MMKV already told us synchronously.
 *
 * So the persisted session is trusted for the first frame and verified in the
 * background by `hydrateAuth`. The tradeoff is deliberate: a session revoked
 * server-side shows a moment of signed-in UI before hydration corrects it.
 * That is strictly better than every honest launch paying the latency, and the
 * screens themselves still gate on real API responses — a stale cookie renders
 * a shell, never someone else's data.
 *
 * With no persisted user we start `signOut`, which is not a guess: no session
 * is no session.
 */
const restoredStatus: "signIn" | "signOut" = storedAuthState?.session?.user
  ? "signIn"
  : "signOut";

export const authState = proxy<{
  session: typeof authClient.$Infer.Session | null;
  user: (typeof authClient.$Infer.Session)["user"] | null;
  status: "idle" | "signIn" | "signOut";
  isHydrating: boolean;
}>({
  ...storedAuthState,
  status: restoredStatus,
  isHydrating: false,
});

// Helper getters
export const isLoggedIn = () => authState.session?.user !== null;
export const isAnonymous = () => authState.user?.isAnonymous === true;

export const setAuthSession = (
  session: typeof authClient.$Infer.Session | null,
  status: "signIn" | "signOut"
) => {
  authState.session = session;
  authState.user = session?.user || null;
  authState.status = status;
};

const signOutLocally = () => {
  authState.session = null;
  authState.user = null;
  authState.status = "signOut";
};

/**
 * Whether a session response is the backend actually saying "not signed in".
 *
 * This decides whether a failed hydration may log someone out, so the two
 * failure modes have to stay apart:
 *
 *  - No session. The endpoint answers `200` with a null body — no error object
 *    at all — so an absent status is the normal signed-out reply, not a
 *    missing response. This must sign out, or a stale AUTH_STATE would keep a
 *    logged-out user looking logged in forever.
 *  - Can't reach the backend. `authClient` throws (better-auth does not enable
 *    better-fetch's `catchAllError`, so a throwing fetch propagates), or the
 *    server answers 5xx. Neither says anything about session validity, and
 *    treating them as a sign-out ejects working sessions whenever the network
 *    drops or the API has a bad minute.
 *
 * Only 401/403 are read as auth verdicts; every other status is treated as the
 * backend having a problem. If we guess wrong the screens' own requests will
 * 401 and correct it — strictly better than signing people out on a blip.
 */
type SessionVerdict = "signed-in" | "signed-out" | "unreachable";

const readSessionVerdict = (result: {
  data?: { user?: unknown } | null;
  error?: { status?: number } | null;
}): SessionVerdict => {
  if (result.data?.user) {
    return "signed-in";
  }

  const status = result.error?.status;

  if (status === undefined || status === null) {
    return "signed-out";
  }

  return status === 401 || status === 403 ? "signed-out" : "unreachable";
};

/**
 * Verifies the optimistically-restored session against the server.
 *
 * No longer blocks first paint (see `restoredStatus`): the app is already on
 * screen while this runs, so its only job is to correct the state if the
 * persisted session turned out to be wrong.
 */
export const hydrateAuth = async () => {
  authState.isHydrating = true;

  try {
    for (let attempts = 0; attempts < 3; attempts++) {
      try {
        const session = await authClient.getSession();
        const verdict = readSessionVerdict(session);

        if (verdict === "signed-in" && session.data?.user) {
          const user = session.data.user;

          // Block unverified non-anonymous users from accessing the app
          if (!(user.emailVerified || user.isAnonymous)) {
            console.log("User email not verified, signing out");
            signOutLocally();
            return;
          }

          authState.session = session.data;
          authState.user = user;
          authState.status = "signIn";
          return;
        }

        if (verdict === "signed-out") {
          console.log("No user found in session");
          signOutLocally();
          return;
        }

        console.warn(
          `Hydrate attempt ${attempts + 1} could not reach the session endpoint (status ${session.error?.status}), retrying`
        );
      } catch (error) {
        console.error(`Hydrate attempt ${attempts + 1} failed:`, error);
        // retry
      }
    }

    // Every attempt failed to reach the server. The persisted session stands:
    // we have no evidence against it, and discarding it here would mean losing
    // your session simply for launching the app offline.
    console.error("All hydration attempts failed; keeping persisted session");
  } finally {
    authState.isHydrating = false;
  }
};

export const logout = async () => {
  try {
    if (authState.session?.user) {
      const pushToken = storage.getString("pushToken");
      const { data, error } = await authClient.signOut({
        fetchOptions: {
          // @ts-expect-error
          body: {
            pushToken,
          },
          onSuccess(_context) {
            authState.session = null;
            authState.status = "signOut";
            authState.user = null;
          },
        },
      });
      if (error) {
        throw error;
      }
    }
    setTimeout(() => {
      queryClient.clear();
      queryClient.removeQueries();
    }, 1500);
    storage.remove("NAVIGATION_STATE_V1");
  } catch (error) {
    console.log(error);
    // toast.error("Logout Failed", {
    //   description: `An error occurred while logging out`,
    // });
  } finally {
    authState.session = null;
    authState.user = null;
    authState.status = "signOut";
    routeState.reactNavTabName = undefined;
    storage.remove("pushToken");
    // Server deletes the push-tokens row on sign-out, so the acknowledged
    // (token, account, build) triple cached by usePushNotification is dead.
    // Without this, re-login recomputes the identical triple, mistakes it for
    // already-registered, and never re-saves — leaving the account with no
    // token and no notifications.
    storage.remove("pushTokenRegistration");
  }
};

subscribe(authState, () => {
  storage.set("AUTH_STATE", JSON.stringify(authState));

  if (authState.session?.user) {
    Sentry.setUser({
      id: authState.session.user.id,
      isAnonymous: isAnonymous(),
      email: authState.session.user.email,
      // username: authState.session.user.username,
      ip_address: "{{auto}}",
    });
    const { id, createdAt, updatedAt, ...rest } = authState.session.user;
  } else {
    Sentry.setUser(null);
  }
});
