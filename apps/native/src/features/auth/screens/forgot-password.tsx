import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigation } from "@react-navigation/native";
import { Spinner } from "heroui-native/spinner";
import { ArrowLeftIcon } from "#/lib/icons";
import { FormProvider, type SubmitHandler, useForm } from "react-hook-form";
import { Keyboard, Pressable, View } from "react-native";
import { z } from "zod";
import { Button } from "#/components/heroui/button";
import { Icon } from "#/components/heroui/icon";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import FormInput from "#/components/heroui/text-input";
import { toast } from "#/components/heroui/toast";
import useForgotPassword from "../hooks/useForgotPassword";

const schema = z.object({
  email: z
    .string("Enter a valid email address")
    .trim()
    .toLowerCase()
    .check(z.email("Invalid email address")),
});

export type ForgotPasswordInput = z.infer<typeof schema>;

const ForgotPassword = () => {
  const navigation = useNavigation("ForgotPassword");
  const formMethods = useForm<ForgotPasswordInput>({
    resolver: zodResolver(schema),
  });
  const resetMutation = useForgotPassword();

  const onSubmit: SubmitHandler<ForgotPasswordInput> = (data) => {
    resetMutation.mutate(data, {
      onError(_error) {
        toast.error("Reset Failed", {
          description:
            "Unable to send reset link. Please check your email address and try again.",
        });
      },
      onSuccess({ data, error }) {
        if (error) {
          return toast.error("Reset Link Not Sent", {
            description:
              error.message ||
              "We couldn't send a reset link to that email. Please double-check your address and try again.",
          });
        }
        navigation.replace("SignIn");
        toast.success("Check Your Email", {
          description:
            "We've sent a password reset link to your email address.",
        });
      },
    });

    Keyboard.dismiss();
  };

  return (
    <Screen className="px-6 pt-safe-offset-5" safeAreaEdges={["bottom"]}>
      <Pressable hitSlop={10} onPress={() => navigation.goBack()}>
        <Icon className="size-6" name={ArrowLeftIcon} />
      </Pressable>

      <View className="mt-8 flex-1 gap-11">
        <View className="gap-5">
          <Text className="text-center font-bold text-3xl">
            Forgot Password
          </Text>
          <Text className="text-center text-gray-500">
            Don't worry! It occurs. Please enter the email address linked with
            your account.
          </Text>

          <FormProvider {...formMethods}>
            <View className="mt-5">
              <FormInput
                keyboardType="email-address"
                name="email"
                placeholder="example@email.com"
                textContentType="emailAddress"
              />
            </View>
          </FormProvider>
        </View>
        <Button
          className="mt-3"
          isDisabled={resetMutation.isPending}
          onPress={formMethods.handleSubmit(onSubmit)}
        >
          {resetMutation.isPending ? <Spinner /> : null}
          <Button.Label>Send Code</Button.Label>
        </Button>
      </View>
    </Screen>
  );
};

export default ForgotPassword;
