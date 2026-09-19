import { createNativeStackScreen } from "@react-navigation/native-stack";
import { lazy } from "react";

import NotFound from "#/screens/NotFound";

/**
 * Non-initial screens are lazy-loaded so the heavy libraries they import
 * (videos, lottery/prize flows, settings tooling) are only fetched and
 * executed when the screen is first navigated to, keeping the startup bundle
 * small.
 *
 * These MUST stay at module scope: declaring `lazy()` inside the navigator
 * config makes screens unmount/remount on every render.
 */
const PrivacyPolicy = lazy(
  () => import("#/features/auth/screens/privacy-policy")
);
const TermOfUse = lazy(() => import("#/features/auth/screens/term-of-use"));
const Activities = lazy(
  () => import("#/features/tabs/settings/screens/activities")
);
const BlockedUsers = lazy(
  () => import("#/features/tabs/settings/screens/blocked-users")
);
const CommunityGuidelines = lazy(
  () => import("#/features/tabs/settings/screens/community-guidelines")
);
const DataManager = lazy(
  () => import("#/features/tabs/settings/screens/data-manager")
);
const DeleteAccount = lazy(
  () => import("#/features/tabs/settings/screens/delete-account")
);
const IdentityVerification = lazy(
  () => import("#/features/tabs/settings/screens/identity-verification")
);
const LegalAgreement = lazy(
  () => import("#/features/tabs/settings/screens/legal")
);
const Notifications = lazy(
  () => import("#/features/tabs/settings/screens/notification")
);
const Profile = lazy(() => import("#/features/tabs/settings/screens/profile"));
const RateAppScreen = lazy(
  () => import("#/features/tabs/settings/screens/rate-app")
);
const Report = lazy(() => import("#/features/tabs/settings/screens/report"));
const ShareApp = lazy(
  () => import("#/features/tabs/settings/screens/share-app")
);
const Socials = lazy(() => import("#/features/tabs/settings/screens/socials"));
const Advertise = lazy(
  () => import("#/features/tabs/settings/screens/support/advertise")
);
const Call = lazy(
  () => import("#/features/tabs/settings/screens/support/call")
);
const Email = lazy(
  () => import("#/features/tabs/settings/screens/support/email")
);
const FAQs = lazy(
  () => import("#/features/tabs/settings/screens/support/faqs")
);
const Feedback = lazy(
  () => import("#/features/tabs/settings/screens/support/feedback")
);
const Support = lazy(
  () => import("#/features/tabs/settings/screens/support/support")
);
const ShopDetails = lazy(
  () => import("#/features/tabs/shop/screens/ShopDetails")
);
const InAppBrowser = lazy(() => import("#/screens/common/InAppBrowser"));
const ToastLab = lazy(() => import("#/screens/dev/ToastLab"));
const BoostLuck = lazy(() => import("#/screens/tabs/discover/BoostLuck"));
const ClaimPrize = lazy(() => import("#/screens/tabs/discover/ClaimPrize"));
const PrizeDetails = lazy(() => import("#/screens/tabs/discover/PrizeDetails"));
const GetTicket = lazy(() => import("#/screens/tabs/discover/GetTicket"));
const LotteryRules = lazy(() => import("#/screens/tabs/discover/LotteryRules"));
const LuckyAppWall = lazy(() => import("#/screens/tabs/discover/LuckyAppWall"));
const MyPrizes = lazy(() => import("#/screens/tabs/discover/MyPrizes"));
const PlayLottery = lazy(() => import("#/screens/tabs/discover/PlayLottery"));
const CommentReplies = lazy(
  () => import("#/screens/tabs/home/comments/CommentReply")
);
const Comments = lazy(() => import("#/screens/tabs/home/comments/Comments"));
const SingleNews = lazy(() => import("#/screens/tabs/home/news"));

export const sharedScreens = {
  News: createNativeStackScreen({
    screen: SingleNews,
    getId: ({ params }) => params?.slug,
    linking: {
      path: "/article/:slug/:id?",
    },
    options: {
      headerShown: false,
    },
  }),
  Comment: createNativeStackScreen({
    screen: Comments,
    getId: ({ params }) => params?.newsSlug,
    linking: {
      path: "/article/:newsSlug/comment",
    },
    options: {
      headerShown: false,
      // slide up from bottom
      animation: "slide_from_bottom",
    },
  }),
  CommentReply: createNativeStackScreen({
    screen: CommentReplies,
    getId: ({ params }) => params?.newsSlug,
    linking: {
      path: "/article/:newsSlug/comment/:commentId/:highlightCommentId?",
    },
    options: {
      // presentation: "modal",
      animation: "slide_from_bottom",
    },
  }),
  ShopDetails: createNativeStackScreen({
    screen: ShopDetails,
    getId: ({ params }) => params?.slug,
    linking: {
      path: "/detail/:slug",
    },
    options: {
      headerShown: false,
    },
  }),
  Profile: createNativeStackScreen({
    screen: Profile,
    linking: {
      path: "profile",
    },
  }),
  Activities: createNativeStackScreen({
    screen: Activities,
    linking: {
      path: "activities",
    },
  }),
  BlockedUsers: createNativeStackScreen({
    screen: BlockedUsers,
    linking: {
      path: "blocked-users",
    },
  }),
  Report: createNativeStackScreen({
    screen: Report,
    linking: {
      path: "report",
    },
  }),
  Notification: createNativeStackScreen({
    screen: Notifications,
    linking: {
      path: "notification",
    },
  }),
  DataManager: createNativeStackScreen({
    screen: DataManager,
    linking: {
      path: "data-manager",
    },
  }),
  DeleteAccount: createNativeStackScreen({
    screen: DeleteAccount,
    linking: {
      path: "delete-account",
    },
  }),
  RateApp: createNativeStackScreen({
    screen: RateAppScreen,
    linking: {
      path: "rate-app",
    },
  }),
  ShareApp: createNativeStackScreen({
    screen: ShareApp,
    linking: {
      path: "share-app",
    },
  }),
  Socials: createNativeStackScreen({
    screen: Socials,
    linking: {
      path: "socials",
    },
  }),
  Support: createNativeStackScreen({
    screen: Support,
    linking: {
      path: "support",
    },
  }),
  IdentityVerification: createNativeStackScreen({
    screen: IdentityVerification,
    linking: {
      path: "identity-verification",
    },
  }),
  Advertise: createNativeStackScreen({
    screen: Advertise,
    linking: {
      path: "advertise",
    },
  }),
  Call: createNativeStackScreen({
    screen: Call,
    linking: {
      path: "call",
    },
  }),
  Feedback: createNativeStackScreen({
    screen: Feedback,
    linking: {
      path: "feedback",
    },
  }),
  FAQ: createNativeStackScreen({
    screen: FAQs,
    linking: {
      path: "faq",
    },
  }),
  Email: createNativeStackScreen({
    screen: Email,
    linking: {
      path: "email",
    },
  }),
  Legal: createNativeStackScreen({
    screen: LegalAgreement,
    linking: {
      path: "legal",
    },
  }),
  TermsOfUse: createNativeStackScreen({
    screen: TermOfUse,
    linking: {
      path: "terms-of-use",
    },
  }),
  PrivacyPolicy: createNativeStackScreen({
    screen: PrivacyPolicy,
    linking: {
      path: "privacy-policy",
    },
  }),
  CommunityGuidelines: createNativeStackScreen({
    screen: CommunityGuidelines,
    linking: {
      path: "community-guidelines",
    },
  }),
  // // Discover screens
  PlayLottery: createNativeStackScreen({
    screen: PlayLottery,
    linking: {
      path: "play-lottery",
    },
    options: {
      headerShown: false,
    },
  }),
  GetTicket: createNativeStackScreen({
    screen: GetTicket,
    linking: {
      path: "buy-ticket",
    },
    options: {
      headerShown: false,
    },
  }),
  BoostLuck: createNativeStackScreen({
    screen: BoostLuck,
    linking: {
      path: "boost-luck",
    },
    options: {
      headerShown: false,
    },
  }),
  LuckyAppWall: createNativeStackScreen({
    screen: LuckyAppWall,
    linking: {
      path: "lucky-app-wall",
    },
    options: {
      headerShown: false,
    },
  }),
  MyPrizes: createNativeStackScreen({
    screen: MyPrizes,
    linking: {
      path: "my-prizes",
    },
    options: {
      headerShown: false,
    },
  }),
  ClaimPrize: createNativeStackScreen({
    screen: ClaimPrize,
    linking: {
      path: "claim-prize/:winnerId",
    },
    options: {
      headerShown: false,
    },
  }),
  PrizeDetails: createNativeStackScreen({
    screen: PrizeDetails,
    linking: {
      path: "prize/:winnerId",
    },
    options: {
      headerShown: false,
    },
  }),
  LotteryRules: createNativeStackScreen({
    screen: LotteryRules,
    linking: {
      path: "lottery-rules",
    },
    options: {
      headerShown: false,
    },
  }),
  InAppBrowser: createNativeStackScreen({
    screen: InAppBrowser,
    linking: {
      path: "browser",
    },
    options: {
      headerShown: false,
    },
  }),
  // Kept so the `survey` deep link and any cached navigation state keep working.
  SurveyWebView: createNativeStackScreen({
    screen: InAppBrowser,
    linking: {
      path: "survey",
    },
    options: {
      headerShown: false,
    },
  }),
  // Bench for the HeroUI toast wrapper. Dev builds only: `news-spend://toast-lab`.
  ...(__DEV__
    ? {
        ToastLab: createNativeStackScreen({
          screen: ToastLab,
          linking: {
            path: "toast-lab",
          },
        }),
      }
    : {}),
  NotFound: createNativeStackScreen({
    screen: NotFound,
    linking: {
      path: "*",
    },
  }),
};
