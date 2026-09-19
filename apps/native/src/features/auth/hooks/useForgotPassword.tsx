import { useMutation } from "@tanstack/react-query";

import { authClient } from "#/lib/authClient";

const useForgotPassword = () => {
  const resetPassword = async ({ email }: { email: string }) => {
    const res = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });

    return res;
  };

  return useMutation({
    mutationFn: resetPassword,
  });
};

export default useForgotPassword;
