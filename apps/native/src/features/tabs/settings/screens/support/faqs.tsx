import { Accordion, AccordionLayoutTransition } from "heroui-native/accordion";
import { ScrollView } from "react-native";

import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";

const questions = [
  {
    question: "How does the point system work?",
    answer:
      "The point system rewards users for reading articles on the app. You can earn points by reading news articles, watching videos, and completing other tasks in the app. The number of points you earn will vary depending on the task.",
  },
  {
    question: "What can I do with the points I earn?",
    answer:
      "You can bank your Dream Points toward your goals in the Dream Fulfillment ecosystem or use them to enter the Giveaway for a chance to win amazing prizes.",
  },
  {
    question: "Can I advertise on the app?",
    answer:
      "Yes, you can advertise your services on the app. We offer advertising options for businesses and individuals.",
  },
  {
    question: "How do I advertise on the app?",
    answer:
      "You can contact our advertising team to learn more about advertising options and pricing.",
  },
  {
    question: "How much does it cost to advertise?",
    answer:
      "The cost of advertising in the app varies depending on the length and placement of your post.",
  },
  {
    question: "Is the app free to use?",
    answer:
      "Yes, the app is free to use. However, some premium content may require points or a subscription.",
  },
  {
    question: "How do I contact customer support?",
    answer:
      "You can contact customer support through the app or by visiting our website. We offer email and chat support.",
  },
];

const FAQs = () => (
  <Screen statusBarStyle="light">
    <ScrollView
      contentContainerClassName="p-4"
      layout={AccordionLayoutTransition}
      showsVerticalScrollIndicator={false}
    >
      <Accordion
        defaultValue={["0"]}
        selectionMode="multiple"
        variant="surface"
      >
        {questions.map((item, index) => (
          <Accordion.Item key={index} value={index.toString()}>
            <Accordion.Trigger>
              <Text className="flex-1 pr-2 font-semibold text-base">
                {index + 1}. {item.question}
              </Text>
              <Accordion.Indicator />
            </Accordion.Trigger>
            <Accordion.Content>
              <Text className="text-muted-foreground text-sm leading-relaxed">
                {item.answer}
              </Text>
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion>
    </ScrollView>
  </Screen>
);

export default FAQs;
