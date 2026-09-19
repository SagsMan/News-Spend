import { ActivityIndicator, Pressable, Text } from "react-native";

export function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}

export function Spinner() {
  return <ActivityIndicator />;
}

export function Button({
  children,
  className,
  isDisabled,
  onPress,
  testID,
  ...props
}: any) {
  return (
    <Pressable
      className={className}
      disabled={isDisabled}
      onPress={onPress}
      testID={testID ?? "submit-button"}
      {...props}
    >
      {children}
    </Pressable>
  );
}

Button.Label = function ButtonLabel({ children, ...props }: any) {
  return <Text {...props}>{children}</Text>;
};
