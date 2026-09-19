import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "react-email";

type ForgotPasswordEmailProps = {
  resetLink: string;
};

export const ForgotPasswordEmail = ({
  resetLink,
}: ForgotPasswordEmailProps) => (
  <Html>
    <Head />
    <Preview>Reset Your Password</Preview>
    <Body style={body}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img
            alt="News Spend Logo"
            src="https://newsspend.com/images/newsspend-logo.jpeg"
            style={logo}
          />
        </Section>

        <Section style={contentSection}>
          <Text style={heading}>Reset Your Password</Text>
          <Text style={paragraph}>
            You have requested to reset your password. Click the button below to
            create a new password.
          </Text>

          <Button href={resetLink} style={button}>
            Reset Password
          </Button>

          <Text style={helpText}>
            If you didn't request a password reset, please ignore this email or
            contact support.
          </Text>
        </Section>

        <Section style={footerSection}>
          <Text style={footer}>
            &copy; {new Date().getFullYear()} News Spend Media. All rights
            reserved.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

const body = {
  backgroundColor: "#f4f4f4",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const container = {
  maxWidth: "600px",
  margin: "0 auto",
  backgroundColor: "white",
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
  margin: "auto",
};

const contentSection = {
  padding: "30px",
  textAlign: "center" as const,
};

const heading = {
  fontSize: "24px",
  color: "#333",
  marginBottom: "20px",
};

const paragraph = {
  fontSize: "16px",
  color: "#666",
  lineHeight: "1.5",
  marginBottom: "25px",
};

const button = {
  backgroundColor: "#007bff",
  color: "white",
  padding: "12px 24px",
  borderRadius: "5px",
  textDecoration: "none",
  display: "inline-block",
  fontWeight: "bold",
};

const helpText = {
  fontSize: "14px",
  color: "#999",
  marginTop: "25px",
};

const footerSection = {
  padding: "20px",
  textAlign: "center" as const,
  borderTop: "1px solid #e0e0e0",
  backgroundColor: "#f8f9fa",
};

const footer = {
  fontSize: "12px",
  color: "#888",
};

export default ForgotPasswordEmail;

// Usage example:
// <ForgotPasswordEmail resetLink="https://yourwebsite.com/reset-password?token=abc123" />
