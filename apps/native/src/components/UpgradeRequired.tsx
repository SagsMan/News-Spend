import { ArrowClockwiseIcon } from "#/lib/icons";
import { Linking, Platform, View } from "react-native";
import { useSnapshot } from "valtio";

import { Button } from "#/components/heroui/button";
import { Icon } from "#/components/heroui/icon";
import { Text } from "#/components/heroui/text";
import { upgradeState } from "#/state/upgrade";

/**
 * Where the store listing lives. Same pair the settings screen already uses
 * for "Rate app", kept identical so there is one answer to "which listing".
 */
const STORE_URL = Platform.select({
  ios: "https://apps.apple.com/us/app/news-spend/id1550745257",
  android: "market://details?id=com.newsspend.app",
});

/**
 * Shown when the server has refused this build as too old.
 *
 * Covers the app rather than sitting inside a screen, because at this point
 * every request fails: a dismissible message would leave someone tapping
 * around an app that cannot load anything and reporting it as broken.
 *
 * There is deliberately no dismiss and no retry. Retrying cannot help — the
 * refusal is about which binary is installed, and only the store can change
 * that. An over-the-air update cannot either: `runtimeVersion` follows the app
 * version, so the fix is published against a runtime this build will never
 * match.
 */
export function UpgradeRequired() {
  const { required } = useSnapshot(upgradeState);

  if (!required) {
    return null;
  }

  return (
    <View className="absolute inset-0 z-50 items-center justify-center gap-5 bg-background px-8">
      <Icon color="#00223d" name={ArrowClockwiseIcon} size={52} weight="fill" />

      <View className="gap-2">
        <Text className="text-center font-semibold text-xl">
          Time to update
        </Text>
        <Text className="text-center text-subtle-text">
          This version of NewsSpend is no longer supported. Update to carry on
          reading, earning and entering giveaways.
        </Text>
      </View>

      <Button
        className="w-full"
        onPress={() => {
          if (STORE_URL) {
            Linking.openURL(STORE_URL).catch(() => {
              // Nothing useful to say if the store will not open: the message
              // above already names the only thing that helps.
            });
          }
        }}
      >
        <Button.Label>Update now</Button.Label>
      </Button>

      <Text className="text-center text-subtle-text text-xs">
        Your points, entries and prizes are safe on your account.
      </Text>
    </View>
  );
}
