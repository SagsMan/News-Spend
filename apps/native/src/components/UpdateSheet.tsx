import { BottomSheet } from "heroui-native/bottom-sheet";
import { View } from "react-native";

import { Button } from "#/components/heroui/button";
import { Text } from "#/components/heroui/text";

type UpdateSheetProps = {
  isOpen: boolean;
  onOpenChange: (value: boolean) => void;
  /** True once the payload is on disk and a restart is instant. */
  isReady: boolean;
  /** True while the payload is still coming down in the background. */
  isDownloading: boolean;
  /** A mandatory update cannot be dismissed by any route. */
  isMandatory: boolean;
  onRestart: () => void;
};

export function UpdateSheet({
  isOpen,
  onOpenChange,
  isReady,
  isDownloading,
  isMandatory,
  onRestart,
}: UpdateSheetProps) {
  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        {/*
          A mandatory update is the one case where dismissal is refused by every
          route (handle and backdrop both). Optional updates stay dismissible:
          the check re-runs on the next foreground, so losing the sheet costs
          the user nothing.
        */}
        <BottomSheet.Overlay isCloseOnPress={!isMandatory} />
        <BottomSheet.Content
          enableDynamicSizing
          enablePanDownToClose={!isMandatory}
        >
          <View className="gap-4 px-5 pt-2 pb-8">
            <View className="items-center gap-2">
              <Text className="text-center font-semibold text-lg">
                {isMandatory ? "Update Required" : "Update Available"}
              </Text>
              <Text className="text-center text-subtle-text">
                {isMandatory
                  ? "This version is no longer supported. Restart to continue using the app."
                  : "A new version of the app is available. Restart to apply the update."}
              </Text>
            </View>

            {/* The payload is already downloading by the time this is on
                screen, so the only wait left is a restart. Until it lands the
                button says so rather than stranding a tapper on a spinner. */}
            <Button isDisabled={!isReady} onPress={onRestart}>
              <Button.Label>
                {isReady ? "Restart Now" : "Preparing update…"}
              </Button.Label>
            </Button>

            {isMandatory ? null : (
              <Button onPress={() => onOpenChange(false)} variant="outline">
                <Button.Label>Later</Button.Label>
              </Button>
            )}

            {isDownloading && !isReady ? (
              <Text className="text-center text-subtle-text text-xs">
                Downloading in the background. You can keep using the app.
              </Text>
            ) : null}
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
