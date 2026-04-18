import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WikiCheck — Wikipedia Citation Verifier",
  description: "Verify Wikipedia article citations using AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased bg-[#fbfbfd] overscroll-none`}
    >
      <body className="h-full flex flex-col bg-[#fbfbfd] text-[#1d1d1f] overscroll-none">{children}</body>
    </html>
  );
}
