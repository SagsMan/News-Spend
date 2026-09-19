import { Linking, ScrollView, View } from "react-native";

import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";

const Email = () => (
  <Screen statusBarStyle="light">
    <ScrollView showsVerticalScrollIndicator={false}>
      <View className="gap-4 p-3">
        <Text className="text-base leading-relaxed">
          Please email us at{" "}
          <Text
            className="font-semibold text-blue-500 underline"
            onPress={() => Linking.openURL("mailto:support@newspend.com")}
          >
            support@newspend.com
          </Text>{" "}
          and we'll get back to you shortly.
        </Text>
      </View>
    </ScrollView>
  </Screen>
);

export default Email;
