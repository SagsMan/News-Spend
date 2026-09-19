import { accountRouter } from "./account";
import { activityRouter } from "./activity";
import { adsRouter } from "./ads";
import { blockRouter } from "./block";
import { commentRouter } from "./comment";
import { feedbackRouter } from "./feedback";
import { giveawayRouter } from "./giveaway";
import { newsRouter } from "./news";
import { notificationSettingsRouter } from "./notificationSettings";
import { notificationsRouter } from "./notifications";
import { partnerAnalyticsRouter } from "./partner-analytics";
import { partnerConversionRouter } from "./partner-conversions";
import { partnerContentRouter } from "./partnerContent";
import { postReportRouter } from "./postReport";
import { publisherRouter } from "./publisher";
import { reportRouter } from "./report";
import { storeRouter } from "./store";
import { surveyRouter } from "./survey";
import { tweetRouter } from "./tweet";
import { verificationRouter } from "./verification";

export const router = {
  account: accountRouter,
  activity: activityRouter,
  block: blockRouter,
  ads: adsRouter,
  comments: commentRouter,
  feedback: feedbackRouter,
  giveaway: giveawayRouter,
  news: newsRouter,
  notificationSettings: notificationSettingsRouter,
  notifications: notificationsRouter,
  partnerAnalytics: partnerAnalyticsRouter,
  partnerContent: partnerContentRouter,
  partnerConversions: partnerConversionRouter,
  postReport: postReportRouter,
  publisher: publisherRouter,
  report: reportRouter,
  store: storeRouter,
  survey: surveyRouter,
  verification: verificationRouter,
  tweet: tweetRouter,
};

export default router;
export type { router as Router };
