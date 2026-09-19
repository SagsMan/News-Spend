import { isInferableError } from "@orpc/client";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns/format";
import { Dialog } from "heroui-native/dialog";
import { CakeIcon } from "#/lib/icons";
import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, View } from "react-native";

import { Button } from "#/components/heroui/button";
import { Icon } from "#/components/heroui/icon";
import { toast } from "#/components/heroui/toast";
import { orpc } from "#/lib/orpc";
import { queryClient } from "#/lib/tanstackQuery";
import { Text } from "../ui";

/** Where the picker opens: old enough to be plausible, not old enough to insult. */
const DEFAULT_PICKER_AGE = 25;

function defaultPickerDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - DEFAULT_PICKER_AGE);
  return d;
}

/**
 * Collect a date of birth before someone buys their first ticket.
 *
 * Giveaway prizes are age-restricted, so participation needs a birth date on
 * record. Asked here rather than at signup so it lands at the moment it is
 * actually needed. Someone reading news has no reason to be asked their age,
 * and a required field at signup is a reason to abandon signup.
 *
 * Stated plainly as write-once in the copy, because it is: the endpoint
 * refuses a second write, and the app offers no way to edit it. Saying so
 * up front is fairer than letting someone find out by being locked out.
 */
export default function DateOfBirthDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const [date, setDate] = useState(defaultPickerDate);
  const [pickerVisible, setPickerVisible] = useState(Platform.OS === "ios");

  const save = useMutation(
    orpc.account.setDateOfBirth.mutationOptions({
      onSuccess: () => {
        // The age gate reads from the user record, so anything that reports
        // participation is now stale.
        queryClient.invalidateQueries({
          queryKey: orpc.giveaway.progress.key(),
        });
        queryClient.invalidateQueries({ queryKey: orpc.account.me.key() });
        onOpenChange(false);
        onSaved?.();
      },
      onError: (error) => {
        toast.error(
          isInferableError(error)
            ? error.message
            : "Could not save your date of birth."
        );
      },
    })
  );

  return (
    <Dialog isOpen={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="w-[95%]">
          <Dialog.Close className="absolute top-1 right-2" variant="ghost" />

          <View className="items-center gap-2">
            <Icon color="#00223d" name={CakeIcon} size={40} weight="fill" />
            <Text className="text-center font-semibold text-lg">
              One thing first
            </Text>
            <Text className="text-center text-subtle-text">
              Giveaway prizes are for over-18s, so we need your date of birth
              before you can buy a ticket.
            </Text>
          </View>

          <View className="mt-4 gap-2">
            {Platform.OS === "android" && (
              <Pressable
                className="rounded-xl border border-gray-200 px-4 py-3"
                onPress={() => setPickerVisible(true)}
              >
                <Text className="text-center text-base">
                  {format(date, "d MMMM yyyy")}
                </Text>
              </Pressable>
            )}

            {pickerVisible && (
              <DateTimePicker
                display={Platform.OS === "ios" ? "spinner" : "default"}
                maximumDate={new Date()}
                mode="date"
                onChange={(_event, selected) => {
                  if (Platform.OS === "android") {
                    setPickerVisible(false);
                  }
                  if (selected) {
                    setDate(selected);
                  }
                }}
                value={date}
              />
            )}
          </View>

          <Text className="mt-1 text-center text-subtle-text text-xs">
            This is saved once and can't be changed later, so please check it.
          </Text>

          <Button
            className="mt-4"
            isDisabled={save.isPending}
            onPress={() =>
              save.mutate({ dateOfBirth: format(date, "yyyy-MM-dd") })
            }
          >
            <Button.Label>
              {save.isPending ? "Saving…" : "Save and continue"}
            </Button.Label>
            {save.isPending && (
              <ActivityIndicator className="ml-2" color="#fff" size="small" />
            )}
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
