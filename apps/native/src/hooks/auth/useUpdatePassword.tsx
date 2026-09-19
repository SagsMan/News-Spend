import { useMutation } from "@tanstack/react-query";

import { orpc } from "#/lib/orpc";

export default function useUpdatePassword() {
  return useMutation(orpc.account.changePassword.mutationOptions({}));
}
