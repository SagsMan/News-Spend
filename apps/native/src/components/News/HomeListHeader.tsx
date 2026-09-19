import type { PartnerContent } from "@news-spend-media/payload/types";
import { View } from "react-native";
import type { RouterOutputs } from "#/lib/orpc";
import { Text } from "../heroui/text";
import SpecialCoverage from "./SpecialCoverage";
import TrendingBooks from "./TrendingBooks";
import TrendingNews from "./TrendingNews";

type NewsType = RouterOutputs["news"]["home"]["docs"];

export default function HomeListHeader({
  news,
  specialCoverage = [],
  books = [],
}: {
  news: NewsType;
  specialCoverage: NewsType;
  books: PartnerContent[];
}) {
  return (
    <View className="mb-3 gap-4">
      <Text className="px-4 font-semibold text-base">Trending News</Text>
      <TrendingNews news={news} />

      <TrendingBooks books={books} />

      <SpecialCoverage specialCoverage={specialCoverage} />
      <Text className="px-4 font-semibold text-base">Latest News</Text>
    </View>
  );
}
