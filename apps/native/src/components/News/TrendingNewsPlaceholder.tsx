import { SkeletonGroup } from "heroui-native/skeleton-group";
import { useWindowDimensions, View } from "react-native";

export default function TrendingNewsPlaceholder() {
  const { width, height } = useWindowDimensions();

  return (
    <SkeletonGroup isLoading>
      <View
        className="mr-[25px]"
        style={{ width: width * 0.78, height: height * 0.33 }}
      >
        <SkeletonGroup.Item className="h-full w-full rounded-lg" />
      </View>
    </SkeletonGroup>
  );
}
