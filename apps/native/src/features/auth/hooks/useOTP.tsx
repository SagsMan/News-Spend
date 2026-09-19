import { useMutation } from "@tanstack/react-query";

import { authClient } from "#/lib/authClient";

export const useVerifyOTP = () =>
  useMutation({
    mutationFn: async ({ email, otp }: { email: string; otp: string }) =>
      await authClient.emailOtp.verifyEmail({
        email,
        otp,
      }),
  });

export const useSendOtp = () =>
  useMutation({
    mutationFn: async ({ email }: { email: string }) =>
      await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      }),
  });
