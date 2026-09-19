import { expoClient } from "@better-auth/expo/client";
import type { auth } from "@news-spend-media/auth";
import {
  anonymousClient,
  emailOTPClient,
  inferAdditionalFields,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { getBaseUrl } from "#/utils/getBaseUrl";
import { isNetworkError } from "#/utils/isNetworkError";
import { storage } from "#/utils/storage";

const MAX_RETRIES = 3;
const TIMEOUT_MS = 15_000; // 15 seconds
const INITIAL_DELAY_MS = 1000; // 1 second

/**
 * Custom fetch with retry logic for better-auth.
 * Handles SSL handshake failures and network instability,
 * especially for users on unstable connections.
 */
async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      }).finally(() => {
        clearTimeout(timeoutId);
      });
      return response;
    } catch (error) {
      lastError = error;

      if (!isNetworkError(error)) {
        throw error;
      }

      if (attempt === MAX_RETRIES - 1) {
        break;
      }

      const delay = INITIAL_DELAY_MS * 2 ** attempt;

      if (__DEV__) {
        console.warn(
          `[authClient] Attempt ${attempt + 1}/${MAX_RETRIES} failed, retrying in ${delay}ms`,
          error instanceof Error ? error.message : String(error)
        );
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export const authClient = createAuthClient({
  baseURL: getBaseUrl(),
  disableDefaultFetchPlugins: true,
  fetchOptions: {
    customFetchImpl: fetchWithRetry,
  },
  plugins: [
    inferAdditionalFields<typeof auth>(),
    expoClient({
      scheme: "news-spend",
      storagePrefix: "expo-better-auth",
      storage: {
        getItem(key) {
          return storage.getString(key) ?? null;
        },
        setItem(key, value) {
          storage.set(key, value);
        },
      },
    }),
    emailOTPClient(),
    anonymousClient(),
  ],
});
