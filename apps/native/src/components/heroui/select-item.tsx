import { Checkbox } from "heroui-native/checkbox";
import { Select } from "heroui-native/select";
import { cn } from "heroui-native/utils";
import { Text, View } from "react-native";
import { Icon } from "./icon";

// Standard: Icon + Label + Indicator (for single select)
export function StandardItem({
  icon: IconComponent,
  label,
  isSelected,
}: {
  icon?: React.ComponentType<any>;
  label: string;
  isSelected: boolean;
}) {
  return (
    <View
      className={cn(
        "flex-row items-center gap-3 p-3",
        isSelected && "rounded-[10px] bg-gray-200"
      )}
    >
      {IconComponent && (
        <Icon
          className={isSelected ? "text-accent" : "text-subtlest"}
          name={IconComponent}
          size={20}
        />
      )}
      <Text
        className={cn(
          "flex-1",
          isSelected ? "font-medium text-accent" : "text-subtlest"
        )}
      >
        {label}
      </Text>
      {isSelected && <Select.ItemIndicator />}
    </View>
  );
}

// Checkbox: Icon + Label + Checkbox (for multi-select)
export function CheckboxItem({
  icon: IconComponent,
  label,
  isSelected,
  onToggle,
}: {
  icon?: React.ComponentType<any>;
  label: string;
  isSelected: boolean;
  onToggle: (selected: boolean) => void;
}) {
  return (
    <View
      className={cn(
        "flex-row items-center gap-3 p-3",
        isSelected && "rounded-[10px] bg-[#101928]"
      )}
    >
      {IconComponent && (
        <IconComponent
          className={isSelected ? "text-accent" : "text-gray-500"}
        />
      )}
      <Text
        className={cn(
          "flex-1",
          isSelected ? "font-medium text-accent" : "text-gray-500"
        )}
      >
        {label}
      </Text>
      <Checkbox isSelected={isSelected} onSelectedChange={onToggle} />
    </View>
  );
}
