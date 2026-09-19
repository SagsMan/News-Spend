import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { View } from "react-native";

import { Button } from "#/components/heroui/button";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import { useMarkInteractive } from "#/hooks/useMarkInteractive";

const OnboardingTwo = () => {
  const navigation = useNavigation("OnboardingTwo");

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
          accessibilityLabel="People turning everyday engagement into rewards"
          contentFit="contain"
          source={require("#/images/onboarding-2.png")}
          style={{
            width: "100%",
            aspectRatio: 1,
          }}
        />
      </View>

      <View className="items-center gap-3">
        <Text className="text-center text-p-500" variant="HeadingLarge">
          Meet Today’s Needs.{" "}
          <Text className="text-s-300">Build Tomorrow’s Dreams</Text>.
        </Text>
        <Text className="text-center text-gray-50" variant="body">
          Turn your everyday engagement into rewards that support your basic
          needs and bring your biggest aspirations within reach.
        </Text>
      </View>

      <View className="gap-6 pb-2 pt-8">
        <View
          accessibilityLabel="Onboarding screen 2 of 3"
          accessibilityRole="progressbar"
          className="flex-row items-center justify-center gap-2"
        >
          <View className="h-2 w-2 rounded-full bg-p-100" />
          <View className="h-2 w-6 rounded-full bg-p-500" />
          <View className="h-2 w-2 rounded-full bg-p-100" />
        </View>

        <Button
          className="bg-p-500"
          onPress={() => navigation.replace("OnboardingThree")}
          size="lg"
        >
          <Button.Label className="text-p-50">Continue</Button.Label>
        </Button>
      </View>
    </Screen>
  );
};

export default OnboardingTwo;