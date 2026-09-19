import { proxy } from "valtio";

/**
 * Whether the server has refused this build as too old.
 *
 * Set from the global query and mutation error handlers rather than by any one
 * screen, because the refusal can arrive from whatever call happens to run
 * first — and once it has arrived, nothing else in the app is going to work
 * either.
 *
 * A store update is the only remedy. `runtimeVersion` follows the app version,
 * so an over-the-air update cannot reach a stale binary: the JS fix is
 * published against a runtime this build will never match. That is why this is
 * a separate path from `UpdateSheet`, which restarts into a downloaded bundle.
 */
export const upgradeState = proxy({
  required: false,
});

export function requireUpgrade() {
  upgradeState.required = true;
}
