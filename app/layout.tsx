import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Tahadhari - mobile money scam checker",
  description: "Check a suspicious SMS or WhatsApp message in English, Swahili or Sheng."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
