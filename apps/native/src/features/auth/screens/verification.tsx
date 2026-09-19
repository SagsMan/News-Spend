import { useNavigation, useRoute } from "@react-navigation/native";
import { InputOTP, REGEXP_ONLY_DIGITS } from "heroui-native/input-otp";
import { Spinner } from "heroui-native/spinner";
import { ArrowLeftIcon } from "#/lib/icons";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useKeyboardState } from "react-native-keyboard-controller";
import { Button } from "#/components/heroui/button";
import { Icon } from "#/components/heroui/icon";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import { toast } from "#/components/heroui/toast";
import { useSendOtp, useVerifyOTP } from "../hooks/useOTP";

export default function Verification() {
  const route = useRoute("Verification");
  const [value, setValue] = useState("");
  const _isOpen = useKeyboardState((v) => v.isVisible);
  const navigation = useNavigation("Verification");
  const sendOTPMutation = useSendOtp();
  const verifyOTPMutation = useVerifyOTP();
  const { email, otpSent = false } = route.params as {
    email?: string;
    otpSent?: boolean;
  };
  const otpSentRef = useRef(false);

  useEffect(() => {
    if (email && !otpSent && !otpSentRef.current) {
      otpSentRef.current = true;
      sendOTPMutation.mutate({ email });
    }
  }, [email, otpSent, sendOTPMutation.mutate]);

  const verifyOTP = () => {
    verifyOTPMutation.mutate(
      {
        otp: value,
        email: email || "",
      },
      {
        onSuccess({ data, error }) {
          if (error) {
            if (error.code === "INVALID_OTP") {
              return toast.error("Invalid verification code", {
                description:
                  "The code you entered is incorrect. Please check the code and try again.",
              });
            }
            let errorMsg = "Something went wrong. Please try again.";
            if (error.code === "TOO_MANY_ATTEMPTS") {
              errorMsg =
                "Too many incorrect attempts. Please wait a few minutes before trying again.";
            } else if (error.message) {
              errorMsg = error.message;
            }
            return toast.error("Verification Error", {
              description: errorMsg,
            });
          }

          toast("Success", {
            description: "Account verified successfully",
          });
          navigation.navigate("RegSuccess");
        },
        onError(_err) {
          toast.error("Verification failed", {
            description:
              "We couldn't verify your code. Please check the code and try again.",
          });
        },
      }
    );
  };

  const sendOTP = () => {
    sendOTPMutation.mutate(
      { email: email || "" },
      {
        onSuccess({ data, error }) {
          if (error) {
            return toast.error("Failed to resend code", {
              description:
                "We couldn't send a new verification code. Please check your internet connection and try again.",
            });
          }
          toast("Success", {
            description: "Code sent successfully",
          });
        },
        onError(_err) {
          toast.error("Failed to resend code", {
            description:
              "We couldn't send a new verification code. Please check your internet connection and try again.",
          });
        },
      }
    );
  };

  return (
    <Screen className="px-6 pt-safe-offset-5" safeAreaEdges={["bottom"]}>
      <Pressable onPress={() => navigation.goBack()}>
        <Icon className="size-6" name={ArrowLeftIcon} />
      </Pressable>

      <View className="mt-8 flex-1 gap-11">
        <View className="gap-5">
          <Text className="text-center font-bold text-2xl">
            Verification Code
          </Text>
          <Text className="text-center text-gray-500 text-lg">
            Please enter the verification code sent to{" "}
            <Text className="text-black">{email ?? ""}</Text>
          </Text>
          <InputOTP
            className="justify-center"
            inputMode="numeric"
            maxLength={CELL_COUNT}
            onChange={setValue}
            pattern={REGEXP_ONLY_DIGITS}
            textInputProps={{ textContentType: "oneTimeCode" }}
            value={value}
          >
            <InputOTP.Group className="gap-4">
              <InputOTP.Slot className="h-14 w-14 rounded-lg" index={0} />
              <InputOTP.Slot className="h-14 w-14 rounded-lg" index={1} />
              <InputOTP.Slot className="h-14 w-14 rounded-lg" index={2} />
              <InputOTP.Slot className="h-14 w-14 rounded-lg" index={3} />
            </InputOTP.Group>
          </InputOTP>
        </View>
        <View className="items-center gap-1">
          <Text>Didn't receive the code? </Text>
          <Button
            isDisabled={
              verifyOTPMutation.isPending || sendOTPMutation.isPending
            }
            onPress={sendOTP}
            variant="ghost"
          >
            {sendOTPMutation.isPending ? <Spinner /> : null}
            <Button.Label className="font-bold text-primary">
              Resend OTP?
            </Button.Label>
          </Button>
        </View>
      </View>
      <Button
        className="mb-6"
        isDisabled={
          sendOTPMutation.isPending ||
          value.length !== CELL_COUNT ||
          verifyOTPMutation.isPending
        }
        onPress={verifyOTP}
      >
        {verifyOTPMutation.isPending ? <Spinner /> : null}
        <Button.Label>Submit</Button.Label>
      </Button>
    </Screen>
  );
}

const CELL_COUNT = 4;
