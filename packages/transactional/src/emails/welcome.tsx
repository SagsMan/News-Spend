import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";

type WelcomeEmailProps = {
  username: string;
};

export const WelcomeEmail = ({ username = "User" }: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Preview>Welcome to Newsspend Media. Today is just the beginning.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img
            alt="News Spend Welcome Banner"
            src="https://newsspend.com/images/Newspend-welcome-banner.jpg"
            style={logo}
          />
        </Section>

        <Text style={greeting}>Hi {username}</Text>

        <Text style={title}>🌟 Welcome to Newsspend Media</Text>

        <Text style={intro}>
          Today isn't just a welcome. <br />
          It's the beginning of something bigger.
        </Text>

        <Text style={description}>
          You've just stepped into a platform designed to transform your
          everyday digital life into real-world progress, rewards, and
          opportunities. A platform built to celebrate ambition, reward
          perseverance, and change lives.
        </Text>

        <Section style={section}>
          <Text style={sectionTitle}>🎯 Our Vision</Text>
          <Text style={sectionSubtitle}>
            Turning Engagement into Empowerment
          </Text>
          <Text style={description}>We believe something powerful:</Text>
          <Text style={description}>
            The time you spend online should move your life forward.
          </Text>
          <Text style={description}>
            With Newsspend, the things you already do every day become valuable:
          </Text>
          <Text style={list}>📱 Watch content</Text>
          <Text style={list}>📰 Read news</Text>
          <Text style={list}>🛍️ Shop</Text>
          <Text style={list}>📊 Complete surveys</Text>
          <Text style={list}>
            ➡️ And earn rewards that bring your dreams closer
          </Text>
        </Section>

        <Section style={section}>
          <Text style={sectionTitle}>🚀 How It Works</Text>

          <Text style={stepTitle}>📍 1. Begin Your Journey</Text>
          <ul style={steps}>
            <li style={stepItem}>You're already set up and ready</li>
            <li style={stepItem}>Your goals are in place</li>
            <li style={stepItem}>Every action from now on moves you forward</li>
          </ul>

          <Text style={stepTitle}>⚡ 2. Earn Points Effortlessly</Text>
          <Text style={description}>
            Do what you already love, and get rewarded:
          </Text>
          <ul style={checklist}>
            <li>✔️ Read meaningful content</li>
            <li>✔️ Watch &amp; share engaging videos</li>
            <li>✔️ Engage with brands and content</li>
            <li>✔️ Complete simple tasks &amp; surveys</li>
          </ul>
          <Text style={note}>
            💡 Every interaction = Progress toward your dream
          </Text>

          <Text style={stepTitle}>
            💎 3. Turn Points into Real-Life Rewards
          </Text>
          <Text style={description}>This is where it becomes real:</Text>
          <Text style={rewardTitle}>🎯 Dream Fulfillment</Text>
          <Text style={description}>
            Track your progress toward goals that matter to you, including
            scholarships, sponsored experiences, shopping support, skill
            development, and more.
          </Text>
          <Text style={rewardTitle}>🎁 Enter the Giveaway</Text>
          <Text style={description}>
            Use your Dream Points to enter our bi-weekly Giveaway for a chance
            to win:
          </Text>
          <ul style={rewardList}>
            <li>Dream Points</li>
            <li>Airtime and data bundles</li>
            <li>Promotional merchandise and electronics</li>
          </ul>
          <Text style={description}>
            See the in-app Giveaway Official Rules for full details.
          </Text>

          <Text style={stepTitle}>🏦 4. Grow &amp; Bank Your Progress</Text>
          <ul style={steps}>
            <li style={stepItem}>Stay consistent</li>
            <li style={stepItem}>Build momentum daily</li>
            <li style={stepItem}>Watch your progress stack up</li>
          </ul>
        </Section>

        <Section style={section}>
          <Text style={note}>
            📝 Note: Points reset every 12 months, so make the most of every
            opportunity to earn and grow.
          </Text>
        </Section>

        <Section style={section}>
          <Text style={sectionTitle}>🌍 Why This Changes Everything</Text>
          <Text style={description}>Newsspend is not just another app.</Text>
          <Text style={description}>
            It's a new system of opportunity. A place where:
          </Text>
          <ul style={checklist}>
            <li>Your time has value</li>
            <li>Your effort gets rewarded</li>
            <li>Your dreams become achievable</li>
          </ul>
          <Text style={description}>
            Small daily actions → Meaningful life progress
          </Text>
        </Section>

        <Section style={section}>
          <Text style={sectionTitle}>🤝 You're Part of Something Bigger</Text>
          <Text style={description}>
            You're not just a user. You are now part of a growing community of
            people who are:
          </Text>
          <ul style={checklist}>
            <li>Taking control of their future</li>
            <li>Turning consistency into results</li>
            <li>Building real progress, one action at a time</li>
          </ul>
        </Section>

        <Section style={footerSection}>
          <Text style={sectionTitle}>📩 We're Here for You</Text>
          <Text style={description}>Need support?</Text>
          <Link href="mailto:support@newsspend.com" style={link}>
            support@newsspend.com
          </Link>
        </Section>

        <Hr style={hr} />

        <Text style={footer}>
          &copy; {new Date().getFullYear()} News Spend Media. All rights
          reserved.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default WelcomeEmail;

const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  maxWidth: "600px",
  margin: "0 auto",
  backgroundColor: "white",
  padding: "20px",
};

const logoSection = {
  padding: "20px",
  textAlign: "center" as const,
  borderBottom: "1px solid #e0e0e0",
};

const logo: React.CSSProperties = {
  maxWidth: "100%",
  height: "150px",
  margin: "0 auto",
  objectFit: "contain",
};

const greeting = {
  fontSize: "14px",
  color: "#333",
  marginTop: "24px",
};

const title = {
  fontSize: "28px",
  fontWeight: "bold",
  color: "#333",
  margin: "24px 0 12px",
};

const intro = {
  fontSize: "18px",
  color: "#333",
  lineHeight: "1.5",
  marginBottom: "12px",
};

const description = {
  fontSize: "14px",
  color: "#333",
  lineHeight: "1.6",
  marginBottom: "12px",
};

const section = {
  margin: "24px 0",
};

const sectionTitle = {
  fontSize: "20px",
  fontWeight: "bold",
  color: "#333",
  marginBottom: "8px",
};

const sectionSubtitle = {
  fontSize: "16px",
  fontWeight: "600",
  color: "#333",
  marginBottom: "12px",
};

const _quote = {
  fontSize: "14px",
  fontStyle: "italic",
  color: "#333",
  marginBottom: "12px",
  paddingLeft: "12px",
  borderLeft: "3px solid #7c3aed",
};

const list = {
  fontSize: "14px",
  color: "#333",
  marginBottom: "4px",
};

const steps = {
  paddingLeft: "20px",
  marginBottom: "12px",
};

const stepItem = {
  fontSize: "14px",
  color: "#333",
  marginBottom: "4px",
};

const stepTitle = {
  fontSize: "16px",
  fontWeight: "bold",
  color: "#333",
  marginTop: "16px",
  marginBottom: "8px",
};

const checklist = {
  paddingLeft: "20px",
  marginBottom: "12px",
};

const note = {
  fontSize: "14px",
  color: "#7c3aed",
  fontWeight: "500",
  marginBottom: "12px",
};

const rewardTitle = {
  fontSize: "14px",
  fontWeight: "bold",
  color: "#333",
  marginTop: "12px",
  marginBottom: "4px",
};

const rewardList = {
  paddingLeft: "20px",
  fontSize: "14px",
  color: "#333",
};

const link = {
  color: "#7c3aed",
  textDecoration: "underline",
};

const hr = {
  borderColor: "#cccccc",
  margin: "32px 0",
};

const footerSection = {
  backgroundColor: "#f9f9f9",
  padding: "24px",
};

const footer = {
  color: "#898989",
  fontSize: "12px",
  textAlign: "center" as const,
};
