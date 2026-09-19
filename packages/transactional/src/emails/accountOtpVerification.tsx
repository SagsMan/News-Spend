import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";

export function NewsSpendVerificationEmail({ otp = "123456" }) {
  return (
    <Html>
      <Head />
      <Preview>
        Verify Your News Spend Media Account -- Unlock Your Dream Journey!
      </Preview>
      <Body
        style={{
          backgroundColor: "#f4f4f4",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <Container
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          }}
        >
          <Heading
            as="h1"
            style={{
              color: "#333",
              textAlign: "center",
              fontSize: "24px",
              marginBottom: "20px",
            }}
          >
            Verify Your Newsspend Media Account
          </Heading>

          <Section
            style={{
              backgroundColor: "#f9f9f9",
              padding: "15px",
              borderRadius: "6px",
              marginBottom: "20px",
            }}
          >
            <Text
              style={{
                fontSize: "16px",
                lineHeight: "1.5",
                color: "#333",
                fontStyle: "italic",
                marginBottom: "15px",
              }}
            >
              This is your moment. This is where your dream activation begins.
            </Text>

            <Section
              style={{
                backgroundColor: "#f0f0f0",
                padding: "20px",
                borderRadius: "8px",
                textAlign: "center",
                marginBottom: "15px",
              }}
            >
              <Text
                style={{
                  fontSize: "16px",
                  lineHeight: "1.5",
                  color: "#333",
                  marginBottom: "10px",
                }}
              >
                Your Verification Code:
              </Text>

              <Text
                style={{
                  fontSize: "32px",
                  fontWeight: "bold",
                  letterSpacing: "10px",
                  color: "#007bff",
                  backgroundColor: "white",
                  padding: "15px",
                  borderRadius: "8px",
                  display: "inline-block",
                  margin: "0 auto",
                  textAlign: "center",
                }}
              >
                {otp}
              </Text>

              <Text
                style={{
                  fontSize: "14px",
                  color: "#666",
                  marginTop: "10px",
                }}
              >
                This code will expire in 10 minutes. Enter it quickly to
                activate your dream!
              </Text>
            </Section>

            <Text
              style={{
                fontSize: "16px",
                lineHeight: "1.5",
                color: "#333",
              }}
            >
              <strong>What Happens Next?</strong>
              <br />
              Once verified, you'll be able to:
            </Text>
            <ul
              style={{
                paddingLeft: "20px",
                fontSize: "14px",
                lineHeight: "1.5",
                color: "#333",
              }}
            >
              <li>Earn Dream Points through engaging activities</li>
              <li>Enter the bi-weekly Giveaway for a chance to win prizes</li>
              <li>Start your journey towards achieving your dreams</li>
            </ul>
          </Section>

          <Text
            style={{
              fontSize: "14px",
              lineHeight: "1.5",
              color: "#333",
              marginBottom: "20px",
            }}
          >
            If you did not request this verification, please contact our support
            team at{" "}
            <Link
              href="mailto:support@newsspend.com"
              style={{ color: "#0066cc" }}
            >
              support@newsspend.com
            </Link>
            .
          </Text>

          <Text
            style={{
              fontSize: "14px",
              lineHeight: "1.5",
              color: "#333",
              marginBottom: "20px",
            }}
          >
            We're excited to have you join our community of dreamers, achievers,
            and go-getters. Together, we'll turn your dreams into reality!
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default NewsSpendVerificationEmail;
