import { describe, expect, it } from "bun:test";

import { computeScore } from "./trending-scorer";

describe("computeScore", () => {
  it("calculates raw score with provided weights and no time decay (now)", () => {
    const signals = {
      views: 10,
      likes: 2,
      comments: 1,
      shares: 0,
      reads: 3,
      dislikes: 0,
      createdAt: new Date(),
    } as const;

    const weights = {
      views: 1,
      likes: 3,
      comments: 5,
      shares: 4,
      reads: 2,
      dislikes: -1.5,
    };

    // raw score = 10*1 + 2*3 + 1*5 + 0*4 + 3*2 + 0*-1.5 = 27
    const score = computeScore(signals, weights);
    expect(score).toBeCloseTo(27, 6);
  });

  it("applies time decay for older articles", () => {
    const past = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
    const signals = {
      views: 10,
      likes: 2,
      comments: 1,
      shares: 0,
      reads: 3,
      dislikes: 0,
      createdAt: past,
    } as const;

    const weights = {
      views: 1,
      likes: 3,
      comments: 5,
      shares: 4,
      reads: 2,
      dislikes: -1.5,
    };

    // raw score = 27, timeFactor = (1 + 48/24) ** 1.5 = (3) ** 1.5
    const expected = 27 / 3 ** 1.5;
    const score = computeScore(signals, weights);
    expect(score).toBeCloseTo(expected, 6);
  });

  it("respects negative dislike weight", () => {
    const signals = {
      views: 5,
      likes: 1,
      comments: 0,
      shares: 0,
      reads: 0,
      dislikes: 4,
      createdAt: new Date(),
    } as const;

    const weights = {
      views: 1,
      likes: 2,
      comments: 0,
      shares: 0,
      reads: 0,
      dislikes: -2,
    };

    // raw = 5*1 + 1*2 + 4*-2 = 5 + 2 - 8 = -1
    const score = computeScore(signals, weights);
    expect(score).toBeCloseTo(-1, 6);
  });
});
