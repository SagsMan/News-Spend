import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns/format";
import { Card } from "heroui-native/card";
import {
  CoinsIcon,
  DeviceMobileIcon,
  GiftIcon,
  PackageIcon,
} from "#/lib/icons";
import { ActivityIndicator, View } from "react-native";

import { ScreenHeader } from "#/components";
import { Button } from "#/components/heroui/button";
import { Icon } from "#/components/heroui/icon";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import { orpc } from "#/lib/orpc";

const PRIZE_ICON: Record<string, typeof GiftIcon> = {
  points: CoinsIcon,
  airtime: DeviceMobileIcon,
  data: DeviceMobileIcon,
  physical: PackageIcon,
};

const when = (value: string | null | undefined) =>
  value ? format(new Date(value), "d MMM yyyy, HH:mm") : null;

/** One label-and-value line. Renders nothing at all when there is no value. */
function Detail({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) {
    return null;
  }

  return (
    <View className="flex-row items-start justify-between gap-4 py-1.5">
      <Text className="text-sm text-subtle-text">{label}</Text>
      <Text className="flex-1 text-right text-sm">{value}</Text>
    </View>
  );
}

/**
 * What happened to one prize, after the fact.
 *
 * Distinct from `ClaimPrize`, which asks for what a dispatch needs. This is the
 * record: which giveaway produced it, what it was, and where it went. Until it
 * existed a finished prize was inert in My Prizes; a winner whose airtime had
 * not arrived could see that it was "fulfilled" and nothing else, while the
 * number it went to sat only in the CMS.
 */
function PrizeDetails({
  route,
}: {
  route: { params?: { winnerId?: string } };
}) {
  const navigation = useNavigation("PrizeDetails");
  const winnerId = route.params?.winnerId ?? "";

  const { data, isPending, isError } = useQuery(
    orpc.giveaway.prizeDetails.queryOptions({
      input: { winnerId },
      enabled: Boolean(winnerId),
    })
  );

  if (isPending) {
    return (
      <Screen>
        <ScreenHeader title="Prize" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (isError || !data) {
    return (
      <Screen>
        <ScreenHeader title="Prize" />
        <View className="flex-1 items-center justify-center gap-2 px-8">
          <Text className="text-center text-subtle-text">
            That prize could not be found.
          </Text>
        </View>
      </Screen>
    );
  }

  const PrizeIcon = PRIZE_ICON[data.fulfilmentType] ?? GiftIcon;
  const dispatched =
    data.fulfilmentType === "airtime" || data.fulfilmentType === "data";

  return (
    <Screen className="gap-4 pb-safe">
      <ScreenHeader title="Prize" />

      <View className="gap-4 px-4">
        <View className="items-center gap-2 py-2">
          <Icon color="#00223d" name={PrizeIcon} size={44} weight="fill" />
          <Text className="text-center font-semibold text-xl">
            {data.prizeName}
          </Text>
          {data.prizeDescription ? (
            <Text className="text-center text-sm text-subtle-text">
              {data.prizeDescription}
            </Text>
          ) : null}
        </View>

        <Card className="gap-1 rounded-md p-4">
          <Text className="pb-1 font-semibold text-subtle-text text-xs tracking-wide">
            THE DRAW
          </Text>
          <Detail label="Giveaway" value={data.giveawayName} />
          <Detail label="Drawn" value={when(data.drawnAt)} />
          <Detail label="You won" value={when(data.selectedAt)} />
          <Detail label="Claimed" value={when(data.claimedAt)} />
        </Card>

        {/*
          Only for the types that actually leave the platform. Points are
          credited in-app, so there is no provider, no reference, and nothing
          here worth an empty card.
        */}
        {dispatched && data.dispatch ? (
          <Card className="gap-1 rounded-md p-4">
            <Text className="pb-1 font-semibold text-subtle-text text-xs tracking-wide">
              DELIVERY
            </Text>
            <Detail
              label="Sent to"
              value={data.dispatch.sentTo ?? data.sentTo}
            />
            <Detail label="Network" value={data.dispatch.network} />
            <Detail
              label="Amount"
              value={data.dispatch.amount ? `₦${data.dispatch.amount}` : null}
            />
            <Detail label="Sent" value={when(data.dispatch.attemptedAt)} />
            <Detail label="Reference" value={data.dispatch.reference} />
            {/* The provider's own words, so a failure is diagnosable rather
                than just "not fulfilled". */}
            <Detail label="Problem" value={data.dispatch.error} />
          </Card>
        ) : null}

        {data.recipientName || data.shippingAddress ? (
          <Card className="gap-1 rounded-md p-4">
            <Text className="pb-1 font-semibold text-subtle-text text-xs tracking-wide">
              DELIVERY
            </Text>
            <Detail label="Recipient" value={data.recipientName} />
            <Detail label="Address" value={data.shippingAddress} />
          </Card>
        ) : null}

        {data.underReview ? (
          <Card className="gap-1 rounded-md bg-s-300 p-4">
            <Text className="font-semibold text-sm">
              This prize is being reviewed
            </Text>
            <Text className="text-sm text-subtle-text">
              {data.reviewNote ??
                "Your win stands. The payout is waiting on a check."}
            </Text>
          </Card>
        ) : null}

        {data.claimable ? (
          <Button
            onPress={() => navigation.navigate("ClaimPrize", { winnerId })}
          >
            <Button.Label>Claim your prize</Button.Label>
          </Button>
        ) : null}

        {/*
          The way out of a wrong phone number or a wrong street.
          Until this existed, details were captured once at claim time and
          never again: a winner could see that a top-up had been rejected and
          could do nothing about it but wait for someone to notice. The server
          decides whether it is still editable, so this cannot offer an edit
          that would then be refused.
        */}
        {data.canEditDetails ? (
          <Button
            onPress={() => navigation.navigate("ClaimPrize", { winnerId })}
            variant="secondary"
          >
            <Button.Label>Update delivery details</Button.Label>
          </Button>
        ) : null}

        {/* The one thing a winner most wants and cannot otherwise see: whether
            an unclaimed prize is still claimable, and why not if it is not. */}
        {data.closedMessage ? (
          <Text className="text-center text-sm text-subtle-text">
            {data.closedMessage}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

export default PrizeDetails;
