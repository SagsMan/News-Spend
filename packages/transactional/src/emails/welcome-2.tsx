import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";

const WelcomeEmail = ({ username = "there" }) => (
  <Html>
    <Head />
    <Preview>
      Welcome to Newsspend Media - Important Account Information
    </Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Section>
          <Text style={styles.text}>Dear {username},</Text>

          <Text style={styles.text}>
            Thank you for joining Newsspend Media. I wanted to personally reach
            out with some important information about your new account.
          </Text>

          <Text style={styles.text}>
            Your account is now active, and you can start using our platform
            right away. Here are the key details you need to know:
          </Text>

          <Text style={styles.text}>To get started:</Text>
          <Text style={styles.listItem}>
            1. Log into your account using the app
          </Text>
          <Text style={styles.listItem}>2. Complete your profile setup</Text>
          <Text style={styles.listItem}>
            3. Start engaging with content through reading, watching streams, or
            taking surveys
          </Text>
          <Text style={styles.listItem}>
            4. Track your earned points in your dashboard
          </Text>

          <Text style={styles.text}>
            Please note that Dream Points expire after 12 months, and you can
            redeem them for in-app rewards or enter our bi-weekly Giveaway. See
            the in-app Giveaway Official Rules for full details.
          </Text>

          <Text style={styles.text}>
            If you need any assistance, our support team is available at{" "}
            <Link href="mailto:support@newsspend.com" style={styles.link}>
              support@newsspend.com
            </Link>
          </Text>

          <Hr style={styles.hr} />

          <Text style={styles.signature}>Best regards,</Text>
          <Text style={styles.signature}>Segun Obisesan</Text>
          <Text style={styles.title}>Director, Newsspend Media</Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

const styles = {
  body: {
    backgroundColor: "#ffffff",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  container: {
    margin: "0 auto",
    padding: "20px 0 48px",
    width: "100%",
    maxWidth: "600px",
  },
  text: {
    fontSize: "16px",
    lineHeight: "24px",
    color: "#333333",
    marginBottom: "20px",
  },
  listItem: {
    fontSize: "16px",
    lineHeight: "24px",
    color: "#333333",
    marginBottom: "8px",
    paddingLeft: "16px",
  },
  link: {
    color: "#0066cc",
    textDecoration: "underline",
  },
  hr: {
    borderColor: "#e6e6e6",
    margin: "30px 0",
  },
  signature: {
    fontSize: "16px",
    lineHeight: "24px",
    color: "#333333",
    marginBottom: "4px",
  },
  title: {
    fontSize: "14px",
    lineHeight: "20px",
    color: "#666666",
    marginTop: "4px",
  },
};

export default WelcomeEmail;
