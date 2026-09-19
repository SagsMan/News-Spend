import type { Activity } from "@news-spend-media/payload/types";
import { format } from "date-fns/format";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { cn } from "heroui-native/utils";
import React from "react";
import { View } from "react-native";
import { Icon } from "#/components/heroui/icon";
import { Text } from "#/components/heroui/text";
import { getActionMeta } from "../constants";

type ActivityRowProps = {
  item: Activity;
  onPress: (item: Activity) => void;
};

export const ActivityRow = React.memo(({ item, onPress }: ActivityRowProps) => {
  const meta = getActionMeta(item.action);
  const isPositive = item.point >= 0;

  return (
    <PressableFeedback onPress={() => onPress(item)}>
      <View className="flex-row items-center gap-3 bg-surface px-4 py-3">
        <View
          className="size-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: meta.bg }}
        >
          <Icon color="#000" name={meta.icon} size={20} />
        </View>

        <View className="flex-1">
          <Text className="font-medium text-sm" numberOfLines={1}>
            {meta.label}
          </Text>
          <Text className="text-secondary text-xs">
            {format(new Date(item.createdAt), "dd MMM · hh:mm a")}
          </Text>
        </View>

        <Text
          className={cn(
            "font-semibold text-sm",
            isPositive ? "text-success" : "text-danger"
          )}
        >
          {isPositive ? "+" : ""}
          {item.point} pts
        </Text>
      </View>
    </PressableFeedback>
  );
});

ActivityRow.displayName = "ActivityRow";
