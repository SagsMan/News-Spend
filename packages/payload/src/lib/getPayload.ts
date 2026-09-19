import type { Payload } from "payload";
import { getPayload as _getPayload } from "payload";

import { configurePayload } from "../configurePayload";

export const singleton = <Value>(
  name: string,
  valueFactory: () => Promise<Value> | Value
): Promise<Value> => {
  const g = global as typeof global & {
    __singletons?: Record<string, Promise<Value>>;
  };

  g.__singletons ??= {};

  const cached = g.__singletons[name];
  if (cached) {
    return cached;
  }

  const pending = Promise.resolve(valueFactory());

  // `??=` kept a rejected promise cached forever, so one failed Postgres
  // connection poisoned every later getPayload() for the life of the process.
  // The server stayed up while every request that needed Payload failed.
  // Evicting lets the next call retry.
  pending.catch(() => {
    if (g.__singletons?.[name] === pending) {
      delete g.__singletons[name];
    }
  });

  g.__singletons[name] = pending;

  return pending;
};

export const getPayload = async (): Promise<Payload> =>
  singleton("payload", async () => {
    const config = configurePayload();
    return await _getPayload({ config });
  });
