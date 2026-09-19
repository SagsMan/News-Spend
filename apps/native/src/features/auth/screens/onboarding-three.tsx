import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { View } from "react-native";

import { Button } from "#/components/heroui/button";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import { useMarkInteractive } from "#/hooks/useMarkInteractive";

const OnboardingThree = () => {
  const navigation = useNavigation("OnboardingThree");

  useMarkInteractive(true);

  return (
    <Screen
      className="bg-p-50 px-6"
      navigationBarButtonStyle="dark"
      preset="fixed"
      statusBarStyle="dark"
    >
      <View className="flex-1 items-center justify-center">
        <Image
          accessibilityLabel="A person planning a successful future"
          contentFit="contain"
          source={require("#/images/onboarding-3.png")}
          style={{
            width: "100%",
            aspectRatio: 1,
          }}
        />
      </View>

      <View className="items-center gap-3">
        <Text className="text-center text-p-500" variant="HeadingLarge">
          <Text className="text-s-300">Take Control</Text> of your Future
        </Text>
        <Text className="text-center text-gray-50" variant="body">
          Access valuable information, rewarding opportunities and practical
          tools designed to help you make progress and shape a better future.
        </Text>
      </View>

      <View className="gap-6 pb-2 pt-8">
        <View
          accessibilityLabel="Onboarding screen 3 of 3"
          accessibilityRole="progressbar"
          className="flex-row items-center justify-center gap-2"
        >
          <View className="h-2 w-2 rounded-full bg-p-100" />
          <View className="h-2 w-2 rounded-full bg-p-100" />
          <View className="h-2 w-6 rounded-full bg-p-500" />
        </View>

        <View className="gap-3">
          <Button
            className="bg-p-500"
            onPress={() =>
              navigation.navigate("TOS", {
                goto: "SignUp",
              })
            }
            size="lg"
          >
            <Button.Label className="text-p-50">
              Create an Account
            </Button.Label>
          </Button>

          <Button
            onPress={() =>
              navigation.navigate("TOS", {
                goto: "SignIn",
              })
            }
            size="lg"
            variant="outline"
          >
            <Button.Label className="text-p-500">Log In</Button.Label>
          </Button>
        </View>
      </View>
    </Screen>
  );
};

export default OnboardingThree;