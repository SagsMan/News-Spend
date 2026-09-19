import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Suspense } from "react";
import { View } from "react-native";
import { NavigatorErrorBoundary } from "#/components/ErrorBoundaries/NavigatorErrorBoundary";
import { Text } from "#/components/heroui/text";
import Discover from "#/screens/tabs/discover/DiscoverHome";
import { sharedScreens } from "./shared-screens";

function DiscoverHeader() {
  return (
    <View className="bg-p-500 px-2 pt-safe-offset-1 pb-2">
      <Text className="font-bold text-background text-base uppercase">
        Points Mall
      </Text>
    </View>
  );
}

export default createNativeStackNavigator({
  layout: ({ children, state, descriptors, navigation }) => (
    <NavigatorErrorBoundary>{children}</NavigatorErrorBoundary>
  ),
  screenLayout: ({ children }) => (
    <Suspense fallback={<View style={{ flex: 1 }} />}>{children}</Suspense>
  ),
  screens: {
    DiscoverHome: {
      screen: Discover,
      linking: {
        path: "discover",
      },
      options: {
        animation: "slide_from_right",
        headerShown: true,
        header: DiscoverHeader,
      },
    },
    ...sharedScreens,
  },
  screenOptions: {
    headerShown: false,
    animation: "slide_from_right",
  },
  initialRouteName: "DiscoverHome",
});
