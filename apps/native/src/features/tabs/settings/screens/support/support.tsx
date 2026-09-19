import { useNavigation } from "@react-navigation/native";
import { ListGroup } from "heroui-native/list-group";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { Separator } from "heroui-native/separator";
import { ScrollView, View } from "react-native";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";

const options: {
  title: string;
  screen: any;
}[] = [
  {
    title: "Community Guidelines",
    screen: "CommunityGuidelines",
  },
  {
    title: "Frequently Asked Questions",
    screen: "FAQ",
  },
  {
    title: "Email Customer Support",
    screen: "Email",
  },
  {
    title: "Submit Feedback",
    screen: "Feedback",
  },
  {
    title: "Inquire about Advertising",
    screen: "Advertise",
  },
  {
    title: "Call Us",
    screen: "Call",
  },
];

const Support = () => {
  const navigation = useNavigation();

  return (
    <Screen statusBarStyle="light">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="items-center px-4 py-4">
          <Text className="font-semibold text-lg">
            Tell us how we can help you
          </Text>
          <Text className="mt-1 text-center text-muted-foreground">
            Our team is always on hand to help you with any questions or queries
          </Text>
        </View>

        <ListGroup variant="transparent">
          {options.map((item, index) => (
            <View key={item.title}>
              <PressableFeedback
                animation={false}
                onPress={() => navigation.navigate(item.screen, {})}
              >
                <PressableFeedback.Scale>
                  <ListGroup.Item disabled>
                    <ListGroup.ItemContent>
                      <ListGroup.ItemTitle>{item.title}</ListGroup.ItemTitle>
                    </ListGroup.ItemContent>
                    <ListGroup.ItemSuffix />
                  </ListGroup.Item>
                </PressableFeedback.Scale>
                <PressableFeedback.Ripple />
              </PressableFeedback>
              {index < options.length - 1 && <Separator className="mx-4" />}
            </View>
          ))}
        </ListGroup>
      </ScrollView>
    </Screen>
  );
};

export default Support;
