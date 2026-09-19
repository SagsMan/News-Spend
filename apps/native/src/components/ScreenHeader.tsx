import { useNavigation } from "@react-navigation/native";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { cn } from "heroui-native/utils";
import { ArrowLeftIcon } from "#/lib/icons";
import type { ReactNode } from "react";
import { View } from "react-native";
import { Icon } from "./heroui/icon";
import { Text } from "./heroui/text";

type ScreenHeaderProps = {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
};

const ScreenHeader = ({ title, left, right, className }: ScreenHeaderProps) => {
  const navigation = useNavigation();

  return (
    <View
      className={cn(
        "relative w-full flex-row items-center justify-center bg-p-500 px-3 py-2 pt-safe-offset-1",
        className
      )}
    >
      {/* Left Item */}
      <PressableFeedback
        className="min-w-10 items-center justify-center px-2"
        hitSlop={20}
        onPress={() => navigation.goBack()}
      >
        {left === undefined ? (
          <Icon color="white" name={ArrowLeftIcon} size={24} />
        ) : (
          left
        )}
      </PressableFeedback>
      {/* Title */}
      <View className="flex-1 items-center justify-center">
        <Text className="font-medium text-base text-white capitalize">
          {title}
        </Text>
      </View>
      {/* Right Item */}
      <View className="min-w-10 items-center justify-center px-2">{right}</View>
    </View>
  );
};

export default ScreenHeader;
