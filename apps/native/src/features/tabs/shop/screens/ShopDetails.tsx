import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import {
  type InfiniteData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Separator } from "heroui-native/separator";
import { Spinner } from "heroui-native/spinner";
import { ArrowLeftIcon, HeartIcon } from "#/lib/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Platform, StyleSheet, View } from "react-native";
import WebView from "react-native-webview";

import { ScreenHeader } from "#/components";
import { Button } from "#/components/heroui/button";
import { Icon } from "#/components/heroui/icon";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import { orpc, type RouterOutputs } from "#/lib/orpc";
import { useFavoriteStores } from "#/state/favoriteStoreState";

const ShopDetails = () => {
  const route = useRoute();
  const { slug, id: storeId } = route.params as { slug: string; id: string };
  const navigation = useNavigation();
  const [openShop, setOpenShop] = useState(false);
  const queryClient = useQueryClient();
  const { toggleFavoriteStore, isFavorite } = useFavoriteStores();

  const { data: store } = useQuery(
    orpc.store.one.queryOptions({
      input: { slug },
      initialData: () => {
        const qKey = orpc.store.all.infiniteKey({
          input: (pageParam: number | undefined) => ({
            page: pageParam,
            limit: 12,
            sortBy: "newest",
          }),
          initialPageParam: undefined,
        });
        const cacheData =
          queryClient.getQueryData<InfiniteData<RouterOutputs["store"]["all"]>>(
            qKey
          );
        return cacheData?.pages
          .flatMap((page) => page.docs)
          ?.find((s) => s.slug === slug);
      },
      initialDataUpdatedAt: () => {
        const qKey = orpc.store.all.infiniteKey({
          input: (pageParam: number | undefined) => ({
            page: pageParam,
            limit: 12,
            sortBy: "newest",
          }),
          initialPageParam: undefined,
        });
        return queryClient.getQueryState(qKey)?.dataUpdatedAt;
      },
    })
  );

  const trackViewMutation = useMutation(orpc.store.trackView.mutationOptions());
  const trackClickMutation = useMutation(
    orpc.store.trackClick.mutationOptions()
  );

  useEffect(() => {
    if (storeId || store?.id) {
      trackViewMutation.mutate({
        storeId: storeId || store?.id || "",
        platform: Platform.OS === "ios" ? "ios" : "android",
        device: "mobile",
      });
    }
  }, [storeId, store?.id, trackViewMutation.mutate]);

  const isStoreFavorite = isFavorite(store?.id ?? "");

  const webViewRef = useRef<WebView & { canGoBack: boolean }>(null);

  const onAndroidBackPress = useCallback(() => {
    if (webViewRef.current?.canGoBack) {
      webViewRef.current.goBack();
      return true;
    }
    return false;
  }, []);

  useFocusEffect(
    useCallback(() => {
      let subscription: ReturnType<typeof BackHandler.addEventListener>;

      if (Platform.OS === "android") {
        subscription = BackHandler.addEventListener(
          "hardwareBackPress",
          onAndroidBackPress
        );
      }

      return () => {
        if (Platform.OS === "android" && subscription) {
          subscription.remove();
        }
      };
    }, [onAndroidBackPress])
  );

  const handleShopNow = useCallback(() => {
    trackClickMutation.mutate({
      storeId: storeId || store?.id || "",
      platform: Platform.OS === "ios" ? "ios" : "android",
      device: "mobile",
    });
    setOpenShop(true);
  }, [trackClickMutation, storeId, store]);

  const headerLeft = (
    <Button isIconOnly onPress={() => navigation.goBack()} variant="ghost">
      <Icon color="#fff" name={ArrowLeftIcon} size={24} />
    </Button>
  );

  const headerRight = (
    <Button
      isIconOnly
      onPress={() => toggleFavoriteStore(store!)}
      variant="ghost"
    >
      <HeartIcon
        color="red"
        size={24}
        weight={isStoreFavorite ? "fill" : "regular"}
      />
    </Button>
  );

  if (openShop) {
    return (
      <Screen preset="fixed" safeAreaEdges={["bottom"]} statusBarStyle="light">
        <ScreenHeader
          left={headerLeft}
          right={headerRight}
          title={store?.companyName || ""}
        />
        <WebView
          allowsBackForwardNavigationGestures
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          onNavigationStateChange={(navState) => {
            if (webViewRef.current) {
              webViewRef.current.canGoBack = navState.canGoBack;
            }
          }}
          onShouldStartLoadWithRequest={() => true}
          pullToRefreshEnabled
          ref={webViewRef}
          renderLoading={() => (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(0,0,0,0.5)",
                },
              ]}
            >
              <Spinner color="#fff" />
            </View>
          )}
          source={{ uri: store?.websiteUrl ?? "" }}
          startInLoadingState
        />
      </Screen>
    );
  }

  return (
    <Screen preset="scroll" statusBarStyle="light">
      <ScreenHeader
        left={headerLeft}
        right={headerRight}
        title={store?.companyName || ""}
      />

      <View className="gap-2 p-2">
        <View className="self-start rounded bg-green-500 px-4 py-0.5">
          <Text className="text-white" variant="caption">
            Online
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="font-bold text-2xl">
            <Text className="font-bold text-4xl text-green-500">
              {store?.cashBack}%
            </Text>
            {" Cash Back"}
          </Text>

          <Button className="rounded-full px-5" onPress={handleShopNow}>
            <Button.Label>Shop Now</Button.Label>
          </Button>
        </View>
      </View>

      <Separator className="my-1" />

      <View className="gap-1 px-2">
        <Text variant="subtitle">
          Get {store?.cashBack} pt/₦ on every purchase
        </Text>
        <Text variant="body">{store?.description}</Text>
      </View>
    </Screen>
  );
};

export default ShopDetails;
