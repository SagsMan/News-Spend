import type { z } from "zod";

export type FetchWithZodResult<T extends z.ZodTypeAny> = Awaited<
  ReturnType<T["safeParseAsync"]>
>;

type FetchParams = Parameters<typeof fetch>;

export const fetchWithZod = async <TSuccess extends z.ZodTypeAny>(
  successSchema: TSuccess,
  ...params: FetchParams
): Promise<FetchWithZodResult<TSuccess>> => {
  const response = await fetch(...params);

  if (!response.ok) {
    throw new Error(response.statusText);
  }

  const data: unknown = await response.json();

  return (await successSchema.safeParseAsync(
    data
  )) as FetchWithZodResult<TSuccess>;
};
