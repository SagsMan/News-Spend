import { auth } from "@news-spend-media/auth";
import { getPayload } from "@news-spend-media/payload";

export type CreateContextOptions = {
  context?: {
    req?: {
      raw?: {
        headers: Headers;
      };
    };
  };
  request?: Request;
};

export async function createContext({
  context,
  request,
}: CreateContextOptions) {
  const headers =
    context?.req?.raw?.headers || request?.headers || new Headers();

  const [session, payload] = await Promise.all([
    auth.api.getSession({
      headers,
    }),
    getPayload(),
  ]);

  return {
    session: session?.session,
    user: session?.user,
    payload,
    request: request || context?.req?.raw,
    headers,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
