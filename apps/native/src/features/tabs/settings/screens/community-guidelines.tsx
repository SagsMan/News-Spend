import { View } from "react-native";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";

const communityGuidelinesContent = [
  {
    title: "Our Commitment",
    description:
      "We are committed to maintaining a safe, respectful, and inclusive community for all users. These guidelines help ensure everyone can participate positively in discussions and share content responsibly.",
    bullets: [],
  },
  {
    title: "1. Respectful Communication",
    description: "When commenting or interacting with others:",
    bullets: [
      "Treat all users with respect and dignity",
      "Disagree constructively: attack ideas, not people",
      "Avoid personal insults, name-calling, or derogatory language",
      "Be mindful of cultural differences and sensitivities",
    ],
  },
  {
    title: "2. Prohibited Content",
    description:
      "The following types of content are not allowed and will be removed:",
    bullets: [
      "Hate speech, discrimination, or content promoting violence against individuals or groups",
      "Harassment, bullying, or targeted attacks against other users",
      "Spam, advertising, or unsolicited promotional content",
      "Misinformation or deliberately false claims",
      "Personal or private information of others (doxxing)",
      "Explicit, graphic, or sexually inappropriate content",
      "Content that promotes illegal activities",
      "Trolling or deliberate provocation designed to disrupt discussions",
    ],
  },
  {
    title: "3. Content Standards",
    description: "All user-generated content must:",
    bullets: [
      "Be original or properly attributed",
      "Comply with applicable laws and regulations",
      "Be relevant to the topic being discussed",
      "Not contain malware, phishing attempts, or harmful links",
    ],
  },
  {
    title: "4. Reporting Violations",
    description: "If you encounter content that violates these guidelines:",
    bullets: [
      "Use the Report button on the content to flag it for review",
      "Provide specific details about why the content violates guidelines",
      "Our moderation team reviews all reports and takes appropriate action",
      "You will be notified when action is taken on your report",
    ],
  },
  {
    title: "5. Blocking Users",
    description:
      "You can block any user to prevent them from interacting with you:",
    bullets: [
      "Blocked users cannot see your comments or interact with your content",
      "You can manage your blocked list in Me → Blocked Users",
      "Blocking is private. The blocked user is not notified.",
    ],
  },
  {
    title: "6. Consequences",
    description: "Violations may result in:",
    bullets: [
      "Content removal",
      "Content hiding pending review",
      "Warning notifications",
      "Temporary suspension",
      "Permanent account termination",
    ],
  },
  {
    title: "7. Appeals",
    description:
      "If you believe content was removed in error, contact our support team through the Support section in Me. We review all appeals promptly.",
    bullets: [],
  },
  {
    title: "8. Changes to Guidelines",
    description:
      "We may update these guidelines as our community evolves. Significant changes will be communicated through in-app notifications. Continued use of the app constitutes acceptance of updated guidelines.",
    bullets: [],
  },
  {
    title: "Contact",
    description:
      "For questions about these guidelines or to report a concern, email us at support@newsspend.com or use the Support section in Me.",
    bullets: [],
  },
];

const CommunityGuidelines = () => (
  <Screen
    className="px-5"
    contentContainerClassName="gap-6 py-4"
    preset="scroll"
    safeAreaEdges={["bottom"]}
  >
    <Text variant="HeadingMedium">Community Guidelines</Text>
    {communityGuidelinesContent.map((section) => (
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

export default CommunityGuidelines;
