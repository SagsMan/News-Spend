import {
  LegendList,
  type LegendListRenderItemProps,
} from "@legendapp/list/react-native";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { ListGroup } from "heroui-native/list-group";
import { Separator } from "heroui-native/separator";
import { Spinner } from "heroui-native/spinner";
import { useCallback, useMemo } from "react";
import { Alert, View } from "react-native";

import { Button } from "#/components/heroui/button";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import { toast } from "#/components/heroui/toast";
import { orpc } from "#/lib/orpc";
import { queryClient } from "#/lib/tanstackQuery";

type BlockedUser = {
  id: string;
  username: string;
  blockedAt: string | null;
};

export default function BlockedUsers() {
  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch,
    isRefetching,
  } = useInfiniteQuery(
    orpc.block.getBlockedUsers.infiniteOptions({
      input: (pageParam: number | undefined) => ({ page: pageParam }),
      initialPageParam: undefined,
      getNextPageParam: (lastPage) => lastPage.nextPage,
      refetchInterval: false,
    })
  );

  const blockedUsers = useMemo(
    () =>
      (data?.pages ?? []).flatMap((page) => page.blockedUsers) as BlockedUser[],
    [data]
  );

  const total = data?.pages?.[0]?.totalDocs ?? 0;

  const unblockMutation = useMutation(
    orpc.block.unblockUser.mutationOptions({
      onError() {
        toast.dismiss();
        toast.error("Failed to unblock user");
      },
      onSuccess() {
        toast.dismiss();
        toast.success("User unblocked");
        // Refetch from the first page: removing a row shifts every later page,
        // so patching a single cached page would drop or duplicate entries.
        queryClient.invalidateQueries({
          queryKey: orpc.block.getBlockedUsers.key(),
        });
      },
    })
  );

  const handleUnblock = useCallback(
    (userId: string, username: string) => {
      Alert.alert(
        "Unblock User",
        `Unblock @${username}? Their comments will appear in your feed again.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unblock",
            onPress: () => {
              toast.loading("Unblocking user...", {
                duration: Number.POSITIVE_INFINITY,
              });
              unblockMutation.mutate({ userId });
            },
          },
        ]
      );
    },
    [unblockMutation]
  );

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetching, fetchNextPage]);

  const renderItem = useCallback(
    ({ item, index }: LegendListRenderItemProps<BlockedUser>) => (
      <ListGroup>
        <ListGroup.Item disabled>
          <ListGroup.ItemContent>
            <ListGroup.ItemTitle>@{item.username}</ListGroup.ItemTitle>
          </ListGroup.ItemContent>
          <ListGroup.ItemSuffix>
            <Button
              isDisabled={unblockMutation.isPending}
              onPress={() => handleUnblock(item.id, item.username)}
              size="sm"
              variant="ghost"
            >
              <Button.Label className="text-danger">Unblock</Button.Label>
            </Button>
          </ListGroup.ItemSuffix>
        </ListGroup.Item>
        {index < blockedUsers.length - 1 && <Separator className="mx-4" />}
      </ListGroup>
    ),
    [blockedUsers.length, handleUnblock, unblockMutation.isPending]
  );

  if (isLoading) {
    return (
      <Screen safeAreaEdges={["bottom"]} statusBarStyle="light">
        <View className="flex-1 items-center justify-center p-8">
          <Spinner size="lg" />
        </View>
      </Screen>
    );
  }

  if (blockedUsers.length === 0) {
    return (
      <Screen safeAreaEdges={["bottom"]} statusBarStyle="light">
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-center text-muted">
            You haven&apos;t blocked any users yet.
          </Text>
          <Button className="mt-4" onPress={() => refetch()} variant="ghost">
            <Button.Label>Refresh</Button.Label>
            {isRefetching ? <Spinner className="ml-2" size="sm" /> : null}
          </Button>
        </View>
      </Screen>
    );
  }

  return (
    <Screen safeAreaEdges={["bottom"]} statusBarStyle="light">
      <LegendList
        contentContainerStyle={{ padding: 16 }}
        data={blockedUsers}
        // Ids are unique per row, so recycling cannot mix up which account an
        // Unblock button belongs to.
        keyExtractor={(item) => item.id}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="items-center py-4">
              <Spinner size="sm" />
            </View>
          ) : null
        }
        ListHeaderComponent={
          <Text className="px-1 pb-3 text-muted text-sm">
            {total} blocked {total === 1 ? "user" : "users"}
          </Text>
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        onRefresh={refetch}
        refreshing={isRefetching}
        renderItem={renderItem}
      />
    </Screen>
  );
}
