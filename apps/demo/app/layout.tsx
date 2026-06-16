import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "chat-mentions/styles";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Chat Mentions Demo",
  description: "Lightweight mentions system for shadcn + Tailwind",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
