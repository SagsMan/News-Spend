import { addMonths } from "date-fns/addMonths";
import { eachDayOfInterval } from "date-fns/eachDayOfInterval";
import { endOfMonth } from "date-fns/endOfMonth";
import { endOfWeek } from "date-fns/endOfWeek";
import { format } from "date-fns/format";
import { isAfter } from "date-fns/isAfter";
import { isBefore } from "date-fns/isBefore";
import { isSameDay } from "date-fns/isSameDay";
import { isSameMonth } from "date-fns/isSameMonth";
import { isWithinInterval } from "date-fns/isWithinInterval";
import { startOfMonth } from "date-fns/startOfMonth";
import { startOfWeek } from "date-fns/startOfWeek";
import { subMonths } from "date-fns/subMonths";
import { cn } from "heroui-native/utils";
import { CaretLeftIcon, CaretRightIcon } from "#/lib/icons";
import type React from "react";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { tv } from "tailwind-variants";
import { Text } from "#/components/heroui/text";
import { Icon } from "./icon";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DayState = {
  isSelected: boolean;
  isToday: boolean;
  isStart: boolean;
  isEnd: boolean;
  isCap: boolean;
  isMiddle: boolean;
  isInRange: boolean;
  isDisabled: boolean;
  isCurrentMonth: boolean;
};

export type CalendarClassNames = {
  container?: string;
  header?: string;
  monthLabel?: string;
  navButton?: string;
  weekdayRow?: string;
  weekdayLabel?: string;
  dayGrid?: string;
  dayRow?: string;
  rangeFill?: string;
  dayCircle?: string;
  dayCircleSelected?: string;
  dayCircleToday?: string;
  dayText?: string;
  dayTextSelected?: string;
  dayTextToday?: string;
  dayTextOutOfMonth?: string;
  dayTextDisabled?: string;
  dayTextInRange?: string;
};

export type CalendarProps = {
  selected?: Date;
  onSelect?: (date: Date) => void;
  rangeStart?: Date;
  rangeEnd?: Date;
  onRangeChange?: (start: Date, end: Date | undefined) => void;
  min?: Date;
  max?: Date;
  classNames?: CalendarClassNames;
  renderDay?: (day: Date, state: DayState) => React.ReactNode;
};

// ─── Exported Variants ────────────────────────────────────────────────────────

export const dayCircleVariants = tv({
  base: "h-9 w-9 items-center justify-center",
  variants: {
    selected: { true: "bg-p-400" },
    today: { true: "rounded-full border border-p-400" },
  },
  defaultVariants: { selected: false, today: false },
});

export const dayTextVariants = tv({
  base: "text-foreground text-sm",
  variants: {
    selected: { true: "font-semibold text-white" },
    today: { true: "font-semibold text-p-400" },
    outOfMonth: { true: "text-muted-foreground opacity-40" },
    disabled: { true: "text-muted-foreground opacity-30" },
    inRange: { true: "text-foreground" },
  },
  compoundVariants: [
    {
      selected: true,
      today: true,
      class: "font-semibold text-white",
    },
  ],
  defaultVariants: {
    selected: false,
    today: false,
    outOfMonth: false,
    disabled: false,
    inRange: false,
  },
});

export const rangeFillVariants = tv({
  base: "absolute inset-y-1 bg-p-400/20",
  variants: {
    position: {
      start: "right-0 left-1/2",
      end: "right-1/2 left-0",
      middle: "right-0 left-0",
      none: "hidden",
    },
  },
  defaultVariants: { position: "none" },
});

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// ─── Default Day Cell ─────────────────────────────────────────────────────────

function DefaultDayCell({
  day,
  state,
  classNames = {},
}: {
  day: Date;
  state: DayState;
  classNames?: CalendarClassNames;
}) {
  let fillPosition: "start" | "end" | "middle" | "none" = "none";
  if (state.isStart) {
    fillPosition = "start";
  } else if (state.isEnd) {
    fillPosition = "end";
  } else if (state.isMiddle) {
    fillPosition = "middle";
  }

  return (
    <View className={cn("relative items-center py-0.5", classNames.dayRow)}>
      {/* Range fill strip */}
      <View
        className={rangeFillVariants({
          position: fillPosition,
          class: classNames.rangeFill,
        })}
      />

      {/* Day circle */}
      <View
        className={dayCircleVariants({
          selected: state.isSelected || state.isCap,
          today: state.isToday && !state.isSelected && !state.isCap,
          class: cn(
            classNames.dayCircle,
            (state.isSelected || state.isCap) && classNames.dayCircleSelected,
            state.isToday &&
              !state.isSelected &&
              !state.isCap &&
              classNames.dayCircleToday
          ),
        })}
      >
        <Text
          className={dayTextVariants({
            selected: state.isSelected || state.isCap,
            today: state.isToday && !state.isSelected && !state.isCap,
            outOfMonth: !state.isCurrentMonth,
            disabled: state.isDisabled,
            inRange: state.isMiddle,
            class: cn(
              classNames.dayText,
              (state.isSelected || state.isCap) && classNames.dayTextSelected,
              state.isToday &&
                !state.isSelected &&
                !state.isCap &&
                classNames.dayTextToday,
              !state.isCurrentMonth && classNames.dayTextOutOfMonth,
              state.isDisabled && classNames.dayTextDisabled,
              state.isMiddle && classNames.dayTextInRange
            ),
          })}
        >
          {format(day, "d")}
        </Text>
      </View>
    </View>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

export function Calendar({
  selected,
  onSelect,
  rangeStart,
  rangeEnd,
  onRangeChange,
  min,
  max,
  classNames = {},
  renderDay,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(
    rangeStart ?? selected ?? new Date()
  );

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth)),
    end: endOfWeek(endOfMonth(currentMonth)),
  });

  const handleDayPress = (day: Date) => {
    if (min && isBefore(day, min)) {
      return;
    }
    if (max && isAfter(day, max)) {
      return;
    }

    if (onRangeChange) {
      if (!rangeStart || (rangeStart && rangeEnd)) {
        onRangeChange(day, undefined);
      } else if (isBefore(day, rangeStart)) {
        onRangeChange(day, rangeStart);
      } else {
        onRangeChange(rangeStart, day);
      }
    } else {
      onSelect?.(day);
    }
  };

  return (
    <View className={cn(classNames.container)}>
      {/* Month navigation */}
      <View
        className={cn(
          "mb-3 flex-row items-center justify-between px-1",
          classNames.header
        )}
      >
        <Pressable
          className={cn(
            "size-9 items-center justify-center rounded-full active:bg-muted",
            classNames.navButton
          )}
          onPress={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <Icon name={CaretLeftIcon} size={20} />
        </Pressable>

        <Text
          className={cn(
            "font-semibold text-foreground text-sm",
            classNames.monthLabel
          )}
        >
          {format(currentMonth, "MMMM yyyy")}
        </Text>

        <Pressable
          className={cn(
            "size-9 items-center justify-center rounded-full active:bg-muted",
            classNames.navButton
          )}
          onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <Icon name={CaretRightIcon} size={20} />
        </Pressable>
      </View>

      {/* Weekday headers */}
      <View className={cn("mb-1 flex-row", classNames.weekdayRow)}>
        {WEEKDAYS.map((d) => (
          <View className="flex-1 items-center py-1" key={d}>
            <Text
              className={cn(
                "font-medium text-muted-foreground text-xs",
                classNames.weekdayLabel
              )}
            >
              {d}
            </Text>
          </View>
        ))}
      </View>

      {/* Day grid */}
      <View className={cn("flex-row flex-wrap", classNames.dayGrid)}>
        {days.map((day) => {
          const isDisabled =
            (!!min && isBefore(day, min)) || (!!max && isAfter(day, max));
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());
          const isSelected = !!selected && isSameDay(day, selected);
          const isStart = !!rangeStart && isSameDay(day, rangeStart);
          const isEnd = !!rangeEnd && isSameDay(day, rangeEnd);
          const isCap = isStart || isEnd;
          const isInRange =
            !!rangeStart &&
            !!rangeEnd &&
            isWithinInterval(day, { start: rangeStart, end: rangeEnd });
          const isMiddle = isInRange && !isCap;

          const state: DayState = {
            isSelected,
            isToday,
            isStart,
            isEnd,
            isCap,
            isMiddle,
            isInRange,
            isDisabled,
            isCurrentMonth,
          };

          return (
            <Pressable
              disabled={isDisabled}
              key={day.toISOString()}
              onPress={() => handleDayPress(day)}
              style={{ width: `${100 / 7}%` }}
            >
              {renderDay ? (
                renderDay(day, state)
              ) : (
                <DefaultDayCell
                  classNames={classNames}
                  day={day}
                  state={state}
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
