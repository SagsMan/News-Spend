import { useNavigation } from "@react-navigation/native";
import { ScrollView } from "react-native";
import { ScreenHeader } from "#/components";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";

const LotteryRules = () => {
  const _navigation = useNavigation("LotteryRules");

  return (
    <Screen className="pb-safe" statusBarStyle="light">
      <ScreenHeader title="Giveaway Official Rules" />

      <ScrollView contentContainerClassName="gap-4 px-4 py-6">
        <Text>
          1. <Text className="font-semibold">Giveaway Participation.</Text>{" "}
          NewsSpend Giveaways are an optional feature that provide users with an
          additional opportunity to earn rewards and Dream Points that may
          contribute toward their Dream Fulfillment goals.
        </Text>
        <Text>
          2. <Text className="font-semibold">Eligibility.</Text> Giveaways are
          available only in jurisdictions where such promotions are legally
          permitted. By participating, users confirm that they meet the
          eligibility requirements applicable in their jurisdiction.
        </Text>
        <Text>
          3. <Text className="font-semibold">Draw Schedule.</Text> Giveaways are
          conducted bi-weekly. Users can view the time remaining until the next
          draw on the Giveaway screen within the app.
        </Text>
        <Text>
          4. <Text className="font-semibold">How to Participate.</Text> Users
          may redeem Dream Points to obtain Giveaway Tickets. Each Giveaway
          Ticket costs 50 Dream Points. Users may redeem as many tickets as they
          wish, subject to any limits specified for a particular Giveaway.
        </Text>
        <Text>
          5. <Text className="font-semibold">Eligible Dream Points.</Text> Users
          may redeem Dream Points earned within NewsSpend to obtain Giveaway
          Tickets. NewsSpend reserves the right to determine which Dream Point
          activities qualify for Giveaway participation and may modify eligible
          point sources at its discretion.
        </Text>
        <Text>
          6. <Text className="font-semibold">Winner Selection.</Text> Winners
          are selected randomly from all valid entries received during the
          giveaway period. The more Giveaway Tickets a user holds, the greater
          their chances of winning.
        </Text>
        <Text>
          7. <Text className="font-semibold">Prizes.</Text> Available prizes
          will be displayed on the Giveaway page within the app and may include
          Dream Points, airtime, data bundles, promotional merchandise,
          electronics, and other promotional items. Dream Points earned through
          Giveaways may contribute toward Dream Fulfillment goals. NewsSpend
          reserves the right to substitute prizes of equal or greater value
          where necessary.
        </Text>
        <Text>
          8.{" "}
          <Text className="font-semibold">
            Prize Notification and Claiming.
          </Text>{" "}
          Winners will be notified through the NewsSpend app and/or the contact
          details associated with their account. Winners may be required to
          verify their identity or eligibility before receiving a prize. Failure
          to claim a prize within the specified timeframe may result in
          forfeiture and selection of an alternate winner.
        </Text>
        <Text>
          9. <Text className="font-semibold">Non-Refundable Entries.</Text>{" "}
          Dream Points redeemed for Giveaway Tickets are non-refundable,
          non-transferable, and cannot be exchanged for cash.
        </Text>
        <Text>
          10. <Text className="font-semibold">Fair Participation.</Text>{" "}
          NewsSpend reserves the right to investigate suspicious activity and
          disqualify participants who create multiple accounts, attempt to
          manipulate Giveaway outcomes, use automated tools, engage in
          fraudulent activities, or violate NewsSpend's Terms of Service.
        </Text>
        <Text>
          11.{" "}
          <Text className="font-semibold">Modification or Termination.</Text>{" "}
          NewsSpend reserves the right to modify, suspend, or terminate any
          Giveaway at any time due to legal, technical, operational, or business
          reasons.
        </Text>
        <Text>
          12. <Text className="font-semibold">Disclaimer.</Text> NewsSpend
          Giveaways are sponsored and administered solely by NewsSpend.
          Giveaways are not sponsored, endorsed, administered by, or associated
          with Apple Inc., Google LLC, or any advertising network used within
          the NewsSpend application.
        </Text>
        <Text>
          13. <Text className="font-semibold">Acceptance of Rules.</Text> By
          participating in a Giveaway, users acknowledge that they have read,
          understood, and agreed to these Giveaway Rules and NewsSpend's Terms
          of Service.
        </Text>
      </ScrollView>
    </Screen>
  );
};

export default LotteryRules;
