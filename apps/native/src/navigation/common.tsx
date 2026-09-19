import { createNativeStackScreen } from "@react-navigation/native-stack";

import ResetPassword from "#/features/auth/screens/change-password";
import ForgotPassword from "#/features/auth/screens/forgot-password";
import Onboarding from "#/features/auth/screens/onboarding";
import OnboardingTwo from "#/features/auth/screens/onboarding-two";
import OnboardingThree from "#/features/auth/screens/onboarding-three";
import PrivacyPolicy from "#/features/auth/screens/privacy-policy";
import RegSuccess from "#/features/auth/screens/reg-success";
import SignIn from "#/features/auth/screens/sign-in";
import SignUp from "#/features/auth/screens/sign-up";
import TermOfUse from "#/features/auth/screens/term-of-use";
import TOS from "#/features/auth/screens/tos";
import Verification from "#/features/auth/screens/verification";
import Welcome from "#/features/auth/screens/welcome";
import { authState, isAnonymous } from "#/state/auth";

export const commonAuthScreens = {
  Onboarding: createNativeStackScreen({
    linking: {
      path: "onboarding",
    },
    screen: Onboarding,
  }),
  OnboardingTwo: createNativeStackScreen({
    linking: {
      path: "onboarding/two",
    },
    screen: OnboardingTwo,
  }),
  OnboardingThree: createNativeStackScreen({
    linking: {
      path: "onboarding/three",
    },
    screen: OnboardingThree,
  }),
  Welcome: createNativeStackScreen({
    linking: {
      path: "welcome",
    },
    screen: Welcome,
    options: {
      animation: "default",
      animationTypeForReplace:
        (authState.session?.user ?? isAnonymous()) ? "pop" : "push",
    },
  }),
  SignIn: createNativeStackScreen({
    linking: {
      path: "sign-in/:redirect?",
      parse: {
        redirect: (v) => v === "true",
      },
    },
    screen: SignIn,
  }),
  SignUp: createNativeStackScreen({
    linking: {
      path: "sign-up",
    },
    screen: SignUp,
  }),
  Verification: createNativeStackScreen({
    linking: {
      path: "verify-email/:email/:otpSent?",
      parse: {
        email: (v) => v,
        otpSent: (v) => v === "true",
      },
    },
    screen: Verification,
  }),
  ForgotPassword: createNativeStackScreen({
    linking: {
      path: "forgot-password",
    },
    screen: ForgotPassword,
  }),
  ResetPassword: createNativeStackScreen({
    linking: {
      path: "change-password/:token",
    },
    screen: ResetPassword,
  }),
  TOS: createNativeStackScreen({
    screen: TOS,
    linking: {
      path: "/tos/:goto",
    },
    options: {
      animation: "slide_from_bottom",
      presentation: "modal",
    },
  }),
  TermsOfUse: createNativeStackScreen({
    linking: {
      path: "terms-of-use",
    },
    screen: TermOfUse,
  }),
  PrivacyPolicy: createNativeStackScreen({
    linking: {
      path: "privacy-policy",
    },
    screen: PrivacyPolicy,
  }),
  RegSuccess: createNativeStackScreen({
    screen: RegSuccess,
  }),
};

export const commonLinking = {
  News: "/article/:slug/:id?",
  Comment: "/article/:newsSlug/comment",
  CommentReply: "/article/:newsSlug/comment/:commentId",
  ShopDetail: "detail/:slug",
  Profile: "profile",
  Contact: "contact",
  Activities: "activities",
  Report: "report",
  Notification: "notification",
  DataManager: "data-manager",
  DeleteAccount: "delete-account",
  Socials: "socials",
  ShareApp: "share-app",
  RateApp: "rate-app",
  Support: "support",
  FAQ: "faq",
  Email: "email",
  Feedback: "feedback",
  Advertise: "advertise",
  Legal: "legal",
  Call: "call",
  // NotFound: "*",
};
