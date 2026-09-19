import type { ButtonRootProps } from "heroui-native/button";
import { Button as HeroUIButton } from "heroui-native/button";
import { useMemo } from "react";
import { tv } from "tailwind-variants";

const buttonVariants = tv({
  base: "rounded-lg",
  variants: {
    size: {
      sm: "h-[36px] gap-1.5 px-3.5",
      md: "h-[48px] gap-2 px-4",
      lg: "h-[56px] gap-2.5 px-5",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

export type AppButtonProps = ButtonRootProps & {
  className?: string;
  ref?: React.ComponentProps<typeof HeroUIButton>["ref"];
};

export function Button({ className, size, ref, ...props }: AppButtonProps) {
  const resolvedClassName = useMemo(
    () => buttonVariants({ size, className }),
    [size, className]
  );

  return <HeroUIButton className={resolvedClassName} ref={ref} {...props} />;
}

Button.displayName = "Button";
Button.Label = HeroUIButton.Label;
