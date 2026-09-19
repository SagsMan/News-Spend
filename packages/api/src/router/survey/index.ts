import { sendNotification } from "@news-spend-media/payload/lib/send-notification";
import { openapi } from "@orpc/openapi";
import z from "zod";

import { protectedProcedure } from "../../index";
import { addActivity } from "../../shared/activity";
import { cpxRouter } from "./cpx";
import {
  offersRouter,
  rapidoPostbackHandler,
  theoremPostbackHandler,
} from "./offers";
import { AwardGoogleFormInputSchema } from "./schemas";

const awardGoogleFormPoints = protectedProcedure
  .meta(
    openapi({
      method: "POST",
      path: "/survey/gFormAwardPoint",
      summary: "Award point for google forms",
      tags: ["survey"],
    })
  )
  .input(AwardGoogleFormInputSchema)
  .output(z.any())
  .handler(async ({ input, context, errors }) => {
    try {
      const { gFormId, userId } = input;
      const { payload } = context;

      const gForm = await payload.find({
        collection: "survey",
        where: {
          googleFormId: {
            equals: gFormId,
          },
        },
        depth: 1,
      });

      const survey = gForm.docs[0];

      if (!survey) {
        throw errors.NOT_FOUND({
          message: "Survey not found",
        });
      }

      if (userId && survey.users?.includes(userId)) {
        return survey;
      }

      const res = await payload.update({
        collection: "survey",
        id: survey.id,
        data: {
          users: [...((survey.users as string[]) ?? []), userId],
        },
      });

      await addActivity(
        {
          type: "point",
          point: res.points ?? 10,
          description: "Awarded for completing survey",
          action: "surveyTask",
        },
        context
      );

      const pushTokens = await payload.find({
        collection: "push-tokens",
        where: {
          user: {
            equals: userId,
          },
        },
        pagination: false,
      });

      await sendNotification({
        pushTokens: pushTokens.docs,
        title: "Point awarded",
        body: `You have been awarded ${res.points} points for completing a survey`,
        data: {
          surveyId: gFormId,
          type: "survey",
          url: "settings/activities",
        },
      });

      return res;
    } catch (error) {
      console.error(error);
      throw error;
    }
  });

const getAllSurveys = protectedProcedure.handler(async ({ context }) => {
  const { payload, user } = context;

  const surveys = await payload.find({
    collection: "survey",
    where: {
      ...(user ? { users: { not_in: [user.id] } } : {}),
    },
  });

  return surveys;
});

export const surveyRouter = {
  awardGoogleFormPoints,
  getAll: getAllSurveys,
  cpx: cpxRouter,
  offers: offersRouter,
  rapidoPostback: rapidoPostbackHandler,
  theoremPostback: theoremPostbackHandler,
};
