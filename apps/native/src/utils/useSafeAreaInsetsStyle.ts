import { type Edge, useSafeAreaInsets } from "react-native-safe-area-context";

export type ExtendedEdge = Edge | "start" | "end";

const propertySuffixMap = {
  top: "Top",
  bottom: "Bottom",
  left: "Left",
  right: "Right",
  start: "Start",
  end: "End",
} as const;

const edgeInsetMap: Record<ExtendedEdge, Edge> = {
  top: "top",
  bottom: "bottom",
  left: "left",
  right: "right",
  start: "left",
  end: "right",
};

export type SafeAreaInsetsStyle<
  Property extends "padding" | "margin" = "padding",
  Edges extends readonly ExtendedEdge[] = [],
> = {
  [K in Edges[number] as `${Property}${(typeof propertySuffixMap)[K]}`]: number;
};

/**
 * A hook that can be used to create a safe-area-aware style object that can be passed directly to a View.
 * @see [Documentation and Examples]{@link https://docs.infinite.red/ignite-cli/boilerplate/app/utils/useSafeAreaInsetsStyle.ts/}
 * @param {ExtendedEdge[]} safeAreaEdges - The edges to apply the safe area insets to.
 * @param {"padding" | "margin"} property - The property to apply the safe area insets to.
 * @returns {SafeAreaInsetsStyle<Property, Edges>} - The style object with the safe area insets applied.
 */
export function useSafeAreaInsetsStyle<
  Property extends "padding" | "margin" = "padding",
  const Edges extends readonly ExtendedEdge[] = [],
>(
  safeAreaEdges: Edges = [] as unknown as Edges,
  property: Property = "padding" as Property
): SafeAreaInsetsStyle<Property, Edges> {
  const insets = useSafeAreaInsets();

  return Object.fromEntries(
    safeAreaEdges.map((edge) => [
      `${property}${propertySuffixMap[edge]}`,
      insets[edgeInsetMap[edge]],
    ])
  ) as SafeAreaInsetsStyle<Property, Edges>;
}
