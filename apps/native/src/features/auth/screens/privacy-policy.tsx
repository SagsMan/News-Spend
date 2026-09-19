import { useNavigation } from "@react-navigation/native";
import { Pressable, View } from "react-native";
import { Icon } from "#/components/heroui/icon";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import { ArrowLeftIcon } from "#/lib/icons";

const privacyPolicyContent = [
  {
    title: "1. Information We Collect",
    description:
      "We collect the following information from you when you use the App:",
    bullets: [
      "Personal information: This includes your name, email address, and any other information you voluntarily provide to us, such as your profile picture and interests.",
      "Device information: This includes your device type, operating system, and IP address.",
      "Usage information: This includes information about how you use the App, such as the articles you read, the videos you watch, and the surveys you complete.",
    ],
  },
  {
    title: "2. How We Use Your Information",
    description: "We use your information to:",
    bullets: [
      "Provide you with the services and features of the App.",
      "Send you notifications about new content and rewards.",
      "Improve the App and our services.",
      "Conduct research.",
      "Comply with legal requirements.",
    ],
  },
  {
    title: "3. How We Share Your Information",
    description:
      "We may share your information with the following third parties:",
    bullets: [
      "Service providers who help us operate the App and provide our services.",
      "Advertisers who display ads in the App.",
      "Analytics providers who help us understand how users interact with the App.",
      "Law enforcement and other government agencies, as required by law.",
    ],
  },
  {
    title: "4. Your Choices",
    description:
      "You have the following choices about how we collect, use, and share your information:",
    bullets: [
      "You can opt out of receiving marketing communications from us by clicking the unsubscribe link in any email you receive from us.",
      "You can manage your device permissions to control what information the App can access.",
      "You can delete your account and all of your associated information at any time by contacting us at support@newsspend.com",
    ],
  },
  {
    title: "5. Security",
    description:
      "We take reasonable measures to protect your information from unauthorized access, use, or disclosure.",
    bullets: [
      "We use industry-standard encryption to protect your data.",
      "We regularly review our security practices.",
    ],
  },
  {
    title: "6. Children's Privacy",
    description:
      "The App is not intended for children under 13. We do not knowingly collect personal information from children under 13.",
    bullets: [],
  },
  {
    title: "7. Changes",
    description:
      "We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on the App.",
    bullets: [],
  },
  {
    title: "8. Contact",
    description:
      "If you have any questions about this privacy policy, please contact us at support@newsspend.com",
    bullets: [],
  },
];

const PrivacyPolicy = () => {
  const navigation = useNavigation("PrivacyPolicy");

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
      <Text variant="HeadingMedium">Privacy Policy</Text>
      {privacyPolicyContent.map((section) => (
        <View className="gap-2" key={section.title}>
          <Text className="font-semibold">{section.title}</Text>
          <Text variant="caption">{section.description}</Text>
          {section.bullets.length > 0 && (
            <View className="gap-1 pl-4">
              {section.bullets.map((bullet) => (
                <Text key={bullet} variant="caption">
                  • {bullet}
                </Text>
              ))}
            </View>
          )}
        </View>
      ))}
    </Screen>
  );
};

export default PrivacyPolicy;
