type LayoutProps = {
  title: string;
  description?: string;
  children: unknown;
};

export function Layout({ title, description, children }: LayoutProps) {
  const currentYear = new Date().getFullYear();

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta content="width=device-width, initial-scale=1.0" name="viewport" />
        {description ? <meta content={description} name="description" /> : null}
        <title>{title} - News Spend</title>
      </head>
      <body>
        {children}
        <footer style="text-align: center; padding: 20px; font-size: 14px; color: #6c757d; margin-top: 40px;">
          <p>© {currentYear} News Spend. All rights reserved.</p>
        </footer>
      </body>
    </html>
  );
}
