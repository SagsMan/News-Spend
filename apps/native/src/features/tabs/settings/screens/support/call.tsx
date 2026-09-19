import { Linking, ScrollView, View } from "react-native";

import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";

const Call = () => (
  <Screen statusBarStyle="light">
    <ScrollView showsVerticalScrollIndicator={false}>
      <View className="gap-4 p-3">
        <Text className="text-base leading-relaxed">
          Please reach out to us at{" "}
          <Text
            className="font-semibold text-blue-500 underline"
            onPress={() => Linking.openURL("tel:+12265073364")}
          >
            +1 (226) 507-3364
          </Text>{" "}
          or{" "}
          <Text
            className="font-semibold text-blue-500 underline"
            onPress={() => Linking.openURL("tel:+2349153849852")}
          >
            +234 915 384 9852
          </Text>{" "}
          and we'll get back to you shortly.
        </Text>
      </View>
    </ScrollView>
  </Screen>
);

export default Call;
