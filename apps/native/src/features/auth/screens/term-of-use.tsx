import { useNavigation } from "@react-navigation/native";
import { Pressable, View } from "react-native";
import { Icon } from "#/components/heroui/icon";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import { ArrowLeftIcon } from "#/lib/icons";

const terms = [
  {
    title: "1. Eligibility",
    description:
      "You must be at least 13 years old to use the News Spend Media app. You must have a valid email address.",
  },
  {
    title: "2. Account",
    description:
      "You are responsible for keeping your account information confidential. You agree not to share your account information with anyone else. You agree to notify News Spend Media immediately if you believe your account has been compromised.",
  },
  {
    title: "3. Use of the App",
    description:
      "You agree to use the News Spend Media app in a responsible and lawful manner. You agree not to use the app to post or share any content that is illegal, harmful, threatening, abusive, harassing, tortious, defamatory, vulgar, obscene, pornographic, libellous, invasive of another's privacy, hateful, or racially, ethnically or otherwise objectionable. You agree not to use the app to impersonate any person or entity. You agree not to use the app to collect or store personal data about other users without their consent. You agree not to use the app to post or share any advertising, promotional materials, or other forms of solicitation without the express written permission of News Spend Media.",
  },
  {
    title: "4. Intellectual Property",
    description:
      "The News Spend Media app and all of its content, including but not limited to text, images, videos, and software, is protected by copyright and other intellectual property laws. You agree not to copy, modify, distribute, transmit, publicly display, perform, reproduce, publish, license, transfer, or sell any of the content of the News Spend Media app without the express written permission of News Spend Media.",
  },
  {
    title: "5. Points",
    description:
      "You can earn Dream Points by reading news articles and engaging with content on the News Spend Media app. Dream Points have no cash value. Dream Points may be used to enter the Giveaway or redeemed for in-app rewards described in the Giveaway Official Rules. News Spend Media reserves the right to change the redemption value of Dream Points at any time.",
  },
  {
    title: "6. Termination",
    description:
      "News Spend Media reserves the right to terminate your account and/or suspend your access to the app at any time, for any reason, without notice.",
  },
  {
    title: "7. Disclaimer",
    description:
      "The News Spend Media app is provided 'as is' without warranty of any kind, express or implied. News Spend Media makes no representations or warranties about the accuracy, reliability, or completeness of the app.",
  },
  {
    title: "8. Limitation of Liability",
    description:
      "News Spend Media shall not be liable for any indirect, incidental, or consequential damages arising out of your use of the app.",
  },
  {
    title: "9. Governing Law",
    description:
      "These terms and conditions shall be governed by and construed in accordance with the laws of the country in which News Spend Media operates.",
  },
  {
    title: "10. Changes",
    description:
      "News Spend Media reserves the right to modify these terms and conditions at any time. Your continued use of the app constitutes acceptance of the modified terms.",
  },
];

const TermOfUse = () => {
  const navigation = useNavigation("TermsOfUse");

  return (
    <Screen
      className="px-5"
      contentContainerClassName="gap-6 py-4"
      preset="scroll"
      safeAreaEdges={["bottom"]}
    >
      <Pressable hitSlop={10} onPress={() => navigation.goBack()}>
        <Icon className="size-6" name={ArrowLeftIcon} />
      </Pressable>
      <Text variant="HeadingMedium">Terms of Use</Text>
      {terms.map((term) => (
        <View className="gap-1" key={term.title}>
          <Text className="font-semibold">{term.title}</Text>
          <Text variant="caption">{term.description}</Text>
        </View>
      ))}
    </Screen>
  );
};

export default TermOfUse;
