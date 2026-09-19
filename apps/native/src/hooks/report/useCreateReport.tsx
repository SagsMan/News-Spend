import { useMutation } from "@tanstack/react-query";

import { orpc } from "#/lib/orpc";

const useCreateReport = () =>
  useMutation(orpc.report.create.mutationOptions({}));
export default useCreateReport;
