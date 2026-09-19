import type { IconProps as PIconProps } from "#/lib/icons";
import type React from "react";
import { useCSSVariable, withUniwind } from "uniwind";

export type IconProps = {
  name: React.ComponentType<PIconProps>;
  size?: number;
  className?: string;
} & Omit<PIconProps, "name">;

function BaseIcon({
  name: IconComponent,
  color,
  size = 24,
  ...rest
}: IconProps) {
  const defaultColor = useCSSVariable("--color-foreground");
  const iconColor = color ?? defaultColor;
  const UniWindIcon = withUniwind(IconComponent);

  return <UniWindIcon color={iconColor as string} size={size} {...rest} />;
}

export const Icon = BaseIcon;
