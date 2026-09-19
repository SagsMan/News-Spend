import { useNavigation } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";

import { authClient } from "#/lib/authClient";

export default function useChangePassword() {
  const _navigation = useNavigation();

  const changePassword = async ({
    password,
    token,
  }: {
    password: string;
    token: string;
  }) => {
    const res = await authClient.resetPassword({
      newPassword: password,
      token,
    });

    return res;
  };

  return useMutation({
    mutationFn: changePassword,
  });
}
