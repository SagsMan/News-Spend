import { Skeleton } from "heroui-native/skeleton";
import { useWindowDimensions } from "react-native";

const VideoNewsItemPlaceholder = () => {
  const { height } = useWindowDimensions();

  return (
    <Skeleton
      className="w-full overflow-hidden rounded-lg"
      style={{ height: height * 0.3 }}
    />
  );
};
export default VideoNewsItemPlaceholder;
