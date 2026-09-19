import type { Partner } from "@news-spend-media/payload/types";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { Card } from "heroui-native/card";
import { Separator } from "heroui-native/separator";
import { HeartIcon } from "#/lib/icons";
import { Pressable, View } from "react-native";
import { Button } from "#/components/heroui/button";
import { Icon } from "#/components/heroui/icon";
import { Text } from "#/components/heroui/text";
import { useFavoriteStores } from "#/state/favoriteStoreState";
import { getImageData } from "#/utils/getImageData";

export default function ShopItem({ item }: { item: Partial<Partner> }) {
  const { isFavorite, toggleFavoriteStore } = useFavoriteStores();
  const navigation = useNavigation("ShopHome");

  const isStoreFavorite = isFavorite(item.id ?? "");
  const { url, blurhash } = getImageData(item.logo);

  return (
    <Pressable
      onPress={() =>
        navigation.navigate("ShopDetails", {
          slug: item.slug!,
          id: item.id,
        })
      }
    >
      <Card className="gap-2 rounded-lg py-2">
        <View className="flex-row items-center justify-between px-2">
          <View style={{ height: 50, width: 75 }}>
            <Image
              className="rounded-sm"
              contentFit="scale-down"
              placeholder={{ blurhash }}
              placeholderContentFit="contain"
              source={url}
              style={{ height: "100%", width: "100%", borderRadius: 8 }}
            />
          </View>

          <View className="flex-row items-center gap-2">
            <Button
              isIconOnly
              onPress={() => toggleFavoriteStore(item)}
              size="sm"
              variant="ghost"
            >
              <Icon
                color="red"
                name={HeartIcon}
                size={20}
                weight={isStoreFavorite ? "fill" : "regular"}
              />
            </Button>
            <Button
              onPress={() =>
                navigation.navigate("ShopDetails", {
                  slug: item.slug!,
                  id: item.id,
                })
              }
              size="sm"
              variant="outline"
            >
              <Button.Label>Shop</Button.Label>
            </Button>
          </View>
        </View>

        <Separator />

        <View className="flex-row justify-between px-2">
          <Text variant="caption">{item.cashBack}% Cash Back</Text>
          <Text variant="caption">{item.cashBack} pt/₦</Text>
        </View>
      </Card>
    </Pressable>
  );
}
