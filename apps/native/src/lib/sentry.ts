import * as Sentry from "@sentry/react-native";
import * as Application from "expo-application";
import Constants from "expo-constants";
import * as Updates from "expo-updates";

export let navigationIntegration: ReturnType<
  typeof Sentry.reactNavigationIntegration
>;

const SSL_HANDSHAKE_RE = /SSLHandshakeException/i;
const API_CONNECT_RE = /Failed to connect to api\.newsspend\.com/i;

/**
 * Which build this is, in Sentry's vocabulary.
 *
 * The binary already knows: `extra.variant` is baked in at config time and is
 * what `adUnits` reads to decide between real and test ad units. Reusing it
 * means the environment on an issue and the environment the app actually
 * behaves as cannot disagree.
 *
 * "preview" and "beta" are the builds pointed at staging, so they are reported
 * as `staging` rather than by their build-channel names — the question being
 * asked of an issue is which backend it hit, not how the binary was
 * distributed.
 */
function resolveEnvironment(): string {
  const variant = Constants.expoConfig?.extra?.variant as string | undefined;

  switch (variant) {
    case "production":
      return "production";
    case "preview":
    case "beta":
      return "staging";
    case "development":
      return "development";
    default:
      // Better an honest unknown than a wrong guess: an issue tagged
      // "production" that is not production is worse than one tagged nothing.
      return "unknown";
  }
}

export const initSentry = () => {
  if (__DEV__) {
    return;
  }

  navigationIntegration = Sentry.reactNavigationIntegration({
    enableTimeToInitialDisplay: true,
  });

  Sentry.init({
    dsn: "https://da31e9a0b06dd748c0616a19b2d3d48e@o4507648362938368.ingest.de.sentry.io/4507648370212944",
    enableLogs: true,
    integrations: [navigationIntegration],
    environment: resolveEnvironment(),

    /**
     * Expected flows, not bugs. UPGRADE_REQUIRED already shows the blocking
     * update screen via QueryCache/MutationCache; transient fetch failures
     * already retry and surface through OfflineAlert. Reporting either as an
     * issue is noise (NEWS-SPEND-MEDIA-E0/AJ/DA).
     */
    ignoreErrors: [
      "This version of the app is no longer supported.",
      "UPGRADE_REQUIRED",
      SSL_HANDSHAKE_RE,
      API_CONNECT_RE,
    ],
    beforeSend(event) {
      const values = event.exception?.values ?? [];
      if (
        values.some((v) =>
          v.value?.includes("This version of the app is no longer supported.")
        )
      ) {
        return null;
      }
      return event;
    },

    /**
     * Release and dist follow the store conventions Sentry expects: the
     * release is the marketing version, the dist the build number. Without
     * them every issue from every version pools into one, and "did the fix
     * ship?" cannot be answered.
     */
    release: Application.nativeApplicationVersion ?? undefined,
    dist: Application.nativeBuildVersion ?? undefined,
  });

  /**
   * Which JavaScript bundle is actually running.
   *
   * Over-the-air updates mean the binary version does not identify the code:
   * two devices on the same build can be running different JS. `updateId` is
   * the only thing that says which, and a stack trace against the wrong bundle
   * is a stack trace against the wrong line numbers.
   *
   * `embedded` when no update has been applied, so the tag is never absent.
   */
  Sentry.setTag("update_id", Updates.updateId ?? "embedded");
  Sentry.setTag("update_channel", Updates.channel ?? "embedded");
};
