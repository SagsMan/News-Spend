const styles = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: Inter;
    line-height: 1.6;
    color: #333;
    background-color: #f5f5f5;
    padding: 20px;
  }

  .container {
    max-width: 800px;
    margin: 0 auto;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 40px 20px;
    text-align: center;
  }

  .header h1 {
    font-size: 32px;
    font-weight: 700;
    margin-bottom: 10px;
  }

  .header p {
    font-size: 16px;
    opacity: 0.95;
  }

  .content {
    padding: 40px 20px;
  }

  .section {
    margin-bottom: 40px;
  }

  .section:last-child {
    margin-bottom: 0;
  }

  .section h2 {
    font-size: 24px;
    font-weight: 700;
    color: #333;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .section p {
    font-size: 16px;
    color: #666;
    margin-bottom: 16px;
  }

  .warning-box {
    background: #fff3cd;
    border: 2px solid #ffc107;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 24px;
  }

  .warning-box h3 {
    color: #856404;
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .warning-box p {
    color: #856404;
    margin: 0;
  }

  .steps {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 24px;
    margin-top: 16px;
  }

  .steps ol {
    list-style: none;
    counter-reset: step-counter;
    padding: 0;
  }

  .steps li {
    counter-increment: step-counter;
    position: relative;
    padding-left: 50px;
    margin-bottom: 16px;
    font-size: 16px;
    color: #333;
  }

  .steps li:last-child {
    margin-bottom: 0;
  }

  .steps li::before {
    content: counter(step-counter);
    position: absolute;
    left: 0;
    top: 0;
    background: #667eea;
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
  }

  .data-list {
    list-style: none;
    padding: 0;
  }

  .data-list li {
    padding: 12px 0;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    font-size: 16px;
    color: #333;
  }

  .data-list li:last-child {
    border-bottom: none;
  }

  .data-list li::before {
    content: "✓";
    color: #dc3545;
    font-weight: 700;
    font-size: 18px;
    flex-shrink: 0;
  }

  .contact-box {
    background: #e7f3ff;
    border: 2px solid #2196f3;
    border-radius: 8px;
    padding: 20px;
    margin-top: 16px;
  }

  .contact-box h3 {
    color: #0d47a1;
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 12px;
  }

  .contact-box p {
    color: #0d47a1;
    margin-bottom: 8px;
  }

  .contact-box a {
    color: #2196f3;
    text-decoration: none;
    font-weight: 600;
  }

  .contact-box a:hover {
    text-decoration: underline;
  }

  .info-box {
    background: #f8f9fa;
    border-left: 4px solid #667eea;
    border-radius: 4px;
    padding: 16px 20px;
    margin-top: 16px;
  }

  .info-box p {
    margin: 0;
    color: #495057;
  }

  .footer {
    background: #f8f9fa;
    padding: 24px 20px;
    text-align: center;
    border-top: 1px solid #dee2e6;
    font-size: 14px;
    color: #6c757d;
  }

  .footer a {
    color: #667eea;
    text-decoration: none;
    margin: 0 8px;
  }

  .footer a:hover {
    text-decoration: underline;
  }

  .badge {
    display: inline-block;
    background: #28a745;
    color: white;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    margin-left: 8px;
  }

  @media (max-width: 768px) {
    body {
      padding: 0;
    }

    .container {
      border-radius: 0;
    }

    .header {
      padding: 30px 20px;
    }

    .header h1 {
      font-size: 28px;
    }

    .content {
      padding: 30px 16px;
    }

    .section h2 {
      font-size: 20px;
    }

    .steps li {
      padding-left: 45px;
      font-size: 15px;
    }

    .data-list li {
      font-size: 15px;
    }
  }
`;

export function AccountDeletionPage() {
  const currentYear = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta content="width=device-width, initial-scale=1.0" name="viewport" />
    <meta
      content="Learn how to permanently delete your News Spend account and what data will be removed."
      name="description"
    />
    <title>Delete Your Account - News Spend</title>
    <link href="https://fonts.googleapis.com" rel="preconnect" />
    <link
      crossorigin="anonymous"
      href="https://fonts.gstatic.com"
      rel="preconnect"
    />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap"
      rel="stylesheet"
    />
    <style>${styles}</style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Delete Your Account</h1>
        <p>Instructions for permanently deleting your News Spend account</p>
      </div>

      <div class="content">
        <div class="warning-box">
          <h3>Important Warning</h3>
          <p>
            Account deletion is permanent and cannot be undone. Once
            deleted, all your data will be immediately removed from our
            servers.
          </p>
        </div>

        <div class="section">
          <h2>How to Delete Your Account</h2>
          <p>
            You can delete your account directly from the News Spend mobile
            app.
            <span class="badge">Recommended</span>
          </p>
          <div class="steps">
            <ol>
              <li>
                Open the <strong>News Spend</strong> app on your device
              </li>
              <li>
                Tap the <strong>Settings</strong> tab at the bottom of the
                screen
              </li>
              <li>
                Scroll down and tap <strong>Delete Account</strong> (red
                icon)
              </li>
              <li>Read the consequences and warnings carefully</li>
              <li>
                Enter your <strong>password</strong> to verify your identity
              </li>
              <li>
                Check the acknowledgment box to confirm you understand
              </li>
              <li>
                Tap <strong>"Delete My Account"</strong>
              </li>
              <li>Confirm the deletion in the final dialog</li>
            </ol>
          </div>
          <div class="info-box">
            <p>
              <strong>Note:</strong> You must be logged in to delete your
              account. The deletion process takes effect immediately.
            </p>
          </div>
        </div>

        <div class="section">
          <h2>What Gets Deleted</h2>
          <p>
            When you delete your account, the following data is permanently
            removed:
          </p>
          <ul class="data-list">
            <li>
              Your profile information (name, email, username)
            </li>
            <li>All reward points and activity history</li>
            <li>Your comments and posts</li>
            <li>All saved preferences and settings</li>
            <li>Push notification tokens and device information</li>
            <li>All active sessions (you'll be logged out immediately)</li>
          </ul>
        </div>

        <div class="section">
          <h2>Data Retention Policy</h2>
          <p>
            We do <strong>not retain</strong> any personal data after
            account deletion. Your information is permanently removed from
            our servers immediately upon confirmation.
          </p>
          <p>
            This includes all personal identifiable information,
            user-generated content, and activity records.
          </p>
        </div>

        <div class="section">
          <h2>Account Recovery</h2>
          <p>
            <strong>Account deletion cannot be reversed.</strong> Once you
            confirm the deletion:
          </p>
          <ul class="data-list">
            <li>Your account cannot be recovered or restored</li>
            <li>You cannot log in with the same credentials</li>
            <li>All your data is permanently lost</li>
            <li>
              You'll need to create a new account to use the app again
            </li>
          </ul>
        </div>

        <div class="section">
          <h2>Need Help?</h2>
          <div class="contact-box">
            <h3>Having trouble deleting your account?</h3>
            <p>Our support team is here to help:</p>
            <p>
              Email:
              <a href="mailto:support@newsspend.com">
                support@newsspend.com
              </a>
            </p>
            <p>
              We typically respond within 24 hours during business days.
            </p>
          </div>
        </div>

        <div class="section">
          <h2>Alternatives</h2>
          <p>
            If you're not sure about deleting your account permanently,
            consider these alternatives:
          </p>
          <ul class="data-list">
            <li>
              <strong>Log out</strong> - Take a break without losing your
              data
            </li>
            <li>
              <strong>Disable notifications</strong> - Reduce interruptions
              in Settings
            </li>
            <li>
              <strong>Contact support</strong> - We can help resolve any
              issues you're experiencing
            </li>
          </ul>
        </div>
      </div>

      <div class="footer">
        <a href="/privacy-policy">Privacy Policy</a> |
        <p style="margin-top: 8px">
            &copy; ${currentYear} News Spend. All rights reserved.
        </p>
        <p style="margin-top: 8px; font-size: 12px">
          Last updated: January 2025
        </p>
      </div>
    </div>
  </body>
</html>`;
}
