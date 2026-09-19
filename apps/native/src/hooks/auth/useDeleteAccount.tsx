import { useMutation } from "@tanstack/react-query";

import { authClient } from "#/lib/authClient";

export default function useDeleteAccount() {
  return useMutation({
    mutationFn: async ({ password }: { password: string }) => {
      const result = await authClient.deleteUser({
        password,
      });

      if (result.error) {
        throw result.error;
      }

      return result.data;
    },
  });
}
