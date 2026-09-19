import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
} from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { differenceInDays } from "date-fns/differenceInDays";
import { differenceInHours } from "date-fns/differenceInHours";
import { differenceInMinutes } from "date-fns/differenceInMinutes";
import { LinkButton } from "heroui-native/link-button";
import { useCallback, useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import { useSnapshot } from "valtio";
import { ScreenHeader } from "#/components";
import { Button } from "#/components/heroui/button";
import { Image } from "#/components/heroui/image";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import { orpc } from "#/lib/orpc";
import { authState } from "#/state/auth";

const MAX_PARTICIPANTS_SHOWN = 20;

const prizes = [
  {
    uri: "https://www.pngall.com/wp-content/uploads/15/Apple-Watch-PNG-Photos.png",
    key: "watch",
  },
  {
    uri: "https://freebiehive.com/wp-content/uploads/2023/07/iphone-14-pro-png.jpg",
    key: "iphone",
  },
  {
    uri: "https://w7.pngwing.com/pngs/263/706/png-transparent-gift-card-business-christmas-gift-gift-miscellaneous-ribbon-rectangle-thumbnail.png",
    key: "gift-card",
  },
  {
    uri: "https://png.pngtree.com/png-vector/20210521/ourmid/pngtree-golden-coins-stacks-lots-money-finance-business-profits-and-wealth-gold-png-image_3327583.jpg",
    key: "coins",
  },
];

const PlayLottery = () => {
  const navigation = useNavigation("PlayLottery");
  const isFocused = useIsFocused();
  const { user } = useSnapshot(authState);
  const isLoggedInNonGuest = !!user && !user.isAnonymous;

  /**
   * The giveaway engine, not the lottery this screen was built for.
   *
   * One participants call replaces the three lottery ticket queries: it
   * returns the entrant count and the recent entrants together, because both
   * come from the same fold over valid tickets and asking twice would count
   * the same rows twice.
   */
  const currentGiveawayQuery = useQuery(
    orpc.giveaway.current.queryOptions({
      refetchInterval: 60_000,
      enabled: isFocused,
    })
  );
  const participantsQuery = useQuery(
    orpc.giveaway.participants.queryOptions({
      refetchInterval: 50_000,
      enabled: isFocused,
    })
  );

  const [now, setNow] = useState(() => new Date());

  useFocusEffect(
    useCallback(() => {
      const interval = setInterval(() => {
        setNow(new Date());
      }, 1000);
      return () => clearInterval(interval);
    }, [])
  );

  const currentGiveaway = currentGiveawayQuery.data;
  const isLoading = currentGiveawayQuery.isLoading;

  /**
   * Whether entries are being taken is the server's judgement, not one made
   * again here: a giveaway can be switched on before its start date, and a
   * button offering entry into one the server would refuse is worse than no
   * button. The countdown below only decides *what* is being counted to.
   */
  const isOpen = currentGiveaway?.isOpen ?? false;
  const hasEnded = currentGiveaway?.state === "closed";

  /**
   * Before it opens, count down to the opening; once open, to the close.
   * Both are UTC instants from the API, so parsing them preserves the offset
   * and the countdown reads the same on a device in any timezone.
   */
  const target = currentGiveaway
    ? new Date(isOpen ? currentGiveaway.endDate : currentGiveaway.startDate)
    : null;

  const daysLeft = target ? differenceInDays(target, now) : 0;
  const hoursLeft = target ? differenceInHours(target, now) % 24 : 0;
  const minutesLeft = target ? differenceInMinutes(target, now) % 60 : 0;

  let timeLeft: string;
  if (isLoading) {
    timeLeft = "Loading...";
  } else if (!currentGiveaway) {
    timeLeft = "No active giveaway";
  } else if (hasEnded) {
    timeLeft = "Ended";
  } else if (daysLeft > 0) {
    timeLeft = `${daysLeft}d ${hoursLeft}h`;
  } else if (hoursLeft > 0) {
    timeLeft = `${hoursLeft}h ${minutesLeft}m`;
  } else {
    timeLeft = `${minutesLeft}m`;
  }

  const showLeftSuffix = !(isLoading || !currentGiveaway || hasEnded);
  const hasActiveLottery = !isLoading && isOpen;
  const enterButtonLabel = isLoading
    ? "Loading..."
    : currentGiveaway
      ? hasEnded
        ? "Giveaway Ended"
        : isOpen
          ? "Enter Giveaway"
          : "Opens Soon"
      : "No Active Giveaway";

  const participants =
    participantsQuery.data?.recent?.slice(0, MAX_PARTICIPANTS_SHOWN) ?? [];

  const onTestLuckPress = () => {
    if (!hasActiveLottery) {
      return;
    }
    if (authState.user && !authState.user.isAnonymous) {
      navigation.navigate("GetTicket");
    } else {
      return navigation.navigate("SignIn", {
        redirect: "PlayLottery",
      });
    }
  };

  return (
    <Screen className="" navigationBarButtonStyle="dark" statusBarStyle="light">
      <ScreenHeader
        right={
          <Text
            className="text-white"
            onPress={() => navigation.navigate("MyPrizes")}
          >
            My Prizes
          </Text>
        }
        title="Giveaway"
      />

      <View className="mb-4 gap-4">
        <View className="gap-2 bg-p-500 px-2 py-2">
          <Text className="text-center text-lg text-p-50">
            Win Dream Points, airtime, data bundles, electronics, and other
            prizes
          </Text>
          <View className="flex-row gap-2">
            {prizes.map((prize, index) => (
              <View
                className="flex-1 border border-gray-400"
                key={prize.key}
                style={{ aspectRatio: 1 }}
              >
                <Image
                  className={index === 0 ? "opacity-60" : ""}
                  contentFit="contain"
                  source={{ uri: prize.uri }}
                  style={{ width: "100%", height: "100%" }}
                />
              </View>
            ))}
          </View>
        </View>

        <View className="items-center justify-center">
          <Text className="font-semibold text-lg">
            Countdown: {timeLeft}
            {showLeftSuffix ? " left" : ""}
          </Text>
          <Text className="text-xl">
            Total Participants:{" "}
            <Text className="font-bold text-s-500">
              {participantsQuery.data?.total ?? 0}
            </Text>
          </Text>
        </View>

        <View className="flex-row flex-wrap justify-center px-4">
          <Text className="text-gray-400 text-xs">
            Not sponsored, endorsed, or administered by{" "}
            {Platform.OS === "ios" ? "Apple Inc." : "Google LLC."}{" "}
          </Text>
          <LinkButton
            onPress={() => navigation.navigate("LotteryRules")}
            size="sm"
          >
            <LinkButton.Label className="text-p-400 text-xs underline">
              See Official Rules
            </LinkButton.Label>
          </LinkButton>
          <Text className="text-gray-400 text-xs">.</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-24"
        showsVerticalScrollIndicator={false}
      >
        {participants.map((item) => (
          <View className="border-gray-100 border-b" key={item.username}>
            <View className="flex-row justify-between gap-1 p-2">
              <Text className="text-p-400">User: {item.username}</Text>
              <Text className="text-s-400">
                entered {item.tickets} ticket{item.tickets > 1 ? "s" : ""}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <Button
        className="absolute right-5 bottom-safe-offset-2 left-5"
        isDisabled={!hasActiveLottery}
        onPress={onTestLuckPress}
      >
        <Button.Label>{enterButtonLabel}</Button.Label>
      </Button>
    </Screen>
  );
};

export default PlayLottery;
