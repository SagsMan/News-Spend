import { Text } from "react-native";

export function FieldError({ children, ...props }: any) {
  return <Text {...props}>{children}</Text>;
}
