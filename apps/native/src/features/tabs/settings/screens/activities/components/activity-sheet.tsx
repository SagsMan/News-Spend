import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import type { Activity } from "@news-spend-media/payload/types";
import { format } from "date-fns/format";
import { Image } from "expo-image";
import { BottomSheet } from "heroui-native/bottom-sheet";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { Tabs } from "heroui-native/tabs";
import { cn } from "heroui-native/utils";
import { NewspaperIcon } from "#/lib/icons";
import { useState } from "react";
import { View } from "react-native";
import { Icon } from "#/components/heroui/icon";
import { Text } from "#/components/heroui/text";
import { navigate as navigateToScreen } from "#/navigation/navigationUtils";
import { getImageData } from "#/utils";
import { getActionMeta } from "../constants";

type ActivitySheetProps = {
  activity: Activity | null;
  isOpen: boolean;
  onOpenChange: (val: boolean) => void;
};

type ActivitySheetContentProps = {
  activity: Activity;
  onClose: () => void;
};

function ActivitySheetContent({
  activity,
  onClose,
}: ActivitySheetContentProps) {
  const [activeTab, setActiveTab] = useState("details");

  const meta = getActionMeta(activity.action);
  const isPositive = activity.point >= 0;
  const news = typeof activity.news === "object" ? activity.news : null;
  const { url, blurhash } = getImageData(news?.image);

  const onNewsPress = () => {
    if (!news) {
      return;
    }
    navigateToScreen("News", { slug: news.slug, id: news.id });
    onClose();
  };

  return (
    <BottomSheetScrollView
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
    >
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View
            className="h-11 w-11 items-center justify-center rounded-2xl"
            style={{ backgroundColor: meta.bg }}
          >
            <Icon color="#000" name={meta.icon} size={24} />
          </View>
          <View>
            <BottomSheet.Title className="font-semibold text-base">
              {meta.label}
            </BottomSheet.Title>
            <Text className="text-secondary text-xs capitalize">
              {activity.type ?? "point"} ·{" "}
              {format(new Date(activity.createdAt), "hh:mm a")}
            </Text>
          </View>
        </View>
      </View>

      <View
        className={cn(
          "mb-4 flex-row items-center gap-3 rounded-2xl px-4 py-3",
          isPositive ? "bg-success-50" : "bg-danger-50"
        )}
      >
        <Text
          className={cn(
            "font-bold text-3xl tracking-tight",
            isPositive ? "text-success-800" : "text-danger-800"
          )}
        >
          {isPositive ? "+" : ""}
          {activity.point}
        </Text>
        <Text
          className={cn(
            "font-medium text-sm",
            isPositive ? "text-success-600" : "text-danger-600"
          )}
        >
          points {isPositive ? "earned" : "spent"}
        </Text>
      </View>

      <Tabs className="mb-4" onValueChange={setActiveTab} value={activeTab}>
        <Tabs.List>
          <Tabs.ScrollView>
            <Tabs.Indicator />
            <Tabs.Trigger value="details">
              <Tabs.Label>Details</Tabs.Label>
            </Tabs.Trigger>
            {activity.news && (
              <Tabs.Trigger value="linked">
                <Tabs.Label>Linked content</Tabs.Label>
              </Tabs.Trigger>
            )}
            {activity.metadata && (
              <Tabs.Trigger value="meta">
                <Tabs.Label>Metadata</Tabs.Label>
              </Tabs.Trigger>
            )}
          </Tabs.ScrollView>
        </Tabs.List>

        <Tabs.Content value="details">
          <View className="gap-3 pt-3">
            <View className="flex-row gap-2">
              <View className="flex-1 rounded-xl bg-surface p-3">
                <Text className="mb-1 font-semibold text-secondary text-xs uppercase">
                  Action
                </Text>
                <Text className="font-medium text-sm">{meta.label}</Text>
              </View>
              <View className="flex-1 rounded-xl bg-surface p-3">
                <Text className="mb-1 font-semibold text-secondary text-xs uppercase">
                  Type
                </Text>
                <Text className="font-medium text-sm capitalize">
                  {activity.type ?? "point"}
                </Text>
              </View>
            </View>

            <View className="flex-row gap-2">
              <View className="flex-1 rounded-xl bg-surface p-3">
                <Text className="mb-1 font-semibold text-secondary text-xs uppercase">
                  Date
                </Text>
                <Text className="font-medium text-sm">
                  {format(new Date(activity.createdAt), "dd/MM/yyyy")}
                </Text>
              </View>
              <View className="flex-1 rounded-xl bg-surface p-3">
                <Text className="mb-1 font-semibold text-secondary text-xs uppercase">
                  Time
                </Text>
                <Text className="font-medium text-sm">
                  {format(new Date(activity.createdAt), "hh:mm a")}
                </Text>
              </View>
            </View>

            <View className="rounded-xl bg-surface p-3">
              <Text className="mb-1 font-semibold text-secondary text-xs uppercase">
                Activity ID
              </Text>
              <Text
                className="font-mono text-secondary text-xs"
                numberOfLines={1}
              >
                {activity.id}
              </Text>
            </View>

            {activity.description && (
              <View className="rounded-xl bg-surface p-3">
                <Text className="mb-1 font-semibold text-secondary text-xs uppercase">
                  Description
                </Text>
                <Text className="text-secondary text-sm leading-5">
                  {activity.description}
                </Text>
              </View>
            )}

            {activity.reward && (
              <View className="rounded-xl bg-surface p-3">
                <Text className="mb-1 font-semibold text-secondary text-xs uppercase">
                  Reward
                </Text>
                <Text className="font-medium text-sm">{activity.reward}</Text>
              </View>
            )}
          </View>
        </Tabs.Content>

        {news && (
          <Tabs.Content value="linked">
            <View className="gap-3 pt-3">
              <View className="flex-row items-center gap-3 rounded-xl bg-surface p-3">
                <View className="size-14 items-center justify-center overflow-hidden rounded-xl bg-p-100">
                  {news.image ? (
                    <Image
                      contentFit="cover"
                      placeholder={{ blurhash }}
                      placeholderContentFit="cover"
                      source={url}
                      style={{ height: "100%", width: "100%" }}
                    />
                  ) : (
                    <Icon color="white" name={NewspaperIcon} size={24} />
                  )}
                </View>
                <PressableFeedback className="flex-1" onPress={onNewsPress}>
                  <Text
                    className="font-medium text-sm leading-5"
                    numberOfLines={3}
                  >
                    {news.title ?? "News article"}
                  </Text>
                  <Text className="mt-1 text-secondary text-xs">
                    Tap to open article
                  </Text>
                </PressableFeedback>
              </View>
            </View>
          </Tabs.Content>
        )}

        {activity.metadata && (
          <Tabs.Content value="meta">
            <View className="gap-2 pt-3">
              {Object.entries(activity.metadata as Record<string, unknown>).map(
                ([key, value]) => (
                  <View className="rounded-xl bg-surface p-3" key={key}>
                    <Text className="mb-1 font-semibold text-secondary text-xs uppercase">
                      {key}
                    </Text>
                    <Text className="font-mono text-secondary text-xs">
                      {String(value)}
                    </Text>
                  </View>
                )
              )}
            </View>
          </Tabs.Content>
        )}
      </Tabs>
    </BottomSheetScrollView>
  );
}

export function ActivitySheet({
  activity,
  isOpen,
  onOpenChange,
}: ActivitySheetProps) {
  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      {/* disableFullWindowOverlay in dev: default FullWindowOverlay renders in
      a separate native window and blocks the RN element inspector. */}
      <BottomSheet.Portal disableFullWindowOverlay={__DEV__}>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          contentContainerClassName="h-full"
          enableDynamicSizing={false}
          enableOverDrag={false}
          snapPoints={["55%", "85%"]}
        >
          {activity ? (
            <ActivitySheetContent
              activity={activity}
              onClose={() => onOpenChange(false)}
            />
          ) : null}
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
