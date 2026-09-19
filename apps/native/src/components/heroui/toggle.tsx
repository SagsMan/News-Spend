/**
 * ToggleButton + ToggleButtonGroup: custom component for HeroUI Native
 * Mirrors the HeroUI Native Pro API. Styles via tailwind-variants (tv).
 *
 * ─── Anatomy ─────────────────────────────────────────────────────────────────
 *
 * <ToggleButtonGroup
 *   selectionMode="single" | "multiple"
 *   selectedKeys={["bold"]}
 *   defaultSelectedKeys={[]}
 *   onSelectionChange={(keys) => {}}
 *   disallowEmptySelection
 *   isDisabled
 *   size="sm" | "md" | "lg"
 *   orientation="horizontal" | "vertical"
 *   variant="attached" | "detached"
 *   fullWidth
 * >
 *   <ToggleButton id="bold">
 *     <ToggleButton.Label>Bold</ToggleButton.Label>
 *   </ToggleButton>
 *   <ToggleButtonGroup.Separator />
 *   <ToggleButton id="italic">
 *     <ToggleButton.Label>Italic</ToggleButton.Label>
 *   </ToggleButton>
 * </ToggleButtonGroup>
 *
 * // Standalone
 * <ToggleButton isSelected={on} onChange={setOn}>
 *   <ToggleButton.Label>Mute</ToggleButton.Label>
 * </ToggleButton>
 */

import { useThemeColor } from "heroui-native/hooks";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { Separator } from "heroui-native/separator";
import type React from "react";
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import type { TextStyle, ViewStyle } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { tv } from "tailwind-variants";

// ─── Types ────────────────────────────────────────────────────────────────────

type Size = "sm" | "md" | "lg";
type Orientation = "horizontal" | "vertical";
type GroupVariant = "attached" | "detached";
type SelectionMode = "single" | "multiple";
type Position = "first" | "middle" | "last" | "only" | "detached";

// ─── Tailwind Variants ────────────────────────────────────────────────────────

const toggleButtonStyles = tv({
  slots: {
    root: "overflow-hidden border border-default",
    inner: "flex-row items-center justify-center",
    label: "font-medium",
  },
  variants: {
    size: {
      sm: { inner: "h-8 gap-1.5 px-3", label: "text-xs" },
      md: { inner: "h-10 gap-2 px-4", label: "text-sm" },
      lg: { inner: "h-12 gap-2.5 px-5", label: "text-base" },
    },
    // horizontal position within an attached group
    position: {
      only: { root: "rounded-lg" },
      first: { root: "rounded-r-none rounded-l-lg" },
      middle: { root: "rounded-none" },
      last: { root: "rounded-r-lg rounded-l-none" },
      detached: { root: "rounded-lg" },
    },
    // vertical position within an attached group
    positionV: {
      only: { root: "rounded-lg" },
      first: { root: "rounded-t-lg rounded-b-none" },
      middle: { root: "rounded-none" },
      last: { root: "rounded-t-none rounded-b-lg" },
      detached: { root: "rounded-lg" },
    },
    isIconOnly: {
      true: { root: "aspect-square", inner: "px-0" },
    },
    isFullWidth: {
      true: { root: "flex-1" },
    },
    isDisabled: {
      true: { root: "opacity-40" },
    },
  },
  defaultVariants: {
    size: "md",
    position: "detached",
  },
});

const toggleButtonGroupStyles = tv({
  base: "flex overflow-hidden",
  variants: {
    orientation: {
      horizontal: "flex-row items-center",
      vertical: "flex-col",
    },
    variant: {
      attached: "rounded-lg border border-default",
      detached: "",
    },
    // gap only applies to detached
    detachedOrientation: {
      horizontal: "gap-2",
      vertical: "gap-2",
    },
    fullWidth: {
      true: "w-full",
    },
  },
  defaultVariants: {
    orientation: "horizontal",
    variant: "attached",
  },
});

// ─── Group context ─────────────────────────────────────────────────────────────

type GroupContextValue = {
  fullWidth: boolean;
  isDisabled: boolean;
  orientation: Orientation;
  selectedKeys: Set<string>;
  size: Size;
  toggleKey: (id: string) => void;
  variant: GroupVariant;
};

const GroupContext = createContext<GroupContextValue | null>(null);
const useGroupContext = () => useContext(GroupContext);

// ─── Color context (animated text/icon color shared with children) ─────────────

const ToggleButtonColorContext = createContext<object>({});
export const useToggleButtonColor = () => useContext(ToggleButtonColorContext);

// ─── ToggleButton.Label ───────────────────────────────────────────────────────

type LabelProps = {
  children: ReactNode;
  className?: string;
  style?: TextStyle;
};

function Label({ children, className, style }: LabelProps) {
  const colorStyle = useToggleButtonColor();
  const { label } = toggleButtonStyles();
  return (
    <Animated.Text
      className={label({ className })}
      numberOfLines={1}
      style={[colorStyle, style]}
    >
      {children}
    </Animated.Text>
  );
}

// ─── ToggleButton ─────────────────────────────────────────────────────────────

export type ToggleButtonProps = {
  /** Injected by ToggleButtonGroup. Do not pass manually. */
  _position?: Position;
  children?: ReactNode;
  className?: string;
  defaultSelected?: boolean;
  /** Required when used inside ToggleButtonGroup */
  id?: string;
  isDisabled?: boolean;
  isIconOnly?: boolean;
  isSelected?: boolean;
  onChange?: (selected: boolean) => void;
  size?: Size;
  style?: ViewStyle;
};

function ToggleButtonRoot({
  id,
  isSelected: isSelectedProp,
  defaultSelected = false,
  onChange,
  isDisabled: isDisabledProp,
  isIconOnly = false,
  size: sizeProp,
  className,
  style,
  children,
  _position,
}: ToggleButtonProps) {
  const group = useGroupContext();
  const isInGroup = group !== null && id !== undefined;

  // ── Selection state ────────────────────────────────────────────────────────
  const [localSelected, setLocalSelected] = useState(defaultSelected);
  const isSelected = isInGroup
    ? group?.selectedKeys.has(id!)
    : isSelectedProp === undefined
      ? localSelected
      : isSelectedProp;

  const isDisabled = isDisabledProp ?? (isInGroup ? group?.isDisabled : false);
  const size = sizeProp ?? (isInGroup ? group?.size : "md");
  const orientation = isInGroup ? group?.orientation : "horizontal";
  const variant = isInGroup ? group?.variant : "detached";
  const fullWidth = isInGroup ? group?.fullWidth : false;
  const position = _position ?? "detached";

  const handlePress = () => {
    if (isDisabled) {
      return;
    }
    if (isInGroup) {
      group?.toggleKey(id!);
    } else {
      const next = !isSelected;
      setLocalSelected(next);
      onChange?.(next);
    }
  };

  // ── Animated colors ────────────────────────────────────────────────────────
  const accentColor = useThemeColor("accent");
  const accentFgColor = useThemeColor("accent-foreground");
  const defaultBgColor = useThemeColor("default");
  const defaultFgColor = useThemeColor("default-foreground");

  const progress = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isSelected ? 1 : 0, {
      duration: 180,
      easing: Easing.out(Easing.ease),
    });
  }, [isSelected, progress]);

  const animatedBg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [variant === "attached" ? "transparent" : defaultBgColor, accentColor]
    ),
  }));

  const animatedText = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.value,
      [0, 1],
      [defaultFgColor, accentFgColor]
    ),
  }));

  // ── Styles from tv ─────────────────────────────────────────────────────────
  const isVertical = orientation === "vertical";
  const { root, inner } = toggleButtonStyles({
    size,
    // use positionV slot for vertical groups, position for horizontal
    position: isVertical ? undefined : position,
    positionV: isVertical ? position : undefined,
    isIconOnly,
    isFullWidth: fullWidth,
    isDisabled,
  });

  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected, disabled: isDisabled }}
      animation={{
        scale: { value: 0.97 },
      }}
      className={root({ className })}
      isDisabled={isDisabled}
      onPress={handlePress}
      style={style}
    >
      <Animated.View className={inner()} style={animatedBg}>
        <ToggleButtonColorContext.Provider value={animatedText}>
          {children}
        </ToggleButtonColorContext.Provider>
      </Animated.View>
    </PressableFeedback>
  );
}

export const ToggleButton = Object.assign(ToggleButtonRoot, { Label });

// ─── ToggleButtonGroup.Separator (placeholder) ────────────────────────────────

function GroupSeparator() {
  // Actual rendering is handled by ToggleButtonGroup via cloneElement.
  return null;
}

// ─── ToggleButtonGroup ────────────────────────────────────────────────────────

export type ToggleButtonGroupProps = {
  children?: ReactNode;
  className?: string;
  defaultSelectedKeys?: string[];
  disallowEmptySelection?: boolean;
  fullWidth?: boolean;
  isDisabled?: boolean;
  onSelectionChange?: (keys: string[]) => void;
  orientation?: Orientation;
  selectedKeys?: string[];
  selectionMode?: SelectionMode;
  size?: Size;
  style?: ViewStyle;
  variant?: GroupVariant;
};

function ToggleButtonGroupRoot({
  selectionMode = "single",
  selectedKeys: selectedKeysProp,
  defaultSelectedKeys = [],
  onSelectionChange,
  disallowEmptySelection = false,
  isDisabled = false,
  size = "md",
  orientation = "horizontal",
  variant = "attached",
  fullWidth = false,
  className,
  style,
  children,
}: ToggleButtonGroupProps) {
  const isControlled = selectedKeysProp !== undefined;
  const [localKeys, setLocalKeys] = useState<Set<string>>(
    new Set(defaultSelectedKeys)
  );
  const selectedKeys = isControlled ? new Set(selectedKeysProp) : localKeys;

  const toggleKey = (id: string) => {
    const next = new Set(selectedKeys);
    if (next.has(id)) {
      if (disallowEmptySelection && next.size === 1) {
        return;
      }
      if (selectionMode === "single" && next.size === 1) {
        return;
      }
      next.delete(id);
    } else {
      if (selectionMode === "single") {
        next.clear();
      }
      next.add(id);
    }
    if (!isControlled) {
      setLocalKeys(next);
    }
    onSelectionChange?.(Array.from(next));
  };

  // ── Resolve children: inject position + render real separators ─────────────
  const childArray = Children.toArray(children);

  const buttonIndices: number[] = [];
  childArray.forEach((child, i) => {
    if (isValidElement(child) && (child.type as any) === ToggleButton) {
      buttonIndices.push(i);
    }
  });

  const resolvedChildren = childArray.map((child, i) => {
    if (!isValidElement(child)) {
      return child;
    }

    if ((child.type as any) === ToggleButton) {
      const btnIndex = buttonIndices.indexOf(i);
      const total = buttonIndices.length;

      let pos: Position = "middle";
      if (total === 1) {
        pos = "only";
      } else if (btnIndex === 0) {
        pos = "first";
      } else if (btnIndex === total - 1) {
        pos = "last";
      }

      const effectivePosition: Position =
        variant === "detached" ? "detached" : pos;

      return cloneElement(child as React.ReactElement<ToggleButtonProps>, {
        _position: effectivePosition,
      });
    }

    if ((child.type as any) === GroupSeparator) {
      if (variant === "detached") {
        return null;
      }

      const prevId = isValidElement(childArray[i - 1])
        ? (childArray[i - 1] as React.ReactElement).props.id
        : undefined;
      const nextId = isValidElement(childArray[i + 1])
        ? (childArray[i + 1] as React.ReactElement).props.id
        : undefined;

      const hide =
        (prevId && selectedKeys.has(prevId)) ||
        (nextId && selectedKeys.has(nextId));

      return (
        <Separator
          className={hide ? "opacity-0" : "opacity-25"}
          key={`sep-${i}`}
          orientation={orientation === "horizontal" ? "vertical" : "horizontal"}
        />
      );
    }

    return child;
  });

  // ── Group styles from tv ───────────────────────────────────────────────────
  const groupCn = toggleButtonGroupStyles({
    orientation,
    variant,
    detachedOrientation: variant === "detached" ? orientation : undefined,
    fullWidth,
    className,
  });

  const contextValue: GroupContextValue = {
    selectedKeys,
    toggleKey,
    size,
    isDisabled,
    variant,
    orientation,
    fullWidth,
  };

  return (
    <GroupContext.Provider value={contextValue}>
      <Animated.View className={groupCn} style={style}>
        {resolvedChildren}
      </Animated.View>
    </GroupContext.Provider>
  );
}

export const ToggleButtonGroup = Object.assign(ToggleButtonGroupRoot, {
  Separator: GroupSeparator,
});

export type {
  GroupVariant as ToggleButtonVariant,
  Orientation as ToggleButtonOrientation,
  SelectionMode as ToggleButtonSelectionMode,
  Size as ToggleButtonSize,
};
