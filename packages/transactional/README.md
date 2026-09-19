# @news-spend-media/transactional

Email templates for News Spend Media using React Email.

## 📚 Available Templates

- **email.tsx** - Simple example email with a button
- **welcome.tsx** - Welcome email for new users
- **password-reset.tsx** - Password reset request email
- **notification.tsx** - General notification email with customizable content

## 🚀 Getting Started

### Development

Start the email preview server:

```sh
# From the root of the monorepo
bun run dev:email

# Or directly from this package
cd packages/transactional
bun dev
```

Then visit [http://localhost:3000](http://localhost:3000) to preview your emails in real-time.

## 📝 Creating New Email Templates

Create a new `.tsx` file in the `emails/` directory:

```tsx
import { Body, Button, Head, Html } from "@react-email/components";

type YourEmailProps = {
  name?: string;
  // Add more props as needed
};

export default function YourEmail({ name = "User" }: YourEmailProps) {
  return (
    <Html>
      <Head />
      <Body>
        <h1>Hello {name}!</h1>
        <Button href="https://example.com">Click me</Button>
      </Body>
    </Html>
  );
}
```

The email will automatically appear in the preview server.

## 🔧 Using Email Templates in Your Application

### Rendering Emails to HTML

```ts
import { render } from "@react-email/components";
import WelcomeEmail from "@news-spend-media/transactional/emails/welcome";

// Render to HTML string
const html = await render(WelcomeEmail({ name: "John Doe" }));

// Send via your email service
await sendEmail({
  to: "user@example.com",
  subject: "Welcome to News Spend Media",
  html,
});
```

### Rendering Emails to Plain Text

```ts
import { renderAsync } from "@react-email/components";
import WelcomeEmail from "@news-spend-media/transactional/emails/welcome";

const plainText = await renderAsync(WelcomeEmail({ name: "John Doe" }), {
  plainText: true,
});
```

## 📦 Integration Examples

### With Resend

```ts
import { Resend } from "resend";
import WelcomeEmail from "@news-spend-media/transactional/emails/welcome";

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: "noreply@newsspend.com",
  to: "user@example.com",
  subject: "Welcome aboard!",
  react: WelcomeEmail({ name: "John Doe" }),
});
```

### With Nodemailer

```ts
import nodemailer from "nodemailer";
import { render } from "@react-email/components";
import WelcomeEmail from "@news-spend-media/transactional/emails/welcome";

const transporter = nodemailer.createTransport({
  // Your email service config
});

const html = await render(WelcomeEmail({ name: "John Doe" }));

await transporter.sendMail({
  from: "noreply@newsspend.com",
  to: "user@example.com",
  subject: "Welcome aboard!",
  html,
});
```

## 🎨 Styling Best Practices

### Inline Styles

Email clients have limited CSS support. Always use inline styles:

```tsx
const styles = {
  container: {
    backgroundColor: "#ffffff",
    padding: "20px",
    maxWidth: "600px",
  },
  button: {
    backgroundColor: "#000000",
    color: "#ffffff",
    padding: "12px 20px",
    textDecoration: "none",
    borderRadius: "6px",
  },
};

export default function MyEmail() {
  return (
    <Html>
      <Body style={styles.container}>
        <Button style={styles.button}>Click me</Button>
      </Body>
    </Html>
  );
}
```

### TypeScript Type Assertions

For CSS properties that require specific literal types:

```tsx
const style = {
  textAlign: "center" as const,
  display: "block" as const,
};
```

### Component Library

Use React Email components for better email client compatibility:

- `<Html>` - Root wrapper
- `<Head>` - Document head
- `<Preview>` - Preview text (shows in inbox)
- `<Body>` - Email body
- `<Container>` - Centered container
- `<Section>` - Content section
- `<Text>` - Text paragraph
- `<Button>` - Call-to-action button
- `<Heading>` - Heading elements
- `<Hr>` - Horizontal rule
- `<Link>` - Anchor link
- `<Img>` - Image

## 🧪 Testing

Preview all your emails before deploying:

1. Start the dev server: `bun dev`
2. Navigate to http://localhost:3000
3. Click on any email template
4. Test with different props using the preview UI
5. Check responsive design using device preview
6. Send test emails to yourself

## 📖 Documentation

For more information about React Email:

- [React Email Documentation](https://react.email)
- [Component Library](https://react.email/docs/components/html)
- [Examples](https://react.email/examples)

## 🏗️ Project Structure

```
packages/transactional/
├── emails/                # Email templates
│   ├── email.tsx
│   ├── welcome.tsx
│   ├── password-reset.tsx
│   └── notification.tsx
├── package.json
├── tsconfig.json
└── README.md
```

## 💡 Tips

- Keep emails simple and focused
- Test across multiple email clients (Gmail, Outlook, Apple Mail)
- Use web-safe fonts for better compatibility
- Keep email width between 500-600px
- Optimize images and use absolute URLs
- Include alt text for all images
- Use semantic HTML for accessibility
- Test with images disabled
- Include plain text version for better deliverability
