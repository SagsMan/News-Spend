import { SkeletonGroup } from "heroui-native/skeleton-group";
import { View } from "react-native";

export default function NewsItemPlaceholder({
  show,
  latest,
}: {
  show: boolean;
  latest?: boolean;
}) {
  return (
    <SkeletonGroup isLoading={show}>
      <View className="gap-2.5">
        <View className="flex-row gap-4">
          <SkeletonGroup.Item className="size-[100px] rounded-[10px]" />
          <View
            className={`flex-1 ${latest ? "justify-between" : "justify-center gap-4"}`}
          >
            {latest && (
              <SkeletonGroup.Item className="h-5 w-[100px] rounded-sm" />
            )}
            <SkeletonGroup.Item className="h-10 w-full rounded-sm" />
            <SkeletonGroup.Item className="h-5 w-full rounded-sm" />
          </View>
        </View>
      </View>
    </SkeletonGroup>
  );
}
