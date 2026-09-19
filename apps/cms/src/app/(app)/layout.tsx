import type { Metadata } from "next";
import type { FC, PropsWithChildren, ReactNode } from "react";

import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description: "News Spend Media",
  title: {
    default: "",
    template: "%s | News Spend Media",
  },
};

export type RootLayoutProps = PropsWithChildren<{
  footer?: ReactNode;
  head?: ReactNode;
  header?: ReactNode;
}>;

const Root: FC<RootLayoutProps> = ({ children, footer, head, header }) => (
  <html className="h-screen" lang="en">
    <head>{head}</head>
    <body className="flex min-h-screen flex-col bg-gray-300">
      {header}
      {children}
      {footer}
    </body>
  </html>
);

export default Root;
