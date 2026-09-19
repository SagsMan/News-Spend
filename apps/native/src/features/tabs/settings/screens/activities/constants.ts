import type { Activity } from "@news-spend-media/payload/types";
import type { IconProps as PIconProps } from "#/lib/icons";
import {
  ArrowCounterClockwiseIcon,
  CalendarIcon,
  ClipboardIcon,
  ConfettiIcon,
  DiceFiveIcon,
  HandshakeIcon,
  LightningIcon,
  MegaphoneIcon,
  MonitorIcon,
  MusicNoteIcon,
  NewspaperIcon,
  ShareNetworkIcon,
  TicketIcon,
  UsersIcon,
} from "#/lib/icons";
import type React from "react";
import type { RouterInputs } from "#/lib/orpc";

export type ActivityType = RouterInputs["activity"]["byUserId"]["type"];
export type Category = RouterInputs["activity"]["byUserId"]["category"];
export type SelectOption = { value: string; label: string };

export type ActionMeta = {
  icon: React.FC<PIconProps>;
  bg: string;
  label: string;
};

// Map action values to icons and colors
export const ACTION_META: Record<
  NonNullable<Activity["action"]>,
  ActionMeta
> = {
  signUp: { icon: ConfettiIcon, bg: "#EDE9FE", label: "Sign up" },
  watchLive: { icon: MonitorIcon, bg: "#DBEAFE", label: "Watch live" },
  read: { icon: NewspaperIcon, bg: "#DBEAFE", label: "Read news" },
  dailyLogin: { icon: CalendarIcon, bg: "#D1FAE5", label: "Daily login" },
  share: { icon: ShareNetworkIcon, bg: "#E0F2FE", label: "Share" },
  connectBrandAd: { icon: MegaphoneIcon, bg: "#FEF3C7", label: "Brand ad" },
  referral: { icon: UsersIcon, bg: "#EDE9FE", label: "Referral" },
  ticketPurchase: {
    icon: TicketIcon,
    bg: "#FFE4E6",
    label: "Giveaway entry",
  },
  lottery: { icon: DiceFiveIcon, bg: "#FEF9C3", label: "Giveaway" },
  surveyTask: { icon: ClipboardIcon, bg: "#FEF3C7", label: "Survey task" },
  musicListeningTime: { icon: MusicNoteIcon, bg: "#F0FFFE", label: "Music" },
  partnerContentTask: {
    icon: HandshakeIcon,
    bg: "#F0FDF4",
    label: "Partner task",
  },
  pointReversal: {
    icon: ArrowCounterClockwiseIcon,
    bg: "#FEE2E2",
    label: "Reversal",
  },
};

export function getActionMeta(action?: string): ActionMeta {
  return (
    ACTION_META[action as NonNullable<Activity["action"]>] ?? {
      icon: LightningIcon,
      bg: "#F1F5F9",
      label: action ?? "Activity",
    }
  );
}

export const activityOptions: SelectOption[] = [
  { value: "all", label: "All" },
  { value: "shopping-and-purchase", label: "Shopping & Purchases" },
  { value: "referrals", label: "Referrals" },
  { value: "reward-history", label: "Reward History" },
];

export const dateRangeOptions: SelectOption[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last-7-days", label: "Last 7 Days" },
  { value: "last-30-days", label: "Last 30 Days" },
  { value: "custom", label: "Custom Range" },
];
