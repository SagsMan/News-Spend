import { useNavigation } from "@react-navigation/native";
import { View } from "react-native";

import { Button } from "#/components/heroui/button";
import { Text } from "#/components/heroui/text";

const NotFound = () => {
  const navigation = useNavigation();

  const onGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("Tab", {
        screen: "Home",
      });
    }
  };

  return (
    <View className="flex-1 items-center justify-center">
      <Text variant="HeadingLarge">Page not found</Text>
      <Button className="mt-4" onPress={onGoBack}>
        <Button.Label>
          {navigation.canGoBack() ? "Go back" : "Go home"}
        </Button.Label>
      </Button>
    </View>
  );
};

export default NotFound;
