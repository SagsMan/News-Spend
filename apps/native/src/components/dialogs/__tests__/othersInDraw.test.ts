import { othersInDraw, sealedCardStake } from "../othersInDraw";

describe("othersInDraw", () => {
  it("excludes the person reading it", () => {
    // The engine's count includes them, so a lone entrant has nobody else.
    expect(othersInDraw(1)).toBe(0);
    expect(othersInDraw(2)).toBe(1);
    expect(othersInDraw(1274)).toBe(1273);
  });

  it("never goes negative", () => {
    // `totalValidParticipants` is only written when a draw runs, so an older
    // or interrupted giveaway can leave it null or zero.
    expect(othersInDraw(0)).toBe(0);
    expect(othersInDraw(null)).toBe(0);
    expect(othersInDraw(undefined)).toBe(0);
  });
});

describe("sealedCardStake", () => {
  it("says nothing about others when there are none", () => {
    // "alongside 0 others" is worse than silence, and "alongside 1 others"
    // are both bugs this replaces: miscounting and inventing a rival.
    expect(sealedCardStake(1, 1)).toBe("You entered with 1 ticket.");
  });

  it("counts tickets and rivals separately", () => {
    expect(sealedCardStake(3, 1)).toBe("You entered with 3 tickets.");
    expect(sealedCardStake(1, 2)).toBe(
      "You entered with 1 ticket, alongside 1 other."
    );
    expect(sealedCardStake(16, 1274)).toBe(
      "You entered with 16 tickets, alongside 1,273 others."
    );
  });
});
