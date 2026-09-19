import crypto from "node:crypto";

import { publicProcedure } from "../../../index";
import {
  CPX_APP_ID,
  CPX_SECURE_HASH,
  CPXSurveyResponseSchema,
} from "../schemas";
import { getUserCountryCode, getUserIpAddress } from "../utils";
import {
  OfferInputSchema,
  RAPIDO_API_KEY,
  RAPIDO_APP_ID,
  THEOREM_API_KEY,
  THEOREM_REACH_URL,
  type UnifiedOffer,
} from "./schemas";

const mockOffers: UnifiedOffer[] = [
  {
    id: "mock-1",
    provider: "cpx",
    title: "Complete this survey",
    description: "Share your opinion and earn points",
    points: 100,
    estimatedTime: 10,
    url: "https://example.com/survey",
    imageUrl: "https://picsum.photos/100",
    country: "NG",
    type: "survey",
    qualificationRate: 75,
  },
  {
    id: "mock-2",
    provider: "cpx",
    title: "Try a new app",
    description: "Download and test an app",
    points: 50,
    estimatedTime: 5,
    url: "https://example.com/offer",
    imageUrl: "https://picsum.photos/101",
    country: "NG",
    type: "offer",
    qualificationRate: 90,
  },
];

async function fetchCPXOffers(
  userId: string,
  userEmail: string,
  userName: string,
  countryCode: string,
  userIp: string,
  userAgent: string,
  limit: number
): Promise<UnifiedOffer[]> {
  if (!CPX_APP_ID) {
    console.warn("CPX_APP_ID not configured");
    return [];
  }

  try {
    const secureHash = crypto
      .createHash("md5")
      .update(`${userId}-${CPX_SECURE_HASH}`)
      .digest("hex");

    const params = new URLSearchParams({
      app_id: CPX_APP_ID,
      ext_user_id: userId,
      output_method: "api",
      ip_user: userIp,
      limit: String(limit),
      user_country_code: countryCode,
      email: userEmail || "",
      username: userName || "",
      secure_hash: secureHash,
      user_agent: userAgent,
    });

    const url = `https://live-api.cpx-research.com/api/get-surveys.php?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error("CPX API error:", response.status);
      return [];
    }

    const data = await response.json();
    const validated = CPXSurveyResponseSchema.parse(data);

    return (validated.surveys || []).map((survey) => ({
      id: `cpx-${survey.id}`,
      provider: "cpx" as const,
      title: survey.id,
      description: `LOI: ${survey.loi} mins`,
      points: Math.floor(Number.parseFloat(survey.payout || "0") * 100),
      estimatedTime: survey.loi,
      url: survey.href_new || survey.href || "",
      imageUrl: undefined,
      country: countryCode,
      type: "survey" as const,
      qualificationRate: survey.conversion_rate
        ? Number.parseFloat(survey.conversion_rate.replace("%", ""))
        : undefined,
    }));
  } catch (error) {
    console.error("Error fetching CPX offers:", error);
    return [];
  }
}

async function fetchRapidoOffers(
  userId: string,
  countryCode: string,
  userIp: string,
  limit: number
): Promise<UnifiedOffer[]> {
  if (!(RAPIDO_API_KEY && RAPIDO_APP_ID)) {
    console.warn("RAPIDO_API_KEY or RAPIDO_APP_ID not configured");
    return [];
  }

  try {
    const response = await fetch(
      "https://www.rapidoreach.com/getallsurveys-api",
      {
        method: "POST",
        headers: {
          "X-RapidoReach-Api-Key": RAPIDO_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          UserId: userId,
          AppId: RAPIDO_APP_ID,
          IpAddress: userIp,
          City: "Lagos", // TODO: Implement city detection
          CountryLanguageCode: `ENG-${countryCode}`,
        }),
      }
    );

    if (!response.ok) {
      console.error("Rapido API error:", response.status);
      return [];
    }

    const data: unknown = await response.json();

    if (!Array.isArray(data)) {
      const errorResponse = data as {
        Errors?: string[];
        ErrorCode?: string;
        Info?: string[];
      };
      console.error("Rapido API returned error:", {
        errorCode: errorResponse.ErrorCode,
        errors: errorResponse.Errors,
        info: errorResponse.Info,
      });
      return [];
    }

    const surveys = data as Array<{
      SurveyNumber: string;
      SurveyUrl: string;
      Reward: number;
      LOI: number;
      MatchingPercentage: number;
      Survey?: { SurveyName?: string };
    }>;

    return surveys.slice(0, limit).map((survey) => ({
      id: `rapido-${survey.SurveyNumber}`,
      provider: "rapido" as const,
      title: survey.Survey?.SurveyName || "Survey",
      description: `${survey.LOI} mins`,
      points: survey.Reward,
      estimatedTime: survey.LOI,
      url: survey.SurveyUrl,
      imageUrl: undefined,
      country: countryCode,
      type: "survey" as const,
      qualificationRate: survey.MatchingPercentage,
    }));
  } catch (error) {
    console.error("Error fetching Rapido offers:", error);
    return [];
  }
}

async function checkTheoremSurveyAvailability(
  userId: string,
  userIp: string
): Promise<{ available: boolean; profiled: boolean }> {
  if (!THEOREM_API_KEY) {
    return { available: false, profiled: false };
  }

  try {
    const url = `https://api.theoremreach.com/api/publishers/v1/user_details?api_key=${THEOREM_API_KEY}&user_id=${userId}&ip=${userIp}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error("Theorem availability check error:", response.status);
      return { available: false, profiled: false };
    }

    const data = (await response.json()) as {
      surveys_available?: boolean;
      profiled?: boolean;
    };

    return {
      available: data.surveys_available ?? false,
      profiled: data.profiled ?? false,
    };
  } catch (error) {
    console.error("Error checking Theorem availability:", error);
    return { available: false, profiled: false };
  }
}

async function fetchTheoremOffers(
  userId: string,
  userIp: string,
  _countryCode: string,
  _limit: number
): Promise<UnifiedOffer[]> {
  if (!THEOREM_API_KEY) {
    console.warn("THEOREM_API_KEY not configured");
    return [];
  }

  const { available, profiled } = await checkTheoremSurveyAvailability(
    userId,
    userIp
  );

  if (!available) {
    console.log(`No surveys available for user ${userId}`);
    return [];
  }

  const offerUrl = `${THEOREM_REACH_URL}?api_key=${THEOREM_API_KEY}&user_id=${userId}`;

  return [
    {
      id: "theorem-reach",
      provider: "theorem" as const,
      title: profiled ? "Take Surveys" : "Complete Profile",
      description: profiled
        ? "Complete surveys and earn rewards"
        : "Complete your profile to unlock surveys",
      points: 0,
      estimatedTime: undefined,
      url: offerUrl,
      imageUrl: undefined,
      country: undefined,
      type: "survey" as const,
      qualificationRate: undefined,
    },
  ];
}

export const offersRouter = {
  getOffers: publicProcedure
    .input(OfferInputSchema)
    .handler(async ({ input, context }): Promise<UnifiedOffer[]> => {
      const { user, request, payload } = context;
      const limit = input.limit || 20;

      if (!user || user.isAnonymous) {
        return mockOffers.slice(0, limit);
      }

      // @ts-expect-error
      const userIp = getUserIpAddress(request);
      const countryCode = await getUserCountryCode(userIp);
      const userAgent = request?.headers.get("user-agent") || "";

      const [cpxOffers, rapidoOffers, theoremOffers] = await Promise.all([
        fetchCPXOffers(
          user.id,
          user.email || "",
          user.username || "",
          countryCode,
          userIp,
          userAgent,
          limit
        ),
        fetchRapidoOffers(user.id, countryCode, userIp, limit),
        fetchTheoremOffers(user.id, userIp, countryCode, limit),
      ]);

      const allOffers = [...cpxOffers, ...rapidoOffers, ...theoremOffers];

      allOffers.sort((a, b) => b.points - a.points);

      return allOffers.slice(0, limit);
    }),
};

export * from "./postbacks";
