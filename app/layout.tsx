import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Investment Intelligence OS",
  description: "Agent-ready research OS for evidence, frontier themes, portfolio fit, memos, and decisions."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
