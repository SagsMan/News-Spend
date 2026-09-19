import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Suspense } from "react";
import { Text, View } from "react-native";

import { NavigatorErrorBoundary } from "#/components/ErrorBoundaries/NavigatorErrorBoundary";
import NewsHome from "#/screens/tabs/home/NewsHome";

import { sharedScreens } from "./shared-screens";

const Header = () => (
  <View className="flex-row items-center justify-between bg-p-500 px-2 pt-safe">
    <Text className="font-bold text-background text-base uppercase">
      News Spend Media
    </Text>
  </View>
);

export default createNativeStackNavigator({
  layout: ({ children }) => (
    <NavigatorErrorBoundary>{children}</NavigatorErrorBoundary>
  ),
  screenLayout: ({ children }) => (
    <Suspense fallback={<View style={{ flex: 1 }} />}>{children}</Suspense>
  ),
  screens: {
    NewsHome: {
      screen: NewsHome,
      linking: {
        path: "news",
      },
      options: {
        headerShown: true,
        animation: "slide_from_right",
        header: Header,
      },
    },
    ...sharedScreens,
  },
  screenOptions: {
    headerShown: false,
    animation: "slide_from_right",
  },
  initialRouteName: "NewsHome",
});
