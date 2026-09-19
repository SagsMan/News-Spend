import crypto from "node:crypto";

import type { CPXSurvey } from "./schemas";
import { CPX_SECURE_HASH } from "./schemas";

const countryCodeCache = new Map<string, { code: string; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

export function getUserIpAddress(req?: Request): string {
  if (process.env.NODE_ENV !== "production") {
    return "102.88.108.210";
  }

  if (!req) {
    return "127.0.0.1";
  }

  let ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-client-ip") ||
    "127.0.0.1";

  if (typeof ip === "string") {
    const commaIndex = ip.indexOf(",");
    if (commaIndex !== -1) {
      ip = ip.substring(0, commaIndex).trim();
    }
  }

  if (typeof ip === "string" && ip.startsWith("::ffff:")) {
    return ip.substring(7);
  }

  return ip;
}

export async function getUserCountryCode(userIp: string): Promise<string> {
  try {
    const cached = countryCodeCache.get(userIp);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_TTL) {
      console.log(`Using cached country code for IP ${userIp}: ${cached.code}`);
      return cached.code;
    }

    const geoResponse = await fetch(`https://ipapi.co/${userIp}/json/`);

    if (!geoResponse.ok) {
      return "NG";
    }

    const geoData = (await geoResponse.json()) as {
      country_code?: string;
      error?: string;
    };

    if (geoData.error) {
      console.error(`ipapi.co returned error: ${geoData.error}`);
      return "NG";
    }

    const countryCode = geoData.country_code || "NG";
    countryCodeCache.set(userIp, { code: countryCode, timestamp: now });

    return countryCode;
  } catch (error) {
    console.error("Error fetching user country code:", error);
    return "NG";
  }
}

export function generateCPXSecureHash(userId: string): string {
  const dataToHash = `${userId}-${CPX_SECURE_HASH}`;
  return crypto.createHash("md5").update(dataToHash).digest("hex");
}

export function getMockSurveysForGuests(): CPXSurvey[] {
  return [
    {
      id: "guest-survey-1",
      loi: 5,
      payout: "100",
      conversion_rate: "50%",
      score: "5",
      statistics_rating_count: 120,
      statistics_rating_avg: 4.5,
      type: "need_qualification",
      top: 1,
      details: 1,
      payout_publisher_usd: 1.0,
      href: "login-required",
      href_new: "login-required",
    },
    {
      id: "guest-survey-2",
      loi: 10,
      payout: "200",
      conversion_rate: "45%",
      score: "4.8",
      statistics_rating_count: 90,
      statistics_rating_avg: 4.3,
      type: "need_qualification",
      top: 0,
      details: 1,
      payout_publisher_usd: 2.0,
      href: "login-required",
      href_new: "login-required",
    },
    {
      id: "guest-survey-3",
      loi: 15,
      payout: "300",
      conversion_rate: "40%",
      score: "4.7",
      statistics_rating_count: 75,
      statistics_rating_avg: 4.2,
      type: "need_qualification",
      top: 0,
      details: 1,
      payout_publisher_usd: 3.0,
      href: "login-required",
      href_new: "login-required",
    },
  ];
}

export function generatePostbackSecureHash(transId: string): string {
  const dataToHash = `${transId}-${CPX_SECURE_HASH}`;
  return crypto.createHash("md5").update(dataToHash).digest("hex");
}
