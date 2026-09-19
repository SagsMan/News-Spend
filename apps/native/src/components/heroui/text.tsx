import { useTextComponent } from "heroui-native/hooks";
import { cn } from "heroui-native/utils";
import type React from "react";
import { type Ref, useContext, useMemo } from "react";
import {
  Text as RNText,
  type TextProps as RNTextProps,
  unstable_TextAncestorContext as TextAncestorContext,
} from "react-native";
import { tv } from "tailwind-variants";

const textVariants = tv({
  base: "font-sans text-foreground",
  variants: {
    variant: {
      HeadingLarge: "font-semibold text-2xl/[33.6px]",
      HeadingMedium: "font-semibold text-xl/[28.8px]",
      title: "font-bold text-2xl/[33.6px]",
      subtitle: "font-semibold text-[19px]",
      body: "font-normal text-sm/[19.6px]",
      caption: "text-sm text-subtle-text",
      link: "font-medium text-accent text-sm underline",
    },
  },
  defaultVariants: {
    variant: "body",
  },
});

export type AppTextProps = RNTextProps & {
  variant?: keyof typeof textVariants.variants.variant;
  children: React.ReactNode;
  ref?: Ref<RNText>;
};

export const Text = ({
  variant = "body",
  className,
  style,
  ref,
  ...props
}: AppTextProps) => {
  const isNested = useContext(TextAncestorContext);
  const { textProps } = useTextComponent();

  const resolvedClassName = useMemo(
    () =>
      isNested
        ? cn(className) // nested: skip variant, just inherit + apply any extra classes
        : cn(textVariants({ variant }), className), // top-level: apply full variant
    [variant, className, isNested]
  );

  return (
    <RNText
      {...textProps}
      accessibilityRole="text"
      accessible
      className={resolvedClassName}
      ref={ref}
      style={style}
      {...props}
    />
  );
};

Text.displayName = "Text";
