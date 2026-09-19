import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";

type AccountDeletedEmailProps = {
  username: string;
};

export const AccountDeletedEmail = ({
  username = "User",
}: AccountDeletedEmailProps) => (
  <Html>
    <Head />
    <Preview>Your News-Spend Media account has been deleted</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img
            alt="News Spend Logo"
            src="https://newsspend.com/images/newsspend-logo.jpeg"
            style={logo}
          />
        </Section>

        <Heading style={h1}>Account Deletion Confirmation</Heading>

        <Text style={text}>Dear {username},</Text>

        <Text style={text}>
          We're writing to confirm that your News-Spend Media account has been
          successfully deleted as per your request.
        </Text>

        <Section style={section}>
          <Heading style={h2}>What This Means</Heading>
          <Text style={text}>
            Your account and all associated data have been permanently removed
            from our system, including:
          </Text>
          <ul style={list}>
            <li style={listItem}>Your profile information</li>
            <li style={listItem}>Accumulated points and rewards</li>
            <li style={listItem}>Activity history</li>
            <li style={listItem}>Notification preferences</li>
            <li style={listItem}>Push notification tokens</li>
          </ul>
        </Section>

        <Section style={section}>
          <Heading style={h2}>We're Sorry to See You Go</Heading>
          <Text style={text}>
            Thank you for being part of the News-Spend Media community. We hope
            your experience with us was valuable, and we're sorry to see you
            leave.
          </Text>
        </Section>

        <Section style={section}>
          <Heading style={h2}>Come Back Anytime</Heading>
          <Text style={text}>
            If you change your mind, you're always welcome to create a new
            account and rejoin our community. We'd love to have you back!
          </Text>
        </Section>

        <Text style={text}>
          If you did not request this deletion or have any concerns, please
          contact our support team immediately at{" "}
          <Link href="mailto:support@newsspend.com">support@newsspend.com</Link>
          .
        </Text>

        <Hr style={hr} />

        <Text style={footer}>
          &copy; {new Date().getFullYear()} News Spend Media. All rights
          reserved.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default AccountDeletedEmail;

const main = {
  backgroundColor: "#ffffff",
  fontSize: "5px",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  maxWidth: "600px",
  margin: "0 auto",
  backgroundColor: "white",
  padding: "20px",
  borderRadius: "8px",
  boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
};

const logoSection = {
  padding: "20px",
  textAlign: "center" as const,
  borderBottom: "1px solid #e0e0e0",
};

const logo = {
  maxWidth: "250px",
  height: "auto",
  margin: "0 auto",
};

const h1 = {
  color: "#333",
  fontSize: "24px",
  fontWeight: "bold",
  margin: "40px 0 20px",
  padding: "0",
  textAlign: "center" as const,
};

const h2 = {
  color: "#333",
  fontSize: "20px",
  fontWeight: "bold",
  margin: "18px 0",
  padding: "0",
};

const text = {
  color: "#333",
  fontSize: "14px",
  lineHeight: "26px",
};

const list = {
  paddingLeft: "20px",
  margin: "16px 0",
};

const listItem = {
  color: "#333",
  fontSize: "14px",
  lineHeight: "26px",
  marginBottom: "8px",
};

const section = {
  margin: "24px 0",
};

const hr = {
  borderColor: "#cccccc",
  margin: "20px 0",
};

const footer = {
  color: "#898989",
  fontSize: "12px",
  marginTop: "24px",
  textAlign: "center" as const,
};
