/**
 * How many *other* people were in the draw.
 *
 * The engine's `totalValidParticipants` counts everyone holding a valid
 * ticket, including the person reading the card. Without the subtraction a
 * lone entrant was told they entered "alongside 1 others", which both
 * miscounted the room and put a rival in it who did not exist.
 *
 * Clamped at zero because the count is only written when a draw runs, so an
 * interrupted or older giveaway can leave it null.
 */
export function othersInDraw(
  totalParticipants: number | null | undefined
): number {
  return Math.max(0, (totalParticipants ?? 0) - 1);
}

/**
 * The sealed card's one line about what this person had riding on the draw.
 *
 * Kept out of the component so the arithmetic and the pluralisation can be
 * tested without rendering a dialog, since both were wrong in the first version,
 * and neither is the sort of thing anyone re-reads once it looks roughly
 * right on screen.
 */
export function sealedCardStake(
  tickets: number,
  totalParticipants: number | null | undefined
): string {
  const others = othersInDraw(totalParticipants);
  const ticketPart = `You entered with ${tickets} ticket${tickets === 1 ? "" : "s"}`;

  if (others === 0) {
    return `${ticketPart}.`;
  }

  return `${ticketPart}, alongside ${others.toLocaleString()} other${
    others === 1 ? "" : "s"
  }.`;
}
