import type { News } from "@news-spend-media/payload/types";
import { useRoute } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import { BottomSheet } from "heroui-native/bottom-sheet";
import {
  CopyIcon,
  DotsThreeOutlineVerticalIcon,
  FacebookLogoIcon,
  MessengerLogoIcon,
  ShareNetworkIcon,
  TwitterLogoIcon,
  WhatsappLogoIcon,
} from "#/lib/icons";
import { useState } from "react";
import { FlatList, ToastAndroid, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Share, { type Social } from "react-native-share";

import BannerAds from "#/components/Ads/BannerAds";
import { Button } from "#/components/heroui/button";
import { Icon } from "#/components/heroui/icon";
import { Text } from "#/components/heroui/text";

export const ShareNews = ({
  news,
  onShare,
}: {
  news: News;
  onShare?: (shareMethod: string) => void;
}) => {
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const currentTabPath = "news";
  const [visible, setVisible] = useState(false);
  const gap = 10;
  const currentScreen = "article";
  const url = `https://link.newsspend.com/${currentTabPath}/${currentScreen}/${news.slug}`;

  const options = [
    {
      text: "Facebook",
      Icon: FacebookLogoIcon,
      onPress: async () => {
        try {
          const result = await Share.shareSingle({
            message: `${news.title}`,
            title: "Share via",
            url,
            social: Share.Social.FACEBOOK as Social,
            appId: "",
          });
          result.success && onShare?.("facebook");
        } catch (error: any) {
          console.log(error.message);
        }
      },
    },
    {
      text: "Messenger",
      Icon: MessengerLogoIcon,
      onPress: async () => {
        try {
          const result = await Share.shareSingle({
            message: `${news.title}`,
            title: "Share via",
            url,
            social: Share.Social.MESSENGER as Social,
            appId: "",
          });
          result.success && onShare?.("messenger");
        } catch (error: any) {
          console.log(error.message);
        }
      },
    },
    {
      text: "Whatsapp",
      Icon: WhatsappLogoIcon,
      onPress: async () => {
        try {
          const result = await Share.shareSingle({
            message: `${news.title}`,
            title: "Share via",
            url,
            social: Share.Social.WHATSAPP as Social,
            appId: "",
          });
          result.success && onShare?.("whatsapp");
        } catch (error: any) {
          console.log(error.message);
        }
      },
    },
    {
      text: "Twitter",
      Icon: TwitterLogoIcon,
      onPress: async () => {
        try {
          const result = await Share.shareSingle({
            message: `${news.title}`,
            title: "Share via",
            url,
            social: Share.Social.TWITTER as Social,
            appId: "",
          });
          result.success && onShare?.("twitter");
        } catch (error: any) {
          console.log(error.message);
        }
      },
    },
    {
      text: "Copy link",
      Icon: CopyIcon,
      onPress: async () => {
        try {
          await Clipboard.setStringAsync(`${news.title} \n ${url}`);
          ToastAndroid.show("Link copied to clipboard", ToastAndroid.SHORT);
          // onShare?.("copy_link");
        } catch (error) {
          console.error(error);
        }
      },
    },
    {
      text: "Others",
      Icon: DotsThreeOutlineVerticalIcon,
      onPress: async () => {
        try {
          const result = await Share.open({
            message: `${news.title}`,
            title: "Share via",
            url,
          });
          result.success && onShare?.("other");
        } catch (error: any) {
          console.log(error.message);
        }
      },
    },
  ];

  const numColumns = 3;

  return (
    <>
      <Button
        className="size-12.5 rounded-full bg-p-500"
        onPress={() => setVisible(true)}
        style={{ elevation: 2, shadowColor: "rgba(0, 0, 0, 0.25)" }}
      >
        <Icon
          color="white"
          name={ShareNetworkIcon}
          size={28}
          weight="duotone"
        />
      </Button>

      <BottomSheet isOpen={visible} onOpenChange={setVisible}>
        {/* This sheet has no text input and nothing else is ever open when
        it's shown, so it never needs to render above other native surfaces
        (keyboard, other modals), the one thing FullWindowOverlay is for.
        Disabling it unconditionally (not just in dev) also fixes the
        "Others" share option: that button hands off to the native OS share
        chooser, a separate native window, which previously had to compete
        with this sheet's own FullWindowOverlay window for top position and
        sometimes lost. With this sheet in the main window instead, the OS
        chooser always composites above it, so no timing/ordering hack needed. */}
        <BottomSheet.Portal disableFullWindowOverlay>
          <BottomSheet.Overlay />
          <BottomSheet.Content style={{ paddingBottom: insets.bottom }}>
            <View className="gap-5">
              <FlatList
                columnWrapperStyle={{
                  gap,
                  alignItems: "center",
                  justifyContent: "space-around",
                }}
                contentContainerStyle={{ gap: 20 }}
                data={options}
                key={numColumns}
                numColumns={numColumns}
                renderItem={({ item: { Icon: ItemIcon, ...item } }) => (
                  <View className="items-center gap-2" key={item.text}>
                    <Button
                      className="size-12 bg-p-500 py-2"
                      onPress={item.onPress}
                    >
                      <Icon
                        color="white"
                        name={ItemIcon}
                        size={30}
                        weight="regular"
                      />
                    </Button>
                    <Text className="text-center text-sm">{item.text}</Text>
                  </View>
                )}
              />

              <View className="mt-2 w-full items-center">
                <BannerAds size="LARGE_BANNER" />
              </View>
            </View>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </>
  );
};
