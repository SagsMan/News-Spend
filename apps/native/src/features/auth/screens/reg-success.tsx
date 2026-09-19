import { useNavigation } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { Image, View } from "react-native";
import { useSnapshot } from "valtio";
import { Button } from "#/components/heroui/button";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import { userQueryOptions } from "#/hooks/auth/useUser";
import { authClient } from "#/lib/authClient";
import { authState, setAuthSession } from "#/state/auth";

export default function RegSuccess() {
  const { data, isPending, error } = authClient.useSession();
  const queryClient = useQueryClient();
  const navigation = useNavigation("RegSuccess");
  const { status } = useSnapshot(authState);

  const onContinue = () => {
    if (!data?.user) {
      return;
    }
    queryClient.setQueryData(userQueryOptions.queryKey, data);
    setAuthSession(data, "signIn");
    // When the session already exists (status is already "signIn"), this is
    // an anonymous guest upgrading to a real account, so Tab is already in
    // the stack below the auth screens and React Navigation won't auto-swap
    // to it. Pop back to that existing Tab instance (preserving whatever
    // screen the guest was on) instead of resetting to a fresh one.
    if (status === "signIn") {
      navigation.popToTop();
    }
  };

  return (
    <Screen className="px-6" safeAreaEdges={["bottom"]}>
      <View className="mb-6 flex-1 items-center justify-center">
        <Image
          className="size-full object-contain"
          source={require("#/images/Group-5.jpg")}
        />
      </View>
      <View className="mb-8 items-center gap-3">
        <Text className="font-bold text-gray-600 text-xl">
          Registration Successful
        </Text>
        <Text>You have been awarded with 500 points</Text>
      </View>
      <Button
        className="mb-10 w-full"
        isDisabled={Boolean(error) || isPending}
        onPress={onContinue}
      >
        <Button.Label>Continue</Button.Label>
      </Button>
    </Screen>
  );
}
