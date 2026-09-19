import { TextInput } from "react-native";

export function Input({ className, ...props }: any) {
  return <TextInput className={className} {...props} />;
}
