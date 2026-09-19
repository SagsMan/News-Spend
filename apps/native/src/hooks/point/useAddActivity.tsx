import { useMutation } from "@tanstack/react-query";

import { orpc } from "#/lib/orpc";
import { queryClient } from "#/lib/tanstackQuery";

type UseAddActivityOptions = {
  onCapReached?: () => void;
};

export default function useAddActivity(options?: UseAddActivityOptions) {
  return useMutation(
    orpc.activity.add.mutationOptions({
      onMutate(variables, ctx) {
        const previousPoints = ctx.client.getQueryData(
          orpc.activity.totalPoints.queryKey()
        );

        queryClient.setQueryData(
          orpc.activity.totalPoints.queryKey(),
          (previousPoints) => (previousPoints ?? 0) + variables.point
        );

        return { previousPoints };
      },
      onError(error, _variables, onMutateResult, context) {
        console.log(error);
        context.client.setQueryData(
          orpc.activity.totalPoints.queryKey(),
          onMutateResult?.previousPoints
        );
      },
      onSuccess: (data, _variables, _onMutateResult, context) => {
        if (data?.message === "CAP_REACHED") {
          options?.onCapReached?.();
        }
        context.client.invalidateQueries({
          queryKey: orpc.activity.totalPoints.queryKey(),
        });
      },
    })
  );
}
