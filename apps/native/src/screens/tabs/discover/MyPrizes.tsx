import { LegendList } from "@legendapp/list/react-native";
import { useNavigation } from "@react-navigation/native";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { format } from "date-fns/format";
import { formatDistanceToNowStrict } from "date-fns/formatDistanceToNowStrict";
import { Card } from "heroui-native/card";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { cn } from "heroui-native/utils";
import {
  CaretRightIcon,
  CoinsIcon,
  DeviceMobileIcon,
  GiftIcon,
  PackageIcon,
  TicketIcon,
} from "#/lib/icons";
import { ActivityIndicator, RefreshControl, View } from "react-native";
import { ScreenHeader } from "#/components";
import { Icon } from "#/components/heroui/icon";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import { orpc } from "#/lib/orpc";

type Winning = {
  id: string;
  prizeName: string;
  tier: string;
  fulfilmentType: string;
  claimStatus: string;
  fulfilmentStatus: string;
  claimable: boolean;
  closedReason: string | null;
  closedMessage: string | null;
  underReview: boolean;
  awaitingVerification: boolean;
  claimDeadline: string | null;
  selectedAt: string | null;
};

/**
 * A short line telling the winner what, if anything, is theirs to do.
 *
 * Deliberately distinguishes "we are checking you" from "you have a step
 * left". They look the same in the data (both stop a dispatch) but mean
 * opposite things to the person reading them.
 */
function statusLine(prize: Winning): { label: string; tone: string } {
  if (prize.claimStatus === "expired") {
    return {
      label: prize.closedMessage ?? "Claim window closed",
      tone: "muted",
    };
  }
  if (prize.claimStatus === "disqualified") {
    return { label: "No longer valid", tone: "muted" };
  }
  if (prize.claimStatus === "unclaimed" && !prize.claimable) {
    return {
      label: prize.closedMessage ?? "No longer claimable",
      tone: "muted",
    };
  }
  if (prize.claimStatus === "unclaimed") {
    const deadline = prize.claimDeadline
      ? `Claim within ${formatDistanceToNowStrict(new Date(prize.claimDeadline))}`
      : "Ready to claim";
    return { label: deadline, tone: "urgent" };
  }
  if (prize.underReview) {
    return { label: "Under review. Nothing needed from you", tone: "muted" };
  }
  if (prize.awaitingVerification) {
    return { label: "Verify your identity to receive this", tone: "urgent" };
  }
  /**
   * Claimed is not delivered, and saying so was actively misleading.
   *
   * Airtime and data are dispatched by an hourly sweep, so a prize sits
   * queued for up to an hour before anything is even attempted, and a
   * retryable failure returns it to that queue. Every one of those states
   * used to render as a green "Claimed", so the commonest failure there is,
   * a mistyped phone number, looked identical to success until the third
   * attempt gave up and flipped it to review.
   */
  if (
    prize.claimStatus === "claimed" &&
    prize.fulfilmentStatus !== "fulfilled"
  ) {
    return {
      label:
        prize.fulfilmentStatus === "in_progress"
          ? "Sending now"
          : "Processing: we're sending it",
      tone: "muted",
    };
  }
  if (prize.claimStatus === "claimed") {
    const on = prize.selectedAt
      ? ` · ${format(new Date(prize.selectedAt), "d MMM")}`
      : "";
    // What "done" means depends on how it was delivered.
    const verb =
      prize.fulfilmentType === "points"
        ? "Credited"
        : prize.fulfilmentType === "physical"
          ? "Dispatched"
          : "Sent";
    return { label: `${verb}${on}`, tone: "good" };
  }
  return { label: prize.claimStatus, tone: "muted" };
}

const TONE_CLASS: Record<string, string> = {
  urgent: "text-p-500 font-semibold",
  good: "text-green-600",
  muted: "text-subtle-text",
};

/**
 * An icon per kind of prize, so a list of names reads as a list of things.
 *
 * Airtime and data share the phone: the distinction that matters to somebody
 * scanning this list is "it arrives on my line", not which of the two it is.
 * The name already says that.
 */
const PRIZE_ICON: Record<string, typeof GiftIcon> = {
  points: CoinsIcon,
  airtime: DeviceMobileIcon,
  data: DeviceMobileIcon,
  gift_card: GiftIcon,
  physical: PackageIcon,
  experience: TicketIcon,
};

/** The icon well's colouring, which carries the same meaning as the status. */
const WELL_CLASS: Record<string, string> = {
  urgent: "bg-p-500/10",
  good: "bg-green-600/10",
  muted: "bg-muted/30",
};

const WELL_ICON_CLASS: Record<string, string> = {
  urgent: "text-p-500",
  good: "text-green-600",
  muted: "text-subtle-text",
};

function PrizeCard({
  prize,
  compact,
  onPress,
}: {
  prize: Winning;
  compact?: boolean;
  onPress: () => void;
}) {
  const status = statusLine(prize);
  const PrizeIcon = PRIZE_ICON[prize.fulfilmentType] ?? GiftIcon;

  return (
    <PressableFeedback onPress={onPress}>
      {/* A claimable prize gets a coloured border. It is the only thing here
          on a clock, and a row of identical cards gives no clue which one
          that is. */}
      <Card
        className={cn(
          prize.claimable ? "border-s-400" : "border-gray-400",
          "rounded-xl border"
        )}
        // variant="transparent"
      >
        <Card.Body
          className={cn(
            "flex-row items-center gap-3",
            compact && "gap-2.5 py-2.5"
          )}
        >
          <View
            className={cn(
              "items-center justify-center rounded-xl",
              compact ? "size-9" : "size-11",
              WELL_CLASS[status.tone]
            )}
          >
            <Icon
              className={WELL_ICON_CLASS[status.tone]}
              name={PrizeIcon}
              size={compact ? 17 : 21}
            />
          </View>

          <View className="flex-1 gap-0.5">
            <Text
              className={cn(
                "font-semibold text-base",
                compact && "text-sm",
                // A closed or invalid prize greys out entirely rather than
                // being dimmed as a whole card, so the ones still worth
                // reading stay at full contrast next to it.
                status.tone === "muted" && "text-subtle-text"
              )}
            >
              {prize.prizeName}
            </Text>
            <Text
              className={cn("text-xs", TONE_CLASS[status.tone])}
              numberOfLines={2}
            >
              {status.label}
            </Text>
          </View>

          {/* Every card opens something now: the claimable one opens its claim, and the
              rest open their record, so every card carries an affordance. */}
          {prize.claimable ? (
            <View className="rounded-full bg-s-400 px-3 py-1">
              <Text className="font-semibold text-white text-xs">Claim</Text>
            </View>
          ) : (
            <Icon
              className="text-subtle-text"
              name={CaretRightIcon}
              size={18}
            />
          )}
        </Card.Body>
      </Card>
    </PressableFeedback>
  );
}

/**
 * Everything this user has won, and what is left to do about it.
 *
 * Split into two lists rather than one, because they behave differently.
 * "Needs You" is bounded by each prize's own claim window (fourteen days, or
 * until the next giveaway starts), so it can never grow past a handful and is
 * fetched whole. "History" is everything that has already resolved, which
 * only ever grows, so it is the one that is paged.
 *
 * This screen exists because a win used to live only inside a transient
 * dialog: dismiss it and there was nowhere to go. With a window that closes
 * on its own, a prize with no permanent home is a prize people lose.
 */
const MyPrizes = () => {
  const navigation = useNavigation("MyPrizes");

  const needsYou = useQuery(orpc.giveaway.actionable.queryOptions());

  const {
    data,
    isPending: isHistoryPending,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(
    orpc.giveaway.history.infiniteOptions({
      input: (page: number | undefined) => ({ page: page ?? 1 }),
      initialPageParam: 1,
      getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    })
  );

  const history = (data?.pages.flatMap((p) => p.items) ?? []) as Winning[];
  const isPending = needsYou.isPending || isHistoryPending;

  if (isPending) {
    return (
      <Screen>
        <ScreenHeader title="My Prizes" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  /**
   * A prize awaiting verification has already been claimed; the clock is
   * stopped and there is nothing left to claim. Sending it to ClaimPrize
   * would ask the winner to repeat a step they have finished; what it is
   * actually waiting on is their identity.
   */
  const openClaim = (prize: Winning) =>
    prize.awaitingVerification
      ? navigation.navigate("IdentityVerification")
      : navigation.navigate("ClaimPrize", { winnerId: prize.id });

  /**
   * A prize with something to do opens that thing; everything else opens its
   * record.
   *
   * Claiming stays one tap: it is the only part on a clock. A finished prize
   * used to be inert here, which left a winner whose airtime had not arrived
   * with "fulfilled" and no way to see the number it was sent to.
   */
  const openPrize = (prize: Winning) =>
    prize.claimable || prize.awaitingVerification
      ? openClaim(prize)
      : navigation.navigate("PrizeDetails", { winnerId: prize.id });

  const actionablePrizes = (needsYou.data ?? []) as Winning[];
  const isEmpty = actionablePrizes.length === 0 && history.length === 0;

  return (
    <Screen statusBarStyle="light">
      <ScreenHeader title="My Prizes" />

      <LegendList
        contentContainerClassName="gap-2 px-4 py-8"
        data={isEmpty ? [] : history}
        keyExtractor={(prize) => prize.id}
        ListEmptyComponent={
          <View className="items-center gap-2 px-6 py-16">
            <Icon color="#94a3b8" name={GiftIcon} size={40} />
            <Text className="text-center font-semibold text-lg">
              No prizes yet
            </Text>
            <Text className="text-center text-subtle-text">
              Buy a ticket to enter the current giveaway. Anything you win will
              appear here.
            </Text>
          </View>
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="py-4">
              <ActivityIndicator />
            </View>
          ) : null
        }
        ListHeaderComponent={
          isEmpty ? null : (
            <View className="gap-2">
              {actionablePrizes.length > 0 && (
                <View className="gap-2 pb-4">
                  <View className="flex-row items-center gap-2">
                    <Text className="font-semibold text-subtle-text text-xs tracking-wide">
                      NEEDS YOU
                    </Text>
                    <View className="rounded-full bg-s-500 px-2 py-0.5">
                      <Text className="font-semibold text-white text-xs">
                        {actionablePrizes.length}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-subtle-text text-xs">
                    Never more than a handful - the window closes 14 days after
                    you win, or when the next giveaway starts.
                  </Text>
                  {actionablePrizes.map((prize) => (
                    <PrizeCard
                      key={prize.id}
                      onPress={() => openPrize(prize)}
                      prize={prize}
                    />
                  ))}
                </View>
              )}
              {history.length > 0 && (
                <Text className="font-semibold text-subtle-text text-xs tracking-wide">
                  HISTORY
                </Text>
              )}
            </View>
          )
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              needsYou.refetch();
              refetch();
            }}
            refreshing={isRefetching || needsYou.isRefetching}
          />
        }
        renderItem={({ item: prize }) => (
          <PrizeCard compact onPress={() => openPrize(prize)} prize={prize} />
        )}
      />
    </Screen>
  );
};

export default MyPrizes;
