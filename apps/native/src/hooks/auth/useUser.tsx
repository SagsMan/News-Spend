import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useSnapshot } from "valtio";

import { authClient } from "#/lib/authClient";
import { authState, setAuthSession } from "#/state/auth";

export const userQueryOptions = queryOptions({
  queryKey: ["account", "me"],
  queryFn: async () => {
    const { data, error } = await authClient.getSession({
      query: { disableCookieCache: true },
    });
    if (error) {
      throw error;
    }
    return data;
  },
  staleTime: 5 * 60 * 1000,
  refetchOnWindowFocus: true,
  refetchOnMount: false,
  meta: { persist: false },
});

/**
 * Fresh user data from the server, synced back into `authState`.
 *
 * The sync exists so that editing your profile updates the name and avatar
 * everywhere, not just on the screen that saved them — Profile invalidates
 * this query on success and the rest of the app follows.
 *
 * The one implementation. There were three: this, `hooks/useUser`, and
 * `features/auth/hooks/useUser`. All of them registered the *same* query key,
 * so they shared a single cache entry while disagreeing about how to fill it —
 * whichever mounted last decided whether the session was fetched with
 * `disableCookieCache`. Fixes landed in one and silently did not apply to the
 * readers of the others, which is how the sign-out-on-network-error bug
 * outlived being fixed. Add call sites here rather than starting a fourth.
 */
export default function useUser() {
  // Only `status` is read off the snapshot. Destructuring `session` here too
  // would subscribe this hook to the very object it writes, so every sync
  // would re-render every caller a second time.
  const { status } = useSnapshot(authState);

  const query = useQuery({
    ...userQueryOptions,
    enabled: status === "signIn",
    // Read off the proxy rather than the snapshot: a placeholder should not
    // create a subscription.
    placeholderData: authState.session ?? undefined,
  });

  useEffect(() => {
    if (!query.isSuccess) {
      return;
    }

    const next = query.data;

    // Reached on a successful response, so an empty body is the server
    // actually saying there is no session — not a connection that failed.
    if (!next?.user) {
      setAuthSession(null, "signOut");
      return;
    }

    // Block unverified non-anonymous users
    if (!(next.user.emailVerified || next.user.isAnonymous)) {
      setAuthSession(null, "signOut");
      return;
    }

    // Compare the *user*, not the whole session.
    //
    // This used to diff the entire session object, which sounds equivalent and
    // is not: the envelope around the user carries a token and an `expiresAt`
    // that better-auth rotates on refresh, so the JSON differed on almost
    // every fetch even when nothing about the user had changed. Each of those
    // wrote a new `authState.session`, and every `useSnapshot(authState)`
    // consumer in the tree re-rendered with a fresh object identity.
    //
    // That churn is why dialogs reopened by themselves. Visiting Profile
    // refetched this query, the session reference changed, and effects keyed
    // on it — GiveawayReward's opener, among others — re-ran and re-announced
    // a reward the user had already dismissed. The now-deleted LotteryReward
    // hit the same symptom and worked around it by omitting `user` from its
    // deps; this is the same bug seen from the other end.
    if (JSON.stringify(authState.session?.user) !== JSON.stringify(next.user)) {
      setAuthSession(next, "signIn");
    }
  }, [query.isSuccess, query.data]);

  // Deliberately no error handler.
  //
  // The previous one signed the user out on any failure, guarded by a check
  // for a `"stale"` status that is not in the status union
  // (`"idle" | "signIn" | "signOut"`) and so was always true. Losing your
  // session because a refetch timed out is the offline bug in miniature; a
  // genuinely revoked session is caught by `hydrateAuth` on next launch and by
  // the 401 handler on any real data request.
  return query;
}
