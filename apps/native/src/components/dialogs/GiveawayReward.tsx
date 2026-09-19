import { useMutation, useQuery } from "@tanstack/react-query";
import { BottomSheet } from "heroui-native/bottom-sheet";
import {
  SealQuestionIcon,
  TicketIcon,
  TrophyIcon,
} from "#/lib/icons";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useSnapshot } from "valtio";

import { PartnerAdDialog } from "#/components/discover/PartnerAdDialog";
import { Button } from "#/components/heroui/button";
import { Icon } from "#/components/heroui/icon";
import { orpc } from "#/lib/orpc";
import { navigate } from "#/navigation/navigationUtils";
import { authState } from "#/state/auth";
import { Text } from "../ui";
import { sealedCardStake } from "./othersInDraw";

/** Long enough not to fight the app's own startup, short enough to be seen. */
const ANNOUNCE_DELAY_MS = 5000;

/**
 * How long the reveal will wait on an advertisement before giving up on it.
 *
 * The ad is suspense, never a toll. A prize that cannot be revealed because no
 * ad was available is a prize held hostage by fill rate, so every path out of
 * the ad phase (finished, dismissed, or never started) ends at the reveal.
 */
const AD_TIMEOUT_MS = 20_000;

type Phase = "sealed" | "ad" | "revealed";

/**
 * Tell someone how the draw went, whether or not they won.
 *
 * A draw that only speaks to its winners reads, to everyone else, as though
 * their entry was never counted. So this covers all participants: the sealed
 * card first, then the reveal, with the same beat in between either way.
 *
 * Shown once and never again, tracked on the server rather than on the device.
 * "You didn't win" survives a reinstall badly. Repeating it is worse than
 * never saying it, so the acknowledgement is a server pointer, not local
 * state.
 *
 * The claim itself still lives on `MyPrizes` / `ClaimPrize`, which persist. A
 * prize claimable only from a dialog is a prize lost by dismissing it, and the
 * claim window closes after fourteen days or when the next giveaway starts.
 */
export default memo(function GiveawayReward() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("sealed");
  const [adOpen, setAdOpen] = useState(false);
  const [announcedWin, setAnnouncedWin] = useState<string | null>(null);
  const adTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { session } = useSnapshot(authState);
  const user = session?.user;

  const { data: result, isPending: resultPending } = useQuery(
    orpc.giveaway.lastResult.queryOptions({ enabled: Boolean(user) })
  );

  const { data: actionable } = useQuery(
    orpc.giveaway.actionable.queryOptions({ enabled: Boolean(user) })
  );

  /**
   * Whether there is anything to enter yet.
   *
   * A draw is only ever revealed once the giveaway that produced it has
   * completed, and the next one is created by hand rather than automatically,
   * so at the exact moment this sheet is on screen there is usually NO open
   * giveaway, and often will not be for some time.
   *
   * "Enter the next giveaway" led straight to `GetTicket` regardless, which
   * without an open giveaway is a purchase screen with a placeholder name, a
   * price of zero and a disabled button. Offering that to somebody who has
   * just been told they lost is the worst possible moment for a dead end.
   */
  const { data: openGiveaway } = useQuery(
    orpc.giveaway.current.queryOptions({ enabled: Boolean(user) })
  );

  /**
   * Acknowledging deliberately does not invalidate `lastResult`.
   *
   * The reveal is on screen when this fires, and refetching would replace the
   * outcome the person is reading with the reminder branch below. The server
   * has the pointer; this session keeps rendering what it already loaded, and
   * the next launch gets the null.
   */
  const acknowledge = useMutation(
    orpc.giveaway.acknowledgeResult.mutationOptions()
  );

  /**
   * The winner's safety net, kept from the previous behaviour.
   *
   * The reveal happens once; an unclaimed prize needs reminding about until it
   * is claimed or its window shuts. This is that reminder, and it waits for
   * `lastResult` to settle. Announcing a win while the reveal is still
   * loading would give the outcome away before the moment meant to deliver it.
   */
  const unclaimed = (actionable ?? []).filter((prize) => prize.claimable);
  const reminder = result || resultPending ? undefined : unclaimed[0];

  // ── Reveal ──────────────────────────────────────────────────────────────────

  const reveal = useCallback(() => {
    if (adTimer.current) {
      clearTimeout(adTimer.current);
      adTimer.current = null;
    }
    setAdOpen(false);
    setPhase("revealed");

    // Acknowledged at the moment the outcome is actually shown, not when the
    // dialog opened. Closing during the ad must not burn the reveal.
    if (result?.giveawayId) {
      acknowledge.mutate({ giveawayId: result.giveawayId });
    }
  }, [result?.giveawayId, acknowledge]);

  const startAd = useCallback(() => {
    setPhase("ad");
    setAdOpen(true);
    adTimer.current = setTimeout(reveal, AD_TIMEOUT_MS);
  }, [reveal]);

  useEffect(
    () => () => {
      if (adTimer.current) {
        clearTimeout(adTimer.current);
      }
    },
    []
  );

  // ── Opening ─────────────────────────────────────────────────────────────────

  /**
   * What is on offer, identified rather than referenced.
   *
   * The effect below keys on these ids instead of on `result` and `reminder`
   * themselves. A refetch hands back a new object for an unchanged outcome, so
   * depending on the objects re-ran this effect on every refetch: it restarted
   * the countdown, and — because the reveal branch had no "already announced"
   * guard at all — reopened a dialog the user had just dismissed.
   */
  const revealId = result?.giveawayId;
  const reminderId = reminder?.id;

  useEffect(() => {
    const pendingId = reminderId ?? revealId;

    if (!pendingId) {
      return;
    }

    // Announce a given outcome once per session, so dismissing it does not
    // mean being nagged on every screen change. This now covers the reveal as
    // well as the reminder; previously only the reminder was guarded.
    if (announcedWin === pendingId) {
      return;
    }

    const timer = setTimeout(() => {
      setOpen(true);
      setAnnouncedWin(pendingId);
    }, ANNOUNCE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [revealId, reminderId, announcedWin]);

  if (!(result || reminder)) {
    return null;
  }

  const close = () => setOpen(false);

  // ── The winner's reminder, unchanged from before the reveal existed ──────────

  if (reminder) {
    const more = unclaimed.length - 1;

    return (
      <BottomSheet isOpen={open} onOpenChange={setOpen}>
        <BottomSheet.Portal>
          <BottomSheet.Overlay />
          {/* A reminder is dismissible by every means. It recurs until the
              prize is claimed, so losing it costs nothing. */}
          <BottomSheet.Content enableDynamicSizing enablePanDownToClose>
            <View className="gap-4 px-5 pt-2 pb-8">
              <View className="items-center gap-2">
                <Icon
                  color="#00223d"
                  name={TrophyIcon}
                  size={48}
                  weight="fill"
                />
                <Text className="text-center font-semibold text-lg">
                  Congratulations!
                </Text>
                <Text className="text-center text-subtle-text">
                  You won {reminder.prizeName} in the Giveaway.
                  {more > 0
                    ? ` And ${more} other prize${more === 1 ? "" : "s"}.`
                    : ""}
                </Text>
              </View>

              <Button
                onPress={() => {
                  close();
                  navigate("MyPrizes");
                }}
              >
                <Button.Label>
                  {more > 0 ? "View my prizes" : "Claim your prize"}
                </Button.Label>
              </Button>

              <Text className="text-center text-subtle-text text-xs">
                Your prizes are always waiting under My Prizes.
              </Text>
            </View>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    );
  }

  if (!result) {
    return null;
  }

  const won = result.won;
  const headline = result.prizes[0];
  const more = result.prizes.length - 1;

  return (
    <>
      <BottomSheet isOpen={open && phase !== "ad"} onOpenChange={setOpen}>
        <BottomSheet.Portal>
          {/*
            A sealed result cannot be dismissed by any route, not the handle,
            not the backdrop. The reveal happens once ever, so a card swiped
            away half-opened would strand it for good. A dialog refused this
            for free; a sheet has to be told, since swiping down is its
            natural gesture.
          */}
          <BottomSheet.Overlay isCloseOnPress={phase === "revealed"} />
          <BottomSheet.Content
            enableDynamicSizing
            enablePanDownToClose={phase === "revealed"}
          >
            <View className="gap-4 px-5 pt-2 pb-8">
              {phase === "sealed" ? (
                <View className="items-center gap-2">
                  <Icon
                    color="#00223d"
                    name={SealQuestionIcon}
                    size={48}
                    weight="fill"
                  />
                  <Text className="text-center font-semibold text-lg">
                    {result.giveawayName} has been drawn
                  </Text>
                  <Text className="text-center text-subtle-text">
                    {`${sealedCardStake(result.tickets, result.totalParticipants)} Ready to see how it went?`}
                  </Text>
                </View>
              ) : (
                <View className="items-center gap-2">
                  <Icon
                    color="#00223d"
                    name={won ? TrophyIcon : TicketIcon}
                    size={48}
                    weight="fill"
                  />
                  <Text className="text-center font-semibold text-lg">
                    {won ? "Congratulations!" : "Not this time"}
                  </Text>
                  <Text className="text-center text-subtle-text">
                    {won
                      ? `You won ${headline?.prizeName} in ${result.giveawayName}.${
                          more > 0
                            ? ` And ${more} other prize${more === 1 ? "" : "s"}.`
                            : ""
                        }`
                      : "Your entry was counted in the draw, but it just wasn't your name this time. The next giveaway is a fresh start."}
                  </Text>
                </View>
              )}

              {phase === "sealed" ? (
                <Button onPress={startAd}>
                  <Button.Label>Reveal my result</Button.Label>
                </Button>
              ) : (
                <Button
                  onPress={() => {
                    close();
                    if (won) {
                      navigate("MyPrizes");
                    } else if (openGiveaway) {
                      navigate("GetTicket");
                    }
                    // No open giveaway: closing IS the action. Nowhere to go.
                  }}
                >
                  <Button.Label>
                    {won
                      ? more > 0
                        ? "View my prizes"
                        : "Claim your prize"
                      : openGiveaway
                        ? "Enter the next giveaway"
                        : "Done"}
                  </Button.Label>
                </Button>
              )}

              {phase === "revealed" && won ? (
                <Text className="text-center text-subtle-text text-xs">
                  Your prizes are always waiting under My Prizes.
                </Text>
              ) : null}
            </View>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>

      {/* Controlled, and never allowed to send anyone to the app wall. A
          detour mid-reveal would abandon the result on a different screen. */}
      <PartnerAdDialog
        fallbackToAppWall={false}
        hideTrigger
        onClose={reveal}
        onCountdownComplete={reveal}
        open={adOpen}
        // Pinned to in-house content: the reveal needs to know up front
        // whether an ad exists, and a Google ad cannot answer that in time.
        preferAdType="custom"
        setOpen={setAdOpen}
      />
    </>
  );
});
