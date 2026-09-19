import { Linking, Pressable, View } from "react-native";
import { FacebookIcon } from "#/components/icons/FacebookIcon";
import { InstagramIcon } from "#/components/icons/InstagramIcon";
import { YouTubeIcon } from "#/components/icons/YouTubeIcon";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";

const socials = [
  {
    title: "Facebook",
    icon: FacebookIcon,
    url: "https://www.facebook.com/profile.php?id=61562321939377",
  },
  {
    title: "Instagram",
    icon: InstagramIcon,
    url: "https://www.instagram.com/news_spend_media/?utm_source=news_spend_media&utm_medium=referral",
  },
  {
    title: "YouTube",
    icon: YouTubeIcon,
    url: "https://youtube.com/@news-spendmedia?si=Qadr5jX3kL0Zxs-z",
  },
];

export default function Socials() {
  return (
    <Screen statusBarStyle="light">
      <View className="gap-3 px-3 pt-2">
        <Text className="text-center" variant="subtitle">
          Follow us on social media
        </Text>

        <View className="flex-row justify-around">
          {socials.map((social) => {
            const Icon = social.icon;
            return (
              <Pressable
                key={social.title}
                onPress={() => Linking.openURL(social.url)}
              >
                <Icon size={50} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}
