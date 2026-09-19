import { BottomSheetView } from "@gorhom/bottom-sheet";
import { format } from "date-fns/format";
import { BottomSheet } from "heroui-native/bottom-sheet";
import { Dialog } from "heroui-native/dialog";
import { Separator } from "heroui-native/separator";
import { useState } from "react";
import { View } from "react-native";
import { Calendar } from "#/components/heroui/calendar";
import { Text } from "#/components/heroui/text";
import { Button } from "./button";

export type DateRangePresentation = "bottom-sheet" | "dialog";

export type DateRangePickerProps = {
  open: boolean;
  onOpenChange: (val: boolean) => void;
  onDateFilter: (start: Date, end: Date) => void;
  presentation?: DateRangePresentation;
  label?: string;
  placeholder?: string;
  startDate?: Date;
  endDate?: Date;
  min?: Date;
  max?: Date;
};

// ─── Shared calendar + action buttons ────────────────────────────────────────

type CalendarShellProps = {
  rangeStart?: Date;
  rangeEnd?: Date;
  onRangeChange: (start: Date, end: Date | undefined) => void;
  onConfirm: () => void;
  onCancel: () => void;
  min?: Date;
  max?: Date;
};

function CalendarShell({
  rangeStart,
  rangeEnd,
  onRangeChange,
  onConfirm,
  onCancel,
  min,
  max,
}: CalendarShellProps) {
  return (
    <View className="gap-4 px-4 pt-2 pb-4">
      {/* Range label */}
      {(rangeStart || rangeEnd) && (
        <View className="flex-row items-center justify-center gap-2">
          <View className="flex-1 rounded-lg bg-surface px-3 py-2">
            <Text className="text-center text-secondary text-xs">From</Text>
            <Text className="text-center font-medium text-sm">
              {rangeStart ? format(rangeStart, "dd MMM yyyy") : "–"}
            </Text>
          </View>
          <Text className="text-secondary">→</Text>
          <View className="flex-1 rounded-lg bg-surface px-3 py-2">
            <Text className="text-center text-secondary text-xs">To</Text>
            <Text className="text-center font-medium text-sm">
              {rangeEnd ? format(rangeEnd, "dd MMM yyyy") : "–"}
            </Text>
          </View>
        </View>
      )}

      <Calendar
        max={max}
        min={min}
        onRangeChange={onRangeChange}
        rangeEnd={rangeEnd}
        rangeStart={rangeStart}
      />

      <Separator />

      <View className="flex-row gap-3">
        <Button className="flex-1" onPress={onCancel} variant="secondary">
          <Button.Label>Cancel</Button.Label>
        </Button>
        <Button
          className="flex-1"
          isDisabled={!(rangeStart && rangeEnd)}
          onPress={onConfirm}
        >
          <Button.Label>Apply</Button.Label>
        </Button>
      </View>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DateRangePicker({
  open,
  onOpenChange,
  onDateFilter,
  presentation = "bottom-sheet",
  label = "Select date range",
  startDate,
  endDate,
  min,
  max,
}: DateRangePickerProps) {
  const [rangeStart, setRangeStart] = useState<Date | undefined>(startDate);
  const [rangeEnd, setRangeEnd] = useState<Date | undefined>(endDate);

  const handleRangeChange = (start: Date, end: Date | undefined) => {
    setRangeStart(start);
    setRangeEnd(end);
  };

  const handleConfirm = () => {
    if (!(rangeStart && rangeEnd)) {
      return;
    }
    onDateFilter(rangeStart, rangeEnd);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setRangeStart(startDate);
    setRangeEnd(endDate);
    onOpenChange(false);
  };

  const shellProps: CalendarShellProps = {
    rangeStart,
    rangeEnd,
    onRangeChange: handleRangeChange,
    onConfirm: handleConfirm,
    onCancel: handleCancel,
    min,
    max,
  };

  // ── Bottom Sheet ────────────────────────────────────────────────────────────
  if (presentation === "bottom-sheet") {
    return (
      <BottomSheet isOpen={open} onOpenChange={onOpenChange}>
        {/* disableFullWindowOverlay in dev: default FullWindowOverlay renders
        in a separate native window and blocks the RN element inspector. */}
        <BottomSheet.Portal disableFullWindowOverlay={__DEV__}>
          <BottomSheet.Overlay />
          <BottomSheet.Content
            contentContainerClassName="pb-safe"
            enableDynamicSizing
          >
            <BottomSheetView>
              <BottomSheet.Title className="px-4 pt-4 font-semibold text-base">
                {label}
              </BottomSheet.Title>
              <CalendarShell {...shellProps} />
            </BottomSheetView>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    );
  }

  // ── Dialog ──────────────────────────────────────────────────────────────────
  return (
    <Dialog isOpen={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Title>{label}</Dialog.Title>
          <CalendarShell {...shellProps} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
