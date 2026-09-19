import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigation } from "@react-navigation/native";
import { Checkbox } from "heroui-native/checkbox";
import { ControlField } from "heroui-native/control-field";
import { Spinner } from "heroui-native/spinner";
import { WarningCircleIcon } from "#/lib/icons";
import { useState } from "react";
import { FormProvider, type SubmitHandler, useForm } from "react-hook-form";
import { Alert, Keyboard, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { z } from "zod";
import { Button } from "#/components/heroui/button";
import { Icon } from "#/components/heroui/icon";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import FormTextInput from "#/components/heroui/text-input";
import { toast } from "#/components/heroui/toast";
import { useDeleteAccount } from "#/hooks/auth";
import { logout } from "#/state/auth";

const deleteAccountSchema = z.object({
  password: z
    .string("Enter your password")
    .min(8, "Password must be at least 8 characters"),
});

type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

function DeleteAccount() {
  const navigation = useNavigation();
  const deleteAccountMutation = useDeleteAccount();
  const [hasReadConsequences, setHasReadConsequences] = useState(false);

  const formMethods = useForm<DeleteAccountInput>({
    resolver: zodResolver(deleteAccountSchema),
  });

  const showConfirmationAlert = (data: DeleteAccountInput) => {
    Alert.alert(
      "Delete Account?",
      "This action cannot be undone. Your account and all associated data will be permanently deleted.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => handleDeleteAccount(data),
        },
      ],
      { cancelable: true }
    );
  };

  const handleSuccess = async () => {
    toast.dismiss();
    toast.success("Account Deleted", {
      description:
        "Your account has been permanently deleted. We're sorry to see you go.",
    });

    await logout();
  };

  const handleError = (error: Error) => {
    toast.dismiss();

    const customError = error as {
      code?: string;
      message?: string;
      data?: { fieldErrors?: Record<string, string[]> };
    };

    if (
      customError?.code === "UNAUTHORIZED" ||
      customError?.message?.includes("password")
    ) {
      formMethods.setError("password", {
        type: "server",
        message: "Incorrect password",
      });
      toast.error("Incorrect Password", {
        description: "Please enter your correct password to continue.",
      });
      return;
    }

    if (customError?.code === "INPUT_VALIDATION_FAILED") {
      const fieldErrors = customError?.data?.fieldErrors;
      if (fieldErrors) {
        for (const key of Object.keys(fieldErrors)) {
          formMethods.setError(key as keyof DeleteAccountInput, {
            type: "server",
            message: fieldErrors[key]?.[0] || "Unknown error",
          });
        }
      }
      return;
    }

    toast.error("Failed to Delete Account", {
      description:
        customError?.message || "An error occurred. Please try again later.",
    });
  };

  const handleDeleteAccount = (data: DeleteAccountInput) => {
    toast.loading("Deleting account...");

    deleteAccountMutation.mutate(
      {
        password: data.password,
      },
      {
        onSuccess: handleSuccess,
        onError: handleError,
      }
    );

    Keyboard.dismiss();
  };

  const onSubmit: SubmitHandler<DeleteAccountInput> = (data) => {
    if (!hasReadConsequences) {
      toast.error("Please confirm", {
        description: "You must acknowledge the consequences before proceeding.",
      });
      return;
    }

    showConfirmationAlert(data);
  };

  return (
    <Screen safeAreaEdges={["bottom"]} statusBarStyle="light">
      <KeyboardAwareScrollView
        bottomOffset={40}
        contentContainerClassName="gap-6 px-5 pt-5 pb-12"
        showsVerticalScrollIndicator={false}
      >
        {/* Warning card */}
        <View className="gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <View className="flex-row items-center gap-2">
            <Icon color="#dc2626" name={WarningCircleIcon} size={20} />
            <Text className="font-bold text-lg text-red-600">Warning</Text>
          </View>
          <Text className="text-red-600">
            Deleting your account is permanent and cannot be undone. This action
            will:
          </Text>
        </View>

        {/* What will be deleted */}
        <View className="gap-3 rounded-xl bg-blue-50 p-4">
          <Text className="font-semibold text-base">What will be deleted:</Text>
          <View className="gap-2">
            <View className="flex-row items-start gap-2">
              <Text>•</Text>
              <Text className="flex-1">
                Your profile information (name, email, username)
              </Text>
            </View>
            <View className="flex-row items-start gap-2">
              <Text>•</Text>
              <Text className="flex-1">
                All your reward points and activities
              </Text>
            </View>
            <View className="flex-row items-start gap-2">
              <Text>•</Text>
              <Text className="flex-1">Your comments and posts</Text>
            </View>
            <View className="flex-row items-start gap-2">
              <Text>•</Text>
              <Text className="flex-1">All saved preferences and settings</Text>
            </View>
            <View className="flex-row items-start gap-2">
              <Text>•</Text>
              <Text className="flex-1">
                Your account access (you will be logged out immediately)
              </Text>
            </View>
          </View>
        </View>

        {/* Form */}
        <FormProvider {...formMethods}>
          <View className="gap-4">
            <FormTextInput
              description="To confirm this action, please enter your password"
              isPassword
              label="Enter Your Password"
              name="password"
              placeholder="Your password"
            />

            <ControlField
              className="flex-col items-start"
              isSelected={hasReadConsequences}
              onSelectedChange={setHasReadConsequences}
            >
              <View className="flex-row items-start gap-3">
                <ControlField.Indicator>
                  <Checkbox className="mt-0.5 rounded-sm border border-field-border" />
                </ControlField.Indicator>
                <Text className="flex-1">
                  I understand that this action is permanent and cannot be
                  reversed
                </Text>
              </View>
            </ControlField>
          </View>
        </FormProvider>

        {/* Buttons */}
        <View className="gap-3">
          <Button
            isDisabled={deleteAccountMutation.isPending || !hasReadConsequences}
            onPress={formMethods.handleSubmit(onSubmit)}
            variant="danger"
          >
            {deleteAccountMutation.isPending ? <Spinner /> : null}
            <Button.Label>Delete My Account</Button.Label>
          </Button>

          <Button
            isDisabled={deleteAccountMutation.isPending}
            onPress={() => navigation.goBack()}
            variant="ghost"
          >
            <Button.Label>Cancel</Button.Label>
          </Button>
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

export default DeleteAccount;
