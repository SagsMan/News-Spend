# Quick Start Guide

## 🚀 Start the Email Preview Server

From the root of the monorepo:

```bash
bun run dev:email
```

Or from this package directory:

```bash
cd packages/transactional
bun dev
```

Open [http://localhost:3000](http://localhost:3000) to see all email templates.

## 📧 Available Email Templates

### Welcome Email

**File:** `emails/welcome.tsx`  
**Use case:** New user registration

```ts
import WelcomeEmail from "@news-spend-media/transactional/emails/welcome";

const html = await render(WelcomeEmail({ name: "John Doe" }));
```

### Password Reset Email

**File:** `emails/password-reset.tsx`  
**Use case:** Password reset requests

```ts
import PasswordResetEmail from "@news-spend-media/transactional/emails/password-reset";

const html = await render(
  PasswordResetEmail({
    name: "John Doe",
    resetLink: "https://example.com/reset?token=abc123",
  })
);
```

### Notification Email

**File:** `emails/notification.tsx`  
**Use case:** General notifications

```ts
import NotificationEmail from "@news-spend-media/transactional/emails/notification";

const html = await render(
  NotificationEmail({
    name: "John Doe",
    title: "New activity on your account",
    message: "Someone just viewed your profile.",
    actionUrl: "https://example.com/activity",
    actionText: "View Activity",
  })
);
```

## 💻 Basic Usage Example

```ts
import { render } from "@react-email/components";
import WelcomeEmail from "@news-spend-media/transactional/emails/welcome";

async function sendWelcomeEmail(userEmail: string, userName: string) {
  // Render email to HTML
  const html = await render(WelcomeEmail({ name: userName }));

  // Send with your email service (Resend, Nodemailer, etc.)
  await emailService.send({
    to: userEmail,
    subject: "Welcome to News Spend Media!",
    html,
  });
}
```

## 🎨 Creating Your First Email

1. Create a new file in `emails/` directory:

```tsx
// emails/my-email.tsx
import { Body, Button, Head, Html, Text } from "@react-email/components";

type MyEmailProps = {
  userName: string;
};

export default function MyEmail({ userName }: MyEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "sans-serif", padding: "20px" }}>
        <Text>Hello {userName}!</Text>
        <Button
          href="https://example.com"
          style={{
            background: "#000",
            color: "#fff",
            padding: "12px 20px",
            textDecoration: "none",
            borderRadius: "6px",
          }}
        >
          Get Started
        </Button>
      </Body>
    </Html>
  );
}
```

2. Save the file and it will automatically appear in the preview server

3. Use it in your application:

```ts
import MyEmail from "@news-spend-media/transactional/emails/my-email";

const html = await render(MyEmail({ userName: "Alice" }));
```

## 📦 Integration with Email Services

### Resend (Recommended)

```bash
bun add resend
```

```ts
import { Resend } from "resend";
import WelcomeEmail from "@news-spend-media/transactional/emails/welcome";

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: "noreply@yourdomain.com",
  to: "user@example.com",
  subject: "Welcome!",
  react: WelcomeEmail({ name: "John" }),
});
```

### Nodemailer

```bash
bun add nodemailer
```

```ts
import nodemailer from "nodemailer";
import { render } from "@react-email/components";
import WelcomeEmail from "@news-spend-media/transactional/emails/welcome";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const html = await render(WelcomeEmail({ name: "John" }));

await transporter.sendMail({
  from: "noreply@yourdomain.com",
  to: "user@example.com",
  subject: "Welcome!",
  html,
});
```

## 🎯 Pro Tips

1. **Preview Text**: Add a preview that shows in inbox listings

```tsx
import { Preview } from "@react-email/components";

<Preview>This shows up in email preview!</Preview>;
```

2. **Inline Styles**: Always use inline styles for email compatibility

```tsx
<Text style={{ color: "#000", fontSize: "16px" }}>Content</Text>
```

3. **Responsive Design**: Use max-width and mobile-friendly styles

```tsx
const container = {
  maxWidth: "600px",
  margin: "0 auto",
};
```

4. **Test Everything**: Use the preview server to test all variations

```bash
bun dev
```

## 📚 Next Steps

- Read the full [README.md](./README.md) for detailed documentation
- Check out [React Email Components](https://react.email/docs/components/html)
- Browse [React Email Examples](https://react.email/examples)
- Test your emails across different email clients

## 🆘 Troubleshooting

**Email doesn't show up in preview?**

- Make sure the file is in `emails/` directory
- File must have `.tsx` extension
- Must export default a React component

**Styles not working?**

- Use inline styles only
- Avoid flexbox and grid (limited support)
- Test in multiple email clients

**Can't start dev server?**

- Run `bun install` to ensure dependencies are installed
- Check that port 3000 is not already in use
- Try `bun run dev --port 3001` to use a different port

---

Happy emailing! 📬
