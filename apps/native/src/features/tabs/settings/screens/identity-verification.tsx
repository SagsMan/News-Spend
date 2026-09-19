import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { cn } from "heroui-native/utils";
import { CheckCircleIcon, ShieldCheckIcon } from "#/lib/icons";
import { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { ScreenHeader } from "#/components";
import { Button } from "#/components/heroui/button";
import { Icon } from "#/components/heroui/icon";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import { toast } from "#/components/heroui/toast";
import { orpc } from "#/lib/orpc";

/**
 * Identity verification, run through the provider's own hosted flow.
 *
 * Deliberately a browser session rather than an in-app form. The old screen
 * asked people to photograph a passport and uploaded it into our own storage;
 * this way the documents never touch us at all; the provider holds them and
 * we keep a decision.
 *
 * The decision arrives by webhook, not from the browser closing, so returning
 * to the app does not mean a result exists yet. That is what the polling below
 * is for.
 */

/** How long to keep asking after the browser closes, before giving up. */
const POLL_ATTEMPTS = 6;
const POLL_INTERVAL_MS = 2500;

/**
 * What the configured workflow actually does, in order.
 *
 * The design also listed a NIN/BVN cross-check, which the published Free KYC
 * workflow does not perform; it is OCR, liveness and face match only. Naming
 * a check we do not run would be a promise about somebody's identity data that
 * we cannot keep, so it is left out until the workflow includes it.
 */
const VERIFICATION_STEPS = [
  "Scan a government ID",
  "Take a liveness selfie",
  "We match the two and get a yes or no",
] as const;

export default function IdentityVerification() {
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(false);
  const cancelled = useRef(false);

  const status = useQuery(orpc.verification.status.queryOptions());
  const start = useMutation(orpc.verification.start.mutationOptions());

  const verified = status.data?.verified === true;
  const available = status.data?.available === true;

  /**
   * Ask for a decision a few times after the browser closes.
   *
   * A webhook usually lands within a second or two, but "usually" would leave
   * somebody staring at an unchanged screen wondering whether it worked.
   */
  const pollForDecision = useCallback(async () => {
    setChecking(true);
    cancelled.current = false;

    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
      if (cancelled.current) {
        break;
      }

      const result = await queryClient.fetchQuery(
        orpc.verification.status.queryOptions()
      );

      if (result?.verified) {
        setChecking(false);
        toast.success("You're verified. Your prize is on its way.");
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    setChecking(false);
    // Not a failure: a provider can take longer, or want a human to look.
    toast.info(
      "We haven't heard back yet. You can close this. We'll let you know."
    );
  }, [queryClient]);

  const onStart = useCallback(async () => {
    try {
      const session = await start.mutateAsync();

      if (session.alreadyVerified) {
        await queryClient.invalidateQueries();
        return;
      }

      if (!session.url) {
        toast.error("Verification is unavailable right now.");
        return;
      }

      // The redirect brings the user back into the app when the provider is
      // finished, rather than leaving them in a browser tab to close by hand.
      await WebBrowser.openAuthSessionAsync(
        session.url,
        // Not "verify-identity": that path still belongs to the old upload
        // form, and redirecting there would land the user back on the screen
        // this one replaces.
        Linking.createURL("identity-verification")
      );

      await pollForDecision();
    } catch {
      toast.error("Could not start verification. Please try again.");
    }
  }, [start, queryClient, pollForDecision]);

  return (
    <Screen statusBarStyle="light">
      <ScreenHeader title="Verify Identity" />
      <View className="flex-1 items-center justify-center gap-4 px-5 pb-8">
        <View
          className={cn(
            "size-16 items-center justify-center rounded-full",
            verified ? "bg-success/15" : "bg-p-500/10"
          )}
        >
          <Icon
            className={cn(verified ? "text-success" : "text-p-500")}
            name={verified ? CheckCircleIcon : ShieldCheckIcon}
            size={30}
          />
        </View>

        <Text className="text-center font-semibold text-xl">
          {verified ? "You're verified" : "One quick check to receive this"}
        </Text>

        <Text className="text-center text-muted-foreground text-sm leading-5">
          {verified
            ? "Nothing else to do. This carries over to every prize you win."
            : "Your prize is already claimed and waiting. Scan an ID and take a quick selfie. It takes about a minute, and you'll only ever do this once."}
        </Text>

        {!verified && (
          <>
            <View className="w-full gap-2 pt-1">
              {VERIFICATION_STEPS.map((step, index) => (
                <View className="flex-row items-center gap-2.5" key={step}>
                  <View className="size-5.5 items-center justify-center rounded-full border border-border">
                    <Text className="font-semibold text-subtle-text text-xs">
                      {index + 1}
                    </Text>
                  </View>
                  <Text className="text-muted-foreground text-xs">{step}</Text>
                </View>
              ))}
            </View>

            <View className="w-full rounded-xl bg-muted/20 p-3">
              <Text className="text-subtle-text text-xs leading-4">
                Handled by Didit. NewsSpend keeps only the pass or fail result,
                never the document image.
              </Text>
            </View>
          </>
        )}

        {/* The CTA is outlined rather than solid: it hands the person off to a
            third party to photograph their ID, which is worth presenting as a
            considered step rather than the loudest thing on screen. */}
        {verified ? null : available ? (
          <Button
            className="mt-1 w-full border border-p-500 bg-transparent"
            isDisabled={start.isPending || checking || status.isLoading}
            onPress={onStart}
            variant="secondary"
          >
            <Button.Label className="font-semibold text-p-500">
              {checking
                ? "Checking…"
                : start.isPending
                  ? "Opening…"
                  : "Start verification"}
            </Button.Label>
          </Button>
        ) : (
          <Text className="text-center text-muted-foreground text-sm">
            Verification isn't available right now. Please check back shortly.
          </Text>
        )}
      </View>
    </Screen>
  );
}
