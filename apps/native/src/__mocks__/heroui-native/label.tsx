import { Text } from "react-native";

export function Label({ children, ...props }: any) {
  return <Text {...props}>{children}</Text>;
}
