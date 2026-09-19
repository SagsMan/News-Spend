import { Toast } from "heroui-native/toast";
import { View } from "react-native";

import { Button } from "#/components/heroui/button";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import { toast } from "#/components/heroui/toast";

/**
 * Dev-only bench for the HeroUI toast wrapper.
 *
 * Deep link: `news-spend://toast-lab`. Registered behind `__DEV__` in
 * `navigation/shared-screens.tsx`, so it never ships.
 */
const cases: { label: string; run: () => void }[] = [
  {
    // Sonner's `toast` was callable directly, as an alias for `toast.show`;
    // some migrated call sites still use that form.
    label: "callable form: toast(label, options)",
    run: () => toast("Sign In Successful", { description: "Welcome back" }),
  },
  {
    label: "success + description",
    run: () =>
      toast.success("Prize claimed", {
        description: "₦500 airtime will arrive shortly.",
      }),
  },
  {
    label: "success, label only",
    run: () => toast.success("You're verified. Your prize is on its way."),
  },
  {
    label: "error + description",
    run: () =>
      toast.error("Claim failed", {
        description: "We couldn't reach the network. Try again.",
      }),
  },
  {
    label: "error, label only",
    run: () => toast.error("Failed to unblock user"),
  },
  {
    label: "info",
    run: () =>
      toast.info("Airtime is on the way", {
        description: "Delivery usually completes in under two minutes.",
      }),
  },
  {
    label: "warning",
    run: () =>
      toast.warning("Verify your identity", {
        description: "14 days left to claim this prize.",
      }),
  },
  {
    label: "default",
    run: () =>
      toast.show("Saved to your library", {
        description: "You can find it under Saved articles.",
      }),
  },
  {
    label: "loading (stays up)",
    run: () => toast.loading("Updating profile..."),
  },
  {
    label: "loading with Infinity duration",
    run: () =>
      toast.loading("Unblocking user...", {
        duration: Number.POSITIVE_INFINITY,
      }),
  },
  {
    label: "loading → dismiss → success",
    run: () => {
      toast.loading("Deleting account...");
      setTimeout(() => {
        toast.dismiss();
        toast.success("Account Deleted", {
          description:
            "Your account has been permanently deleted. We're sorry to see you go.",
        });
      }, 1500);
    },
  },
  {
    label: "long label + long description",
    run: () =>
      toast.error("Something went wrong while saving your profile changes", {
        description:
          "An error occurred and the update was not applied. Check your connection and try again in a moment.",
      }),
  },
  {
    label: "stack three at once",
    run: () => {
      toast.success("First");
      toast.warning("Second");
      toast.error("Third");
    },
  },
  {
    label: "closable (Toast.Close)",
    run: () =>
      toast.warning("Verify your identity", {
        description: "14 days left to claim this prize.",
        closable: true,
        duration: Number.POSITIVE_INFINITY,
      }),
  },
  {
    label: "action button",
    run: () =>
      toast.success("Prize claimed", {
        description: "₦500 airtime will arrive shortly.",
        action: { label: "Done", onPress: ({ hide }) => hide() },
      }),
  },
  {
    label: "action + close together",
    run: () =>
      toast.info("Airtime is on the way", {
        action: { label: "Track" },
        closable: true,
        duration: Number.POSITIVE_INFINITY,
      }),
  },
  {
    label: "bottom placement",
    run: () =>
      toast.success("Saved", {
        description: "Bottom of the screen.",
        placement: "bottom",
      }),
  },
  {
    label: "custom component (escape hatch)",
    run: () =>
      toast.custom({
        duration: Number.POSITIVE_INFINITY,
        component: (props) => (
          <Toast className="flex-row items-center gap-3" {...props}>
            <View className="flex-1">
              <Toast.Title>Fully custom</Toast.Title>
              <Toast.Description>
                Raw heroui-native Toast: every part is yours.
              </Toast.Description>
            </View>
            <Toast.Action onPress={() => props.hide()}>Undo</Toast.Action>
            <Toast.Close />
          </Toast>
        ),
      }),
  },
  { label: "dismiss all", run: () => toast.dismiss() },
];

export default function ToastLab() {
  return (
    <Screen
      contentContainerStyle={{ padding: 16, gap: 12 }}
      preset="scroll"
      safeAreaEdges={["top"]}
    >
      <Text variant="HeadingMedium">Toast Lab</Text>
      <Text className="text-muted" variant="body">
        Dev-only. Each button fires the wrapper in components/heroui/toast.tsx.
      </Text>
      <View className="gap-2 pt-2">
        {cases.map((testCase) => (
          <Button
            key={testCase.label}
            onPress={testCase.run}
            variant="secondary"
          >
            <Button.Label>{testCase.label}</Button.Label>
          </Button>
        ))}
      </View>
    </Screen>
  );
}
