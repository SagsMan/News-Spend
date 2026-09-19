const css = `
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    line-height: 1.6;
    color: #333;
    background-color: #f5f5f5;
}

.container {
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
    background-color: white;
    min-height: 100vh;
}

header {
    border-bottom: 2px solid #e0e0e0;
    padding-bottom: 20px;
    margin-bottom: 30px;
}

h1 {
    font-size: 2em;
    color: #1a1a1a;
    margin-bottom: 10px;
}

.last-updated {
    color: #666;
    font-size: 0.9em;
}

.content {
    padding: 20px 0;
}

h2 {
    font-size: 1.5em;
    color: #1a1a1a;
    margin-top: 30px;
    margin-bottom: 15px;
}

h3 {
    font-size: 1.2em;
    color: #333;
    margin-top: 20px;
    margin-bottom: 10px;
}

p {
    margin-bottom: 15px;
}

ul, ol {
    margin-left: 25px;
    margin-bottom: 15px;
}

li {
    margin-bottom: 8px;
}

a {
    color: #1a73e8;
    text-decoration: none;
}

a:hover {
    text-decoration: underline;
}

footer {
    margin-top: 50px;
    padding-top: 20px;
    border-top: 1px solid #e0e0e0;
    text-align: center;
    color: #666;
    font-size: 0.9em;
}

@media (max-width: 768px) {
    .container {
        padding: 15px;
    }

    h1 {
        font-size: 1.5em;
    }

    h2 {
        font-size: 1.3em;
    }
}
`;

export function PrivacyPolicy() {
  const currentYear = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Privacy Policy</title>
    <style>
      ${css}
    </style>
  </head>
  <body>
    <div class="container">
      <header>
        <h1>Privacy Policy for Newsspend Media</h1>
        <p class="last-updated">Effective Date: December 16, 2025</p>
      </header>

      <div class="content">
        <p>
          Newsspend Media ("we", "our", "us") operates the Newsspend Media
          mobile application distributed via the Apple App Store and Google
          Play Store (the "App"). This Privacy Policy explains how we
          collect, use, share, and protect user information in compliance
          with applicable app store privacy requirements.
        </p>

        <p>
          By installing or using the App, you agree to the practices
          described in this Privacy Policy.
        </p>

        <h2>1. Information We Collect</h2>

        <h3>a. Personal Information</h3>
        <p>
          We collect personal information when you voluntarily provide it,
          including when you:
        </p>
        <ul>
          <li>Register or manage an account</li>
          <li>Participate in reward programs, surveys, or challenges</li>
          <li>Contact customer support</li>
        </ul>
        <p>This information may include:</p>
        <ul>
          <li>Name</li>
          <li>Email address</li>
          <li>Phone number</li>
        </ul>

        <h3>b. Location Information</h3>
        <p>We collect precise location data (GPS-level location) to:</p>
        <ul>
          <li>Enable location-based content, promotions, and campaigns</li>
          <li>Support reward eligibility and fraud prevention</li>
          <li>Improve analytics and service performance</li>
        </ul>
        <p>
          You may enable or disable location permissions at any time through
          your device settings (iOS or Android).
        </p>

        <h3>c. App Usage and Activity Data</h3>
        <p>
          We automatically collect data related to your interaction with the
          App, including:
        </p>
        <ul>
          <li>Screens viewed and features used</li>
          <li>Live stream viewing duration within the App</li>
          <li>Points earned, redeemed, or forfeited</li>
          <li>
            Survey participation, task completion, and referral activity
          </li>
        </ul>
        <p>
          Guest users may view content; however, guest activity is not
          eligible for reward tracking.
        </p>

        <h3>d. Device and Technical Information</h3>
        <p>This includes:</p>
        <ul>
          <li>IP address</li>
          <li>Device identifiers</li>
          <li>Device model and operating system</li>
          <li>App version</li>
          <li>Crash logs and performance diagnostics</li>
        </ul>

        <h2>2. How We Use Information</h2>
        <p>We use collected information to:</p>
        <ul>
          <li>Operate, maintain, and improve the App</li>
          <li>Track engagement and determine reward eligibility</li>
          <li>Serve advertisements and sponsored content</li>
          <li>Communicate important updates and service notices</li>
          <li>Detect, prevent, and address fraud or misuse</li>
          <li>Meet legal and regulatory obligations</li>
        </ul>

        <h2>3. Rewards, Points, and Incentives</h2>
        <p>
          The App includes a reward system that grants points or incentives
          based on verified user activities. We reserve the right to:
        </p>
        <ul>
          <li>Validate user actions before awarding points</li>
          <li>
            Withhold, adjust, or revoke rewards obtained through fraudulent
            or abusive behavior
          </li>
          <li>Modify reward rules or eligibility criteria at any time</li>
        </ul>

        <h2>4. Third-Party Services, SDKs, and APIs</h2>
        <p>
          The App integrates third-party services using software development
          kits (SDKs), APIs, and embedded content to support its features.
          These services may include:
        </p>
        <ul>
          <li>Analytics services (e.g., Firebase, Google Analytics)</li>
          <li>Advertising networks and brand partners</li>
        </ul>
        <p>
          These third parties may collect data in accordance with their own
          privacy policies. Newsspend Media does not control their data
          collection practices.
        </p>

        <h2>6. Data Sharing and Disclosure</h2>
        <p>We do not sell personal information. We may share data only:</p>
        <ul>
          <li>
            With service providers supporting analytics, advertising,
            infrastructure, or rewards
          </li>
          <li>To comply with legal obligations or lawful requests</li>
          <li>
            To protect the security, rights, and integrity of the App and
            its users
          </li>
        </ul>

        <h2>7. Data Retention and Deletion</h2>
        <p>
          We retain personal data only for as long as necessary to fulfill
          the purposes described in this policy or as required by law. Users
          may request data deletion by contacting
          <a href="mailto:support@newsspend.com">support@newsspend.com</a>.
          Data that is no longer required is securely deleted or anonymized.
        </p>

        <h2>8. User Choices and Controls</h2>
        <p>Users may:</p>
        <ul>
          <li>Manage app permissions through device settings</li>
          <li>Request access to or deletion of their personal data</li>
          <li>Opt out of certain communications</li>
        </ul>
        <p>
          Requests can be sent to
          <a href="mailto:support@newsspend.com">support@newsspend.com</a>.
        </p>

        <h2>9. Data Security</h2>
        <p>
          We apply reasonable administrative, technical, and physical
          safeguards to protect user information. However, no system can be
          guaranteed to be completely secure.
        </p>

        <h2>10. Children's Privacy</h2>
        <p>
          The App is not intended for children under the age of 13. We do
          not knowingly collect personal information from children.
        </p>

        <h2>11. International Data Transfers</h2>
        <p>
          User information may be processed on servers located outside the
          user's country of residence. By using the App, you consent to such
          processing in accordance with this Privacy Policy.
        </p>

        <h2>12. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Updates will
          be posted on the App Store and Google Play Store listings, and
          within the App.
          Continued use of the App indicates acceptance of the revised
          policy.
        </p>

        <h2>13. Contact Information</h2>
        <p>
          <strong>Newsspend Media</strong>
          <br />📧 Email:
          <a href="mailto:support@newsspend.com">support@newsspend.com</a>
          <br />
          🇳🇬 Registered in Nigeria
        </p>

        <p>
          <em>
            This Privacy Policy applies to all versions of the Newsspend
            Media application distributed via the Apple App Store and
            Google Play Store.
          </em>
        </p>
      </div>

      <footer>
        <p>&copy; ${currentYear} Newsspend Media. All rights reserved.</p>
      </footer>
    </div>
  </body>
</html>`;
}
