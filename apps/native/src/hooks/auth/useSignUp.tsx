import { useMutation } from "@tanstack/react-query";

import { authClient } from "#/lib/authClient";

function useSignUp() {
  return useMutation({
    mutationFn: async (data: {
      email: string;
      password: string;
      name: string;
      wish: string;
      username: string;
    }) => await authClient.signUp.email(data),
  });
}

export default useSignUp;
