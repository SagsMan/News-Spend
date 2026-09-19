import { SkeletonGroup } from "heroui-native/skeleton-group";
import VideoNewsItemPlaceholder from "#/components/videoNews/VideoNewsItemPlaceholder";

export default function LiveListSkeleton() {
  return (
    <SkeletonGroup className="gap-7 px-4 py-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <VideoNewsItemPlaceholder key={index} />
      ))}
    </SkeletonGroup>
  );
}
