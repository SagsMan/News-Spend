import { View } from "react-native";

export function TextField({ children, isInvalid, ...props }: any) {
  return <View {...props}>{children}</View>;
}
