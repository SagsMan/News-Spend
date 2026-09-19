import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigation } from "@react-navigation/native";
import { LinkButton } from "heroui-native/link-button";
import { Spinner } from "heroui-native/spinner";
import { useState } from "react";
import { FormProvider, type SubmitHandler, useForm } from "react-hook-form";
import { Keyboard, View } from "react-native";
import { z } from "zod";
import { Button } from "#/components/heroui/button";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import FormInput from "#/components/heroui/text-input";
import useLogin from "../hooks/useLogin";

const schema = z.object({
  email: z
    .string("Enter an email")
    .trim()
    .min(1, "Email cannot be empty")
    .check(z.email({ message: "Invalid email" })),
  password: z.string("Enter a password").min(1, "Password is required"),
});

const defaultValues = {
  email: "rickpd@hotmail.red",
  password: "123456qwerty",
};

export type LoginInput = z.input<typeof schema>;

export default function SignIn() {
  const navigation = useNavigation();
  const loginMutation = useLogin();
  const [serverError, setServerError] = useState<string | null>(null);
  const formMethods = useForm<LoginInput>({
    resolver: zodResolver(schema),
    defaultValues: __DEV__ ? defaultValues : undefined,
  });

  const { handleSubmit } = formMethods;

  const onSubmit: SubmitHandler<LoginInput> = (data) => {
    setServerError(null);
    Keyboard.dismiss();
    loginMutation.mutate(data, {});
  };

  return (
    <Screen className="px-6 pt-4" safeAreaEdges={["bottom"]}>
      <Text className="mt-7 mb-11 max-w-75 font-bold text-3xl">
        Welcome back! Glad to see you, Again!
      </Text>
      <View className="flex-col gap-9">
        <FormProvider {...formMethods}>
          <View className="flex-col gap-5">
            <FormInput
              keyboardType="email-address"
              name="email"
              placeholder="Email"
              textContentType="emailAddress"
            />
            <FormInput
              isPassword
              name="password"
              placeholder="Password"
              textContentType="password"
            />

            <View className="mt-2 flex-col gap-2">
              {serverError ? (
                <Text className="text-lg text-red-500">{serverError}</Text>
              ) : null}
              <LinkButton
                className="self-end"
                onPress={() => navigation.navigate("ForgotPassword")}
              >
                <LinkButton.Label className="text-accent text-sm">
                  Forgot password?
                </LinkButton.Label>
              </LinkButton>
            </View>
          </View>
        </FormProvider>
        <Button
          isDisabled={loginMutation.isPending}
          onPress={handleSubmit(onSubmit)}
        >
          {loginMutation.isPending ? <Spinner /> : null}
          <Button.Label>Sign In</Button.Label>
        </Button>
      </View>
      <View className="mt-auto mb-safe-offset-1 flex-row flex-wrap justify-center">
        <Text className="text-sm">Don&apos;t have an account? </Text>
        <LinkButton onPress={() => navigation.navigate("SignUp")}>
          <LinkButton.Label className="font-bold text-primary text-sm">
            Register here
          </LinkButton.Label>
        </LinkButton>
      </View>
      <View className="mb-4 flex-row flex-wrap justify-center px-4">
        <Text className="text-center text-gray-500 text-xs">
          By signing in, you agree to our{" "}
        </Text>
        <LinkButton onPress={() => navigation.navigate("TermsOfUse")}>
          <LinkButton.Label className="text-accent text-xs underline">
            Terms of Use
          </LinkButton.Label>
        </LinkButton>
        <Text className="text-center text-gray-500 text-xs"> and </Text>
        <LinkButton onPress={() => navigation.navigate("PrivacyPolicy")}>
          <LinkButton.Label className="text-accent text-xs underline">
            Privacy Policy
          </LinkButton.Label>
        </LinkButton>
      </View>
    </Screen>
  );
}
