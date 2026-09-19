import { describe, expect, it } from "vitest";

import { singleton } from "./getPayload";

describe("singleton", () => {
  it("caches on success and runs the factory once", async () => {
    let calls = 0;
    const factory = () => {
      calls++;
      return Promise.resolve({ id: calls });
    };

    const first = await singleton("success", factory);
    const second = await singleton("success", factory);

    expect(calls).toBe(1);
    expect(first).toBe(second);
  });

  // regression: `??=` cached the rejected promise, so a single failed Postgres
  // connection poisoned every later getPayload() for the life of the process
  it("evicts a rejection so the next call retries", async () => {
    let attempts = 0;
    const flaky = () => {
      attempts++;
      if (attempts === 1) {
        return Promise.reject(new Error("cannot connect to Postgres"));
      }
      return Promise.resolve({ ok: true });
    };

    await expect(singleton("flaky", flaky)).rejects.toThrow(
      "cannot connect to Postgres"
    );

    await expect(singleton("flaky", flaky)).resolves.toEqual({ ok: true });
    expect(attempts).toBe(2);
  });

  it("caches the recovered value like any other success", async () => {
    let attempts = 0;
    const flaky = () => {
      attempts++;
      if (attempts === 1) {
        return Promise.reject(new Error("boom"));
      }
      return Promise.resolve({ ok: true });
    };

    await expect(singleton("recovered", flaky)).rejects.toThrow("boom");
    await singleton("recovered", flaky);
    await singleton("recovered", flaky);

    expect(attempts).toBe(2);
  });
});
