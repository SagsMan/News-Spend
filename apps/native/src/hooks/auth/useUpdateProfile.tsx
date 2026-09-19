import { useMutation } from "@tanstack/react-query";

import { orpc } from "#/lib/orpc";

export default function useUpdateProfile() {
  return useMutation(orpc.account.updateProfile.mutationOptions());
}
