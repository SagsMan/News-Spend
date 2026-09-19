import * as Clipboard from "expo-clipboard";
import { ListGroup } from "heroui-native/list-group";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { Separator } from "heroui-native/separator";

import type { IconProps } from "#/lib/icons";
import {
  ChatDotsIcon,
  CopyIcon,
  EnvelopeSimpleIcon,
  MessengerLogoIcon,
  ShareNetworkIcon,
  WhatsappLogoIcon,
} from "#/lib/icons";
import { useMemo } from "react";
import { Linking, Platform, ScrollView, View } from "react-native";
import Share, { type Social } from "react-native-share";

import { Icon } from "#/components/heroui/icon";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import { toast } from "#/components/heroui/toast";
import useAddActivity from "#/hooks/point/useAddActivity";
import { authState } from "#/state/auth";

const msg =
  "News-spend media gives me all the latest news and helps me to achieve my dreams. I have been enjoying it and would like to share it with you. Get it from this link";
const url = "https://link.newsspend.com/";

const ShareApp = () => {
  const addActivityMutation = useAddActivity();

  const awardPoint = () => {
    if (!authState.user) {
      return;
    }
    addActivityMutation.mutate(
      {
        action: "share",
        type: "point",
        point: 20, // TODO: make this dynamic
        description: "Shared app",
      },
      {
        onSuccess: (_response) => {
          toast.success("Points earned", {
            description:
              "You earned 20 points for sharing News Spend Media App!",
          });
        },
      }
    );
  };

  const onShare = async (social: Social, pkg: string): Promise<void> => {
    try {
      // On iOS, skip the package installed check (not implemented)

      const res = await Share.shareSingle({
        message: msg,
        social,
        title: "Refer a friend and earn 20 credits",
        url,
        forceDialog: true,
        appId: "",
      });

      if (res.success && Platform.OS !== "ios") {
        const { isInstalled } = await Share.isPackageInstalled(pkg);
        if (isInstalled) {
          awardPoint();
        }
      }
    } catch (error: any) {
      console.log("Share error:", error.message);
      toast.error("Could not share");
    }
  };

  const options: {
    text: string;
    Icon: React.FC<IconProps>;
    onPress: () => void;
  }[] = useMemo(
    () => [
      {
        text: "Invite via SMS",
        Icon: ChatDotsIcon,
        onPress: async () => {
          try {
            const res = await Linking.openURL(`sms:?body=${msg} ${url}`);

            if (res) {
              awardPoint();
            } else {
              toast.error("Could not open SMS. Please try again");
            }
          } catch (error) {
            console.error(error);
            toast.error("Could not open SMS. Please try again");
          }
        },
      },
      {
        text: "Invite via Email",
        Icon: EnvelopeSimpleIcon,
        onPress: async () => {
          try {
            const res = await Linking.openURL(`mailto:?body=${msg} ${url}`);
            if (res) {
              awardPoint();
            } else {
              toast.error("Could not open Email. Please try again");
            }
          } catch (error) {
            console.error(error);
            toast.error("Could not open Email. Please try again");
          }
        },
      },
      {
        text: "Invite Messenger Friends",
        Icon: MessengerLogoIcon,
        onPress: async () =>
          onShare(Share.Social.MESSENGER as Social, "com.facebook.orca"),
      },
      {
        text: "Invite Whatsapp Friends",
        Icon: WhatsappLogoIcon,
        onPress: async () =>
          onShare(Share.Social.WHATSAPP as Social, "com.whatsapp"),
      },
      {
        text: "Copy link",
        Icon: CopyIcon,
        onPress: async () => {
          try {
            await Clipboard.setStringAsync(`${msg} \n ${url}`);
            toast.success("Link copied to clipboard");
          } catch (error) {
            console.error(error);
            toast.error("Could not copy link");
          }
        },
      },
      {
        text: "Share via...",
        Icon: ShareNetworkIcon,
        onPress: async () => {
          try {
            const res = await Share.open({
              message: `${msg}`,
              title: "Refer a friend and earn 20 credits",
              url,
            });

            if (res.success) {
              awardPoint();
            } else {
              toast.error("Could not share. Please try again");
            }
          } catch {
            // console.log(error);
            // toast.error("Could not share");
          }
        },
      },
    ],
    [onShare, awardPoint]
  );

  return (
    <Screen statusBarStyle="light">
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className="px-4 py-2">
          Earn <Text className="font-semibold text-accent">20</Text> credits for
          every friend you invite
        </Text>

        <ListGroup variant="transparent">
          {options.map(({ text, Icon: OptionIcon, onPress }, index) => (
            <View key={text}>
              <PressableFeedback animation={false} onPress={onPress}>
                <PressableFeedback.Scale>
                  <ListGroup.Item disabled>
                    <ListGroup.ItemPrefix>
                      <Icon name={OptionIcon} size={22} />
                    </ListGroup.ItemPrefix>
                    <ListGroup.ItemContent>
                      <ListGroup.ItemTitle>{text}</ListGroup.ItemTitle>
                    </ListGroup.ItemContent>
                    <ListGroup.ItemSuffix />
                  </ListGroup.Item>
                </PressableFeedback.Scale>
                <PressableFeedback.Ripple />
              </PressableFeedback>
              {index < options.length - 1 && <Separator className="mx-4" />}
            </View>
          ))}
        </ListGroup>
      </ScrollView>
    </Screen>
  );
};

export default ShareApp;
