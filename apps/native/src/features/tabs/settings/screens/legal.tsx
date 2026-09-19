import { useNavigation } from "@react-navigation/native";
import { ListGroup } from "heroui-native/list-group";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { Separator } from "heroui-native/separator";
import { Screen } from "#/components/heroui/screen";

export default function LegalAgreement() {
  const navigation = useNavigation("Legal");

  return (
    <Screen statusBarStyle="light">
      <ListGroup variant="transparent">
        <PressableFeedback
          animation={false}
          onPress={() => navigation.navigate("TermsOfUse")}
        >
          <PressableFeedback.Scale>
            <ListGroup.Item disabled>
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>Terms of Use</ListGroup.ItemTitle>
              </ListGroup.ItemContent>
              <ListGroup.ItemSuffix />
            </ListGroup.Item>
          </PressableFeedback.Scale>
          <PressableFeedback.Ripple />
        </PressableFeedback>

        <Separator className="mx-4" />

        <PressableFeedback
          animation={false}
          onPress={() => navigation.navigate("PrivacyPolicy")}
        >
          <PressableFeedback.Scale>
            <ListGroup.Item disabled>
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>Privacy Policy</ListGroup.ItemTitle>
              </ListGroup.ItemContent>
              <ListGroup.ItemSuffix />
            </ListGroup.Item>
          </PressableFeedback.Scale>
          <PressableFeedback.Ripple />
        </PressableFeedback>

        <Separator className="mx-4" />

        <PressableFeedback
          animation={false}
          onPress={() => navigation.navigate("LotteryRules")}
        >
          <PressableFeedback.Scale>
            <ListGroup.Item disabled>
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>
                  Giveaway Official Rules
                </ListGroup.ItemTitle>
              </ListGroup.ItemContent>
              <ListGroup.ItemSuffix />
            </ListGroup.Item>
          </PressableFeedback.Scale>
          <PressableFeedback.Ripple />
        </PressableFeedback>
      </ListGroup>
    </Screen>
  );
}
