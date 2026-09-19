import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigation } from "@react-navigation/native";
import { Checkbox } from "heroui-native/checkbox";
import { ControlField } from "heroui-native/control-field";
import { Spinner } from "heroui-native/spinner";
import {
  Controller,
  FormProvider,
  type SubmitHandler,
  useForm,
} from "react-hook-form";
import { Pressable, View } from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardController,
} from "react-native-keyboard-controller";
import * as z from "zod";
import { Button } from "#/components/heroui/button";
import { Icon } from "#/components/heroui/icon";
import { Screen } from "#/components/heroui/screen";
import { FormSelectField } from "#/components/heroui/select";
import { StandardItem } from "#/components/heroui/select-item";
import { Text } from "#/components/heroui/text";
import FormInput from "#/components/heroui/text-input";
import { toast } from "#/components/heroui/toast";
import { ArrowLeftIcon } from "#/lib/icons";
import useSignUp from "../hooks/useSignUp";

const schema = z.object({
  name: z
    .string("Please enter your name")
    .trim()
    .min(3, "Name must be at least 3 characters")
    .max(30, "Name must not exceed 30 characters"),
  email: z
    .string("Enter a valid email address")
    .trim()
    .toLowerCase()
    .check(z.email("Invalid email address")),
  password: z
    .string("Please enter a password")
    .min(8, "Password must be at least 8 characters"),
  username: z
    .string("Please enter a username")
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must not exceed 30 characters")
    .trim()
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers and underscores"
    ),
  wish: z.object(
    {
      label: z.string(),
      value: z.string("Select your wish"),
    },
    "Select your wish"
  ),
  agreeToTerms: z
    .boolean("You must agree to the Terms of Use and Privacy Policy")
    .refine(
      (val) => val === true,
      "You must agree to the Terms of Use and Privacy Policy"
    ),
});

const defaultValues = {
  name: "rick",
  email: "rickpd@hotmai.red",
  password: "123456qwerty",
  username: "ricky",
};

export type SignUpInput = z.input<typeof schema>;

export default function SignUp() {
  const navigation = useNavigation("SignUp");
  const signUpMutation = useSignUp();

  const formMethods = useForm<SignUpInput>({
    resolver: zodResolver(schema),
    defaultValues: __DEV__ ? defaultValues : undefined,
  });

  const onSubmit: SubmitHandler<SignUpInput> = (input) => {
    KeyboardController.dismiss();
    const { wish, ...rest } = input;

    signUpMutation.mutate(
      {
        ...rest,
        wish: wish.value,
      },
      {
        onSuccess({ data, error }) {
          if (!error) {
            navigation.navigate("Verification", {
              email: input.email,
              otpSent: true,
            });
          }

          if (error) {
            if (error.message?.endsWith("email already exists")) {
              return formMethods.setError("email", {
                type: "server",
                message: error.message,
              });
            }

            if (
              error.code === "VALIDATION_FAILED" &&
              // @ts-expect-error
              error.cause?.name === "ZodError"
            ) {
              // @ts-expect-error
              for (const issue of error.issues) {
                const fieldName = issue.path[0] as keyof SignUpInput;

                formMethods.setError(fieldName, {
                  type: "server",
                  message: issue.message,
                });
              }

              return;
            }

            toast.error("Sign Up Failed", {
              description: "Please check your information and try again",
            });
          }
        },
        onError(_error) {
          toast.error("Sign Up Failed", {
            description:
              "Something went wrong. Please check your connection and try again.",
          });
        },
      }
    );
  };

  return (
    <Screen preset="fixed" safeAreaEdges={["top"]}>
      <KeyboardAwareScrollView
        className="px-3"
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
        <Pressable hitSlop={10} onPress={() => navigation.goBack()}>
          <Icon className="size-6" name={ArrowLeftIcon} />
        </Pressable>
        <Text className="mt-5 mb-8 text-center font-bold text-2xl">
          Create Account
        </Text>
        <View className="flex-col gap-9">
          <FormProvider {...formMethods}>
            <View className="flex-col gap-4">
              <FormInput
                name="name"
                placeholder="First Name"
                textContentType="name"
              />
              <FormInput
                name="username"
                placeholder="Username"
                textContentType="username"
              />
              <FormInput
                autoCapitalize="none"
                keyboardType="email-address"
                name="email"
                placeholder="Email"
                textContentType="emailAddress"
              />
              <FormInput isPassword name="password" placeholder="Password" />

              <FormSelectField
                name="wish"
                options={options}
                placeholder="Make a wish"
                renderItem={(option, { isSelected }) => (
                  <StandardItem isSelected={isSelected} label={option.label} />
                )}
                scrollable
              />

              <Controller
                control={formMethods.control}
                name="agreeToTerms"
                render={({
                  field: { onChange, value },
                  fieldState: { error, invalid },
                }) => (
                  <ControlField
                    className="flex-col items-start"
                    isInvalid={invalid}
                    isSelected={value}
                    onSelectedChange={onChange}
                  >
                    <View className="flex-row items-center gap-2">
                      <ControlField.Indicator>
                        <Checkbox className="mt-0.5 rounded-sm border border-field-border" />
                      </ControlField.Indicator>
                      <View className="flex-1 flex-row flex-wrap">
                        <Text className="text-sm">I agree to the </Text>
                        <Button
                          className="p-0"
                          onPress={() => navigation.navigate("TermsOfUse")}
                          size="sm"
                          variant="ghost"
                        >
                          <Button.Label className="text-accent text-sm underline">
                            Terms of Use
                          </Button.Label>
                        </Button>
                        <Text className="text-sm"> and </Text>
                        <Button
                          className="p-0"
                          onPress={() => navigation.navigate("PrivacyPolicy")}
                          size="sm"
                          variant="ghost"
                        >
                          <Button.Label className="text-accent text-sm underline">
                            Privacy Policy
                          </Button.Label>
                        </Button>
                      </View>
                    </View>
                    {error && (
                      <Text className="ml-8 text-destructive text-sm">
                        {error.message}
                      </Text>
                    )}
                  </ControlField>
                )}
              />
            </View>
          </FormProvider>
          <Button
            isDisabled={signUpMutation.isPending}
            onPress={formMethods.handleSubmit(onSubmit)}
          >
            {signUpMutation.isPending ? <Spinner /> : null}
            <Button.Label>Submit</Button.Label>
          </Button>
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const options = [
  { label: "I want business capital", value: "I want business capital" },
  { label: "I want to relocate abroad", value: "I want to relocate abroad" },
  { label: "Vacation expenses paid", value: "Vacation expenses paid" },
  { label: "I want business partner", value: "I want business partner" },
  { label: "Oversea study scholarship", value: "Oversea study scholarship" },
  {
    label: "An all expense-paid vacation to your dream destination",
    value: "An all expense-paid vacation to your dream destination",
  },
  {
    label: "A brand-new laptop for work or study",
    value: "A brand-new laptop for work or study",
  },
  {
    label: "Visa application assistance",
    value: "Visa application assistance",
  },
  {
    label: "Business capital to kickstart or expand business",
    value: "Business capital to kickstart or expand business",
  },
  { label: "Study abroad scholarship", value: "Study abroad scholarship" },
  {
    label: "A fully-funded online tech skills program",
    value: "A fully-funded online tech skills program",
  },
  {
    label: "Free groceries for an entire month",
    value: "Free groceries for an entire month",
  },
  {
    label: "Rent support for a whole year",
    value: "Rent support for a whole year",
  },
  {
    label: "An exciting shopping spree experience",
    value: "An exciting shopping spree experience",
  },
  {
    label: "Seed funding to launch your startup",
    value: "Seed funding to launch your startup",
  },
  {
    label: "Comprehensive health insurance coverage",
    value: "Comprehensive health insurance coverage",
  },
  {
    label: "Assistance with paying off outstanding debts",
    value: "Assistance with paying off outstanding debts",
  },
  {
    label: "6 month paid gym membership",
    value: "6 month paid gym membership",
  },
  {
    label: "A complete home makeover/ furnishing package",
    value: "A complete home makeover/ furnishing package",
  },
];
