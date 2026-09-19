import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Spinner } from "heroui-native/spinner";
import { ArrowLeftIcon } from "#/lib/icons";
import { FormProvider, type SubmitHandler, useForm } from "react-hook-form";
import { Keyboard, Pressable, View } from "react-native";
import * as z from "zod";
import { Button } from "#/components/heroui/button";
import { Icon } from "#/components/heroui/icon";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import FormInput from "#/components/heroui/text-input";
import { toast } from "#/components/heroui/toast";
import { authClient } from "#/lib/authClient";
import { logout } from "#/state/auth";
import useChangePassword from "../hooks/useChangePassword";

const schema = z
  .object({
    password: z
      .string("Password is required")
      .min(8, "Password must be at least 8 characters"),
    confirmPassword: z
      .string("Confirm password is required")
      .min(8, "Password must be at least 8 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof schema>;

const ResetPassword = () => {
  const navigation = useNavigation("ResetPassword");
  const route = useRoute("ResetPassword");
  const { token } = route.params;

  const changePasswordMutation = useChangePassword();

  const formMethods = useForm<ChangePasswordInput>({
    resolver: zodResolver(schema),
  });

  const onSubmit: SubmitHandler<ChangePasswordInput> = (data) => {
    Keyboard.dismiss();
    changePasswordMutation.mutate(
      { password: data.password, token },
      {
        onSuccess: async ({ data, error }) => {
          if (error) {
            return toast.error("Unable to reset password", {
              description:
                "The reset link may have expired or is invalid. Please request a new password reset link and try again.",
            });
          }
          toast.success("Password Updated", {
            description:
              "Your password has been changed. Please sign in with your new password.",
          });
          const session = await authClient.getSession();
          if (session.data) {
            await logout();
          }
          navigation.replace("SignIn");
        },
        onError: () => {
          toast.error("Failed to reset password", {
            description: "Something went wrong while resetting your password.",
          });
        },
      }
    );
  };

  return (
    <Screen className="px-6 pt-safe-offset-5" safeAreaEdges={["bottom"]}>
      <Pressable hitSlop={10} onPress={() => navigation.goBack()}>
        <Icon className="size-6" name={ArrowLeftIcon} />
      </Pressable>

      <View className="mt-8 flex-1 gap-11">
        <View className="gap-5">
          <Text className="text-center font-bold text-3xl">
            Change Password
          </Text>
          <FormProvider {...formMethods}>
            <View className="gap-5">
              <FormInput
                isPassword
                name="password"
                placeholder="New password"
                textContentType="newPassword"
              />
              <FormInput
                isPassword
                name="confirmPassword"
                placeholder="Confirm new password"
                textContentType="newPassword"
              />
            </View>
          </FormProvider>
        </View>
        <Button
          isDisabled={changePasswordMutation.isPending}
          onPress={formMethods.handleSubmit(onSubmit)}
        >
          {changePasswordMutation.isPending ? <Spinner /> : null}
          <Button.Label>Save</Button.Label>
        </Button>
      </View>
    </Screen>
  );
};

export default ResetPassword;
