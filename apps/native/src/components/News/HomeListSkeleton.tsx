import { SkeletonGroup } from "heroui-native/skeleton-group";
import { ScrollView, useWindowDimensions, View } from "react-native";

export default function HomeListSkeleton() {
  const { height, width } = useWindowDimensions();

  return (
    <ScrollView
      className="bg-white pt-2.5"
      contentContainerClassName="pb-4"
      scrollEnabled={false}
    >
      <SkeletonGroup isLoading>
        {/* Hero carousel */}
        <View className="flex-row gap-3.5 px-3.75">
          <SkeletonGroup.Item
            className="rounded-lg"
            style={{ width: width * 0.88, height: height * 0.33 }}
          />
          <SkeletonGroup.Item
            className="rounded-lg"
            style={{ width: width * 0.88, height: height * 0.33 }}
          />
        </View>

        {/* Section divider */}
        <View className="my-2 h-2" />

        {/* Horizontal scroll section */}
        <View className="gap-4 px-3">
          <SkeletonGroup.Item className="h-5 w-50 rounded-md" />
          <View className="flex-row gap-3.75">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonGroup.Item
                className="rounded-md"
                key={i}
                style={{ width: 150, height: 150 }}
              />
            ))}
          </View>
        </View>

        <View className="my-2 h-2" />

        {/* Second horizontal scroll section */}
        <View className="gap-4 px-3">
          <SkeletonGroup.Item className="h-5 w-50 rounded-md" />
          <View className="flex-row gap-3.75">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonGroup.Item
                className="rounded-md"
                key={i}
                style={{ width: 120, height: 170 }}
              />
            ))}
          </View>
        </View>

        <View className="my-2 h-2" />

        {/* Vertical list section */}
        <View className="gap-4 px-3">
          <SkeletonGroup.Item className="h-5 w-42.5 rounded-md" />
          <View className="gap-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonGroup.Item
                className="w-full rounded-md"
                key={i}
                style={{ height: 120 }}
              />
            ))}
          </View>
        </View>
      </SkeletonGroup>
    </ScrollView>
  );
}
