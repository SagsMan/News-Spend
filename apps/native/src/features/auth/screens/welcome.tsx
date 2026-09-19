import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { View } from "react-native";
import { Button } from "#/components/heroui/button";
import ConfirmAsGuest from "#/components/heroui/confirm-as-guest";
import { Screen } from "#/components/heroui/screen";
import { useMarkInteractive } from "#/hooks/useMarkInteractive";

const Welcome = () => {
  const navigation = useNavigation("Welcome");

  // Static screen: interactive as soon as it renders.
  useMarkInteractive(true);

  return (
    <Screen className="bg-p-500 px-6" preset="fixed" statusBarStyle="light">
      <View className="flex-2 items-center justify-center">
        <Image
          contentFit="contain"
          source={require("#/images/welcome-logo.png")}
          style={{
            width: 330,
            height: 330,
          }}
        />
      </View>

      <View className="flex-1 gap-4">
        <Button
          animation={{
            highlight: {
              backgroundColor: { value: "#000000" },
              opacity: { value: [0, 0.08] },
            },
          }}
          className="bg-p-50"
          onPress={() =>
            navigation.navigate("TOS", {
              goto: "SignIn",
            })
          }
        >
          <Button.Label className="text-p-500">Sign In</Button.Label>
        </Button>

        <Button
          onPress={() =>
            navigation.navigate("TOS", {
              goto: "SignUp",
            })
          }
          variant="outline"
        >
          <Button.Label className="text-p-50">Create Account</Button.Label>
        </Button>

        <ConfirmAsGuest
          trigger={
            <Button variant="ghost">
              <Button.Label
                className="text-s-300"
                // fontSize="$3" fontWeight="700"
              >
                Continue as a guest
              </Button.Label>
            </Button>
          }
        />
      </View>
    </Screen>
  );
};

export default Welcome;
