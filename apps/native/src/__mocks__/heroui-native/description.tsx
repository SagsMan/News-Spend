import { Text } from "react-native";

export function Description({ children, ...props }: any) {
  return <Text {...props}>{children}</Text>;
}
