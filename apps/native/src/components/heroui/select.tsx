import { LinearGradient } from "expo-linear-gradient";
import { ControlField } from "heroui-native/control-field";
import { FieldError } from "heroui-native/field-error";
import { useThemeColor } from "heroui-native/hooks";
import { Label } from "heroui-native/label";
import { ScrollShadow } from "heroui-native/scroll-shadow";
import { Select } from "heroui-native/select";
import { cn } from "heroui-native/utils";
import type { ReactNode } from "react";
import { useController, useFormContext } from "react-hook-form";
import { ScrollView } from "react-native";
import { KeyboardController } from "react-native-keyboard-controller";

type SelectOption = { label: string; value: string };
type ItemRenderProps = { isSelected: boolean };

type Props = {
  name: string;
  placeholder: string;
  label?: string;
  labelClassName?: string;
  options: SelectOption[];
  renderItem: (option: SelectOption, props: ItemRenderProps) => ReactNode;
  renderTriggerPrefix?: () => ReactNode;
  selectionMode?: "single" | "multiple";
  scrollable?: boolean;
  contentClassName?: string;
  triggerClassName?: string;
  controlFieldClassName?: string;
};

export function FormSelectField({
  name,
  placeholder,
  label,
  labelClassName,
  options,
  renderItem,
  renderTriggerPrefix,
  selectionMode = "single",
  scrollable = false,
  contentClassName,
  triggerClassName,
  controlFieldClassName,
}: Props) {
  const { control } = useFormContext();
  const { field, fieldState } = useController({ name, control });
  const { error, invalid } = fieldState;

  return (
    <ControlField
      className={cn("flex-col items-stretch gap-1.5", controlFieldClassName)}
      isInvalid={invalid}
    >
      {label && (
        <Label>
          <Label.Text className={cn("", labelClassName)}>{label}</Label.Text>
        </Label>
      )}
      <Select
        onValueChange={(val) => {
          field.onChange(val);
          field.onBlur();
        }}
        presentation="popover"
        selectionMode={selectionMode}
        value={field.value}
      >
        <Select.Trigger
          className={cn(
            "h-12.5 w-full flex-row items-center gap-2 rounded-lg border-[1.5px] px-3.5",
            invalid ? "border-danger" : "border-field-border",
            triggerClassName
          )}
          onPress={() => KeyboardController.dismiss()}
          variant="unstyled"
        >
          {renderTriggerPrefix?.()}
          <Select.Value
            className={cn(
              "text-sm",
              (!field.value || field.value?.length === 0) &&
                "text-field-placeholder"
            )}
            numberOfLines={1}
            placeholder={placeholder}
          />
          <Select.TriggerIndicator />
        </Select.Trigger>

        <Select.Portal>
          <Select.Overlay className="bg-black/50" />
          <Select.Content
            avoidCollisions
            className={cn(
              "rounded-xl px-0 py-2",
              scrollable && "aspect-[1.2] overflow-hidden p-0 py-2",
              contentClassName
            )}
            placement="bottom"
            presentation="popover"
            width="trigger"
          >
            <MaybeScrollable scrollable={scrollable}>
              {options.map((option) => (
                <Select.Item
                  className="flex-1 flex-row overflow-hidden rounded-[10px] p-0 px-2"
                  key={option.value}
                  label={option.label}
                  value={option.value}
                >
                  {(renderProps) => renderItem(option, renderProps)}
                </Select.Item>
              ))}
            </MaybeScrollable>
          </Select.Content>
        </Select.Portal>
      </Select>

      <FieldError className="pl-1 text-xs">{error?.message}</FieldError>
    </ControlField>
  );
}

function MaybeScrollable({
  scrollable,
  children,
}: {
  scrollable: boolean;
  children: ReactNode;
}) {
  const themeColorOverlay = useThemeColor("overlay");

  if (!scrollable) {
    return <>{children}</>;
  }

  return (
    <ScrollShadow
      color={themeColorOverlay}
      LinearGradientComponent={LinearGradient}
      size={60}
    >
      <ScrollView contentContainerStyle={{ rowGap: 8 }}>{children}</ScrollView>
    </ScrollShadow>
  );
}
