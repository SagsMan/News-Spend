import { useNavigation } from "@react-navigation/core";
import { useMutation } from "@tanstack/react-query";
import { Checkbox } from "heroui-native/checkbox";
import { ControlField } from "heroui-native/control-field";
import { Dialog } from "heroui-native/dialog";
import { LinkButton } from "heroui-native/link-button";
import type { ReactNode } from "react";
import { useState } from "react";
import { View } from "react-native";
import { toast } from "#/components/heroui/toast";
import { authClient } from "#/lib/authClient";
import { hydrateAuth } from "#/state/auth";
import { Button } from "./button";
import { Text } from "./text";

type ConfirmAsGuestProps = {
  trigger: ReactNode;
};

export function ConfirmAsGuest({ trigger }: ConfirmAsGuestProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const navigation = useNavigation();

  const anonymousSignInMutation = useMutation({
    mutationFn: async () => {
      const response = await authClient.signIn.anonymous();

      if (response.error) {
        throw new Error("Failed to sign in anonymously");
      }

      await hydrateAuth();
    },
    onSuccess: () => {
      console.log("Anonymous sign-in successful");
      toast.success("Signed in as a guest");
      setIsOpen(false);
    },
    onError: () => {
      toast.error("Failed to sign in as a guest");
    },
  });

  const onConfirmGuest = async () => {
    await anonymousSignInMutation.mutateAsync();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          setAcceptedTerms(false);
        }
      }}
    >
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="rounded-lg">
          <Dialog.Close
            className="absolute top-3 right-2.5 z-50"
            variant="ghost"
          />
          <Dialog.Description className="my-6 leading-relaxed">
            Are you sure you want to skip registration? You can still complete
            registration later, but you will not get the welcome points
          </Dialog.Description>
          {/*<View className="flex-row items-center gap-3 mb-6">
            <Switch
              isSelected={acceptedTerms}
              onSelectedChange={setAcceptedTerms}
            />
            <Dialog.Description>
              I agree to the Terms of Service and Privacy Policy
            </Dialog.Description>
          </View>*/}

          <ControlField
            className="flex-col items-start gap-1"
            isInvalid={!acceptedTerms}
            isSelected={acceptedTerms}
            onSelectedChange={setAcceptedTerms}
          >
            <View className="flex-row items-center gap-2">
              <ControlField.Indicator className="mt-0.5">
                <Checkbox />
              </ControlField.Indicator>

              <View className="max-w-60 flex-1 flex-row flex-wrap">
                <Text className="text-[1rem] text-muted">I agree to the </Text>
                <LinkButton
                  onPress={() => {
                    navigation.navigate("TermsOfUse");
                    setIsOpen(false);
                  }}
                  size="sm"
                >
                  <LinkButton.Label className="text-blue-600 underline">
                    Terms of Service
                  </LinkButton.Label>
                </LinkButton>
                <Text className="text-[16px] text-muted"> and </Text>
                <LinkButton
                  onPress={() => {
                    navigation.navigate("PrivacyPolicy");
                    setIsOpen(false);
                  }}
                  size="sm"
                >
                  <LinkButton.Label className="text-blue-600 underline">
                    Privacy Policy
                  </LinkButton.Label>
                </LinkButton>
              </View>
            </View>
          </ControlField>
          <View className="flex-row justify-end gap-3">
            <Button
              isDisabled={anonymousSignInMutation.isPending || !acceptedTerms}
              onPress={onConfirmGuest}
              size="sm"
              variant="primary"
            >
              {anonymousSignInMutation.isPending ? "Loading..." : "YES, SKIP"}
            </Button>
            <Button onPress={() => setIsOpen(false)} size="sm" variant="ghost">
              Cancel
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

export default ConfirmAsGuest;
