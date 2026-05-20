import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { YT_HOST_ID } from "@/lib/constants";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Shirimim — daily music guessing game",
  description: "Guess the daily song from just a few seconds of audio.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="min-h-dvh antialiased">
        {children}
        {/* Permanent off-screen host for the YouTube IFrame player. It must
            never unmount: the YT API mutates the nodes inside it, and a React
            unmount of a YT-mutated node crashes the reconciler. */}
        <div
          id={YT_HOST_ID}
          aria-hidden
          className="pointer-events-none fixed top-0 left-[-9999px] h-[200px] w-[200px] overflow-hidden"
        />
      </body>
    </html>
  );
}
