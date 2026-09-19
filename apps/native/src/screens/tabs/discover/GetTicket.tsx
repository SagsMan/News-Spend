import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Card } from "heroui-native/card";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { MinusCircleIcon, PlusCircleIcon } from "#/lib/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { NativeAd } from "react-native-google-mobile-ads";

import { ScreenHeader } from "#/components";
import { DialogWithAd } from "#/components/discover/DialogWithAd";
import { Button } from "#/components/heroui/button";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import { initializeAdsWhenPermitted } from "#/lib/adsInit";
import { adUnits } from "#/lib/adUnits";
import { orpc } from "#/lib/orpc";

const GetTicket = () => {
  const navigation = useNavigation("GetTicket");
  const [value, setValue] = useState(0);
  const [open, setOpen] = useState(false);
  const [preloadedNativeAd, setPreloadedNativeAd] = useState<NativeAd | null>(
    null
  );
  const decrementIntervalRef = useRef<NodeJS.Timeout>();
  const incrementIntervalRef = useRef<NodeJS.Timeout>();

  const totalPoints = useQuery(orpc.activity.totalPoints.queryOptions());
  // The giveaway engine, not the lottery this screen was built for.
  const { data: currentLottery, isPending: isLotteryPending } = useQuery(
    orpc.giveaway.current.queryOptions()
  );
  /**
   * Entries are only taken while the server says the window is open. A
   * giveaway switched on ahead of its start date is returned by `current` so
   * the home screen can count down to it, but buying into it here would be
   * refused, so this screen treats it as not yet enterable.
   */
  const isOpen = currentLottery?.isOpen ?? false;
  const hasActiveLottery = !isLotteryPending && isOpen;

  // Preload native ad on mount
  useEffect(() => {
    initializeAdsWhenPermitted()
      .then(() => NativeAd.createForAdRequest(adUnits.native))
      .then(setPreloadedNativeAd)
      .catch(() => {
        // Silently fail - dialog will show custom ad fallback
      });
  }, []);

  useFocusEffect(
    useCallback(
      () => () => {
        setValue(0);
      },
      []
    )
  );

  const onTicketPress = () => {
    if (!hasActiveLottery) {
      if (currentLottery?.state === "pending") {
        Alert.alert(
          "Not Open Yet",
          "This giveaway hasn't opened yet. Check back when it starts!"
        );
      } else {
        Alert.alert(
          "No Active Giveaway",
          "There's no giveaway running right now. Check back soon!"
        );
      }
      return;
    }
    if (
      (totalPoints?.data ?? 0) >=
      value * (currentLottery?.ticketPrice ?? 0)
    ) {
      setOpen(true);
    } else {
      Alert.alert(
        "Not enough points",
        `You don't have enough Dream Points to enter the Giveaway with ${value} ticket${value > 1 ? "s" : ""}. You currently have ${totalPoints.data} Dream Points.`
      );
    }
  };

  return (
    <Screen className="bg-p-300" statusBarStyle="light">
      <ScreenHeader
        className="bg-p-300"
        right={
          <Text
            className="text-white"
            onPress={() => navigation.navigate("LotteryRules")}
          >
            Rules
          </Text>
        }
        title="Get Giveaway Entries"
      />

      <View className="gap-5 px-4">
        <View className="gap-4">
          <Text className="text-center text-s-50 text-xl">
            Win Dream Points, airtime, data bundles, and other prizes
          </Text>

          <Card className="mx-2 rounded-xl bg-s-300 px-6">
            <Card.Body className="p-0 pt-3">
              {/*
                Named by the giveaway itself, or not at all.

                This used to fall back to a date derived from the lottery's
                fixed fortnightly cadence, which the giveaway engine replaced:
                a giveaway's window is set per giveaway by an administrator, so
                a locally computed Monday named a period that did not exist.
              */}
              <Text className="text-center text-p-400">
                {currentLottery?.name
                  ? `The ${currentLottery.name} game`
                  : "Giveaway entries"}
              </Text>
            </Card.Body>

            {/* Counter + Go button */}
            <View className="my-3 flex-row items-center">
              <View className="flex min-h-12.5 flex-1 flex-row items-center justify-center rounded-l-full border border-p-400 border-r-0">
                <PressableFeedback
                  className="w-11 items-center justify-center"
                  isDisabled={value === 0}
                  onLongPress={() => {
                    const id = setInterval(() => {
                      setValue((v) => {
                        if (v <= 0) {
                          clearInterval(id);
                          return 0;
                        }
                        return v - 1;
                      });
                    }, 200);
                    decrementIntervalRef.current = id;
                  }}
                  onPress={() => setValue((v) => Math.max(0, v - 1))}
                  onPressOut={() => {
                    clearInterval(decrementIntervalRef.current);
                  }}
                >
                  <MinusCircleIcon color="#1a1a2e" size={20} />
                </PressableFeedback>

                <View className="flex-row items-center">
                  <Text className="min-w-8.5 px-2 text-center font-medium text-xl">
                    {value}
                  </Text>
                  <Text className="text-gray-50 text-sm">Tickets</Text>
                </View>

                <PressableFeedback
                  className="w-11 items-center justify-center"
                  isDisabled={value >= 100}
                  onLongPress={() => {
                    const id = setInterval(() => {
                      setValue((v) => {
                        if (v >= 100) {
                          clearInterval(id);
                          return 100;
                        }
                        return v + 1;
                      });
                    }, 200);
                    incrementIntervalRef.current = id;
                  }}
                  onPress={() => setValue((v) => Math.min(100, v + 1))}
                  onPressOut={() => {
                    clearInterval(incrementIntervalRef.current);
                  }}
                >
                  <PlusCircleIcon color="#1a1a2e" size={20} />
                </PressableFeedback>
              </View>

              <Button
                className="h-12.5 w-22 rounded-r-full rounded-l-none border border-p-400 border-l-0"
                isDisabled={
                  value <= 0 || totalPoints.isPending || !hasActiveLottery
                }
                onPress={onTicketPress}
              >
                <Button.Label>Go</Button.Label>
              </Button>
            </View>

            <Card.Footer className="p-0 pb-3">
              <View className="flex flex-1 flex-row justify-center gap-2">
                {isLotteryPending || hasActiveLottery ? (
                  <Text className="text-p-400">
                    Required points:{" "}
                    {value * (currentLottery?.ticketPrice ?? 0)} points
                  </Text>
                ) : (
                  <Text className="text-danger">
                    {currentLottery?.state === "pending"
                      ? "This giveaway hasn't opened yet."
                      : "There's no giveaway running right now."}
                  </Text>
                )}
              </View>
            </Card.Footer>
          </Card>
        </View>

        {/* The price is per giveaway and set by an administrator, so it is
            read rather than stated: the copy said 50 while the giveaway
            charged 100, which is the sort of thing people notice only after
            their points have gone. */}
        <Text className="mt-2 text-[15px] text-p-50">
          Each Giveaway Ticket costs {currentLottery?.ticketPrice ?? 0} Dream
          Points. The more tickets you hold, the greater your chance of winning.
        </Text>
      </View>

      <DialogWithAd
        open={open}
        preloadedNativeAd={preloadedNativeAd}
        purchasedTickets={value}
        setOpen={setOpen}
      />
    </Screen>
  );
};

export default GetTicket;
