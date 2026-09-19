import {
  LegendList,
  type LegendListRenderItemProps,
} from "@legendapp/list/react-native";
import type { Activity } from "@news-spend-media/payload/types";
import { useInfiniteQuery } from "@tanstack/react-query";
import { addDays } from "date-fns/addDays";
import { subDays } from "date-fns/subDays";
import { Select } from "heroui-native/select";
import { Separator } from "heroui-native/separator";
import { Spinner } from "heroui-native/spinner";
import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { DateRangePicker } from "#/components/heroui/date-range-picker";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import { ToggleButton, ToggleButtonGroup } from "#/components/heroui/toggle";
import { orpc } from "#/lib/orpc";
import { authState } from "#/state/auth";
import { ActivityRow } from "./components/activity-row";
import { ActivitySheet } from "./components/activity-sheet";
import {
  type ActivityType,
  activityOptions,
  type Category,
  dateRangeOptions,
  type SelectOption,
} from "./constants";

export default function Activities() {
  const [activityOption, setActivityOption] = useState<
    SelectOption | undefined
  >(activityOptions[0]);
  const [dateRange, setDateRange] = useState<SelectOption | undefined>(
    dateRangeOptions[0]
  );
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [toggle, setToggle] = useState<ActivityType>("posted");
  const [openDateDialog, setOpenDateDialog] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(
    null
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  const activities = useInfiniteQuery(
    orpc.activity.byUserId.infiniteOptions({
      input: (pageParam: number | undefined) => ({
        startDate: startDate?.toISOString().slice(0, 10),
        endDate: endDate?.toISOString().slice(0, 10),
        category: (activityOption?.value as Category) ?? "all",
        type: toggle,
        limit: 12,
        page: pageParam,
      }),
      initialPageParam: undefined,
      enabled: !!authState.user,
      getNextPageParam: (lastPage) => lastPage.nextPage,
    })
  );

  const allPages = activities.data?.pages.flatMap((page) => page?.docs) ?? [];

  const onSelectActivity = useCallback((item: Activity) => {
    setSelectedActivity(item);
    setSheetOpen(true);
  }, []);

  const onCustomFilter = useCallback((start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
    setDateRange(dateRangeOptions.find((d) => d.value === "custom"));
    setOpenDateDialog(false);
  }, []);

  const onFilter = useCallback((value: SelectOption | undefined) => {
    if (value?.value === "custom") {
      setOpenDateDialog(true);
      return;
    }
    setDateRange(value);
    switch (value?.value) {
      case "today":
        setStartDate(new Date());
        setEndDate(addDays(new Date(), 1));
        break;
      case "yesterday":
        setStartDate(subDays(new Date(), 1));
        setEndDate(new Date());
        break;
      case "last-7-days":
        setStartDate(subDays(new Date(), 7));
        setEndDate(addDays(new Date(), 1));
        break;
      case "last-30-days":
        setStartDate(subDays(new Date(), 30));
        setEndDate(addDays(new Date(), 1));
        break;
      default:
        setStartDate(new Date());
        setEndDate(addDays(new Date(), 1));
        break;
    }
  }, []);

  const onEndReached = useCallback(() => {
    if (activities.hasNextPage && !activities.isFetchingNextPage) {
      activities.fetchNextPage();
    }
  }, [activities]);

  const renderItem = useCallback(
    ({ item }: LegendListRenderItemProps<Activity>) => (
      <ActivityRow item={item} onPress={onSelectActivity} />
    ),
    [onSelectActivity]
  );

  return (
    <Screen navigationBarButtonStyle="dark" statusBarStyle="light">
      <DateRangePicker
        endDate={endDate}
        label="Custom date range"
        max={new Date()}
        onDateFilter={onCustomFilter}
        onOpenChange={setOpenDateDialog}
        open={openDateDialog}
        presentation="bottom-sheet"
        startDate={startDate}
      />

      <LegendList
        contentContainerStyle={{
          paddingHorizontal: 15,
          paddingBottom: 15,
        }}
        data={allPages}
        ItemSeparatorComponent={() => <Separator />}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          activities.isPending ? (
            <View className="mt-3 items-center">
              <Spinner />
            </View>
          ) : (
            <Text className="mt-3 text-center text-secondary">
              No activities for this period
            </Text>
          )
        }
        ListFooterComponent={
          activities.isFetchingNextPage ? (
            <View className="items-center py-3">
              <Spinner />
            </View>
          ) : null
        }
        ListHeaderComponent={
          <View className="my-3 gap-4">
            <View className="flex-row gap-2.5">
              <Select
                className="flex-1"
                onValueChange={setActivityOption}
                value={activityOption}
              >
                <Select.Trigger>
                  <Select.Value numberOfLines={1} placeholder="Category" />
                  <Select.TriggerIndicator />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Overlay className="bg-backdrop" />
                  <Select.Content presentation="popover" width="full">
                    <Select.ListLabel className="mb-2">
                      Category
                    </Select.ListLabel>
                    {activityOptions.map((opt, i) => (
                      <React.Fragment key={opt.value}>
                        <Select.Item label={opt.label} value={opt.value} />
                        {i < activityOptions.length - 1 && <Separator />}
                      </React.Fragment>
                    ))}
                  </Select.Content>
                </Select.Portal>
              </Select>

              <Select
                className="flex-1"
                onValueChange={onFilter}
                value={dateRange}
              >
                <Select.Trigger>
                  <Select.Value numberOfLines={1} placeholder="Date range" />
                  <Select.TriggerIndicator />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Overlay className="bg-backdrop" />
                  <Select.Content presentation="popover" width="full">
                    <Select.ListLabel className="mb-2">
                      Date range
                    </Select.ListLabel>
                    {dateRangeOptions.map((opt, i) => (
                      <React.Fragment key={opt.value}>
                        <Select.Item label={opt.label} value={opt.value} />
                        {i < dateRangeOptions.length - 1 && <Separator />}
                      </React.Fragment>
                    ))}
                  </Select.Content>
                </Select.Portal>
              </Select>
            </View>

            <ToggleButtonGroup
              className="border-none"
              disallowEmptySelection
              onSelectionChange={(value) => setToggle(value[0] as ActivityType)}
              selectedKeys={[toggle ?? "posted"]}
            >
              <ToggleButton className="flex-1" id="posted">
                <ToggleButton.Label>Posted</ToggleButton.Label>
              </ToggleButton>
              <ToggleButton className="flex-1" id="visited">
                <ToggleButton.Label>Visited</ToggleButton.Label>
              </ToggleButton>
              <ToggleButton className="flex-1" id="pending">
                <ToggleButton.Label>Pending</ToggleButton.Label>
              </ToggleButton>
            </ToggleButtonGroup>
          </View>
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        recycleItems
        renderItem={renderItem}
      />

      <ActivitySheet
        activity={selectedActivity}
        isOpen={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </Screen>
  );
}
