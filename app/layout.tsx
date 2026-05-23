import type { Metadata } from "next";
import { Suspense } from "react";
import localFont from "next/font/local";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Footer } from "./components/Footer";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Brix Morpho Market Simulator",
  description: "Stress-test parameters for the wiTRY → USDM lending market before launch.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-brix-bg text-neutral-200`}
      >
        <Suspense fallback={null}>
          <NuqsAdapter>{children}</NuqsAdapter>
          <Footer />
        </Suspense>
      </body>
    </html>
  );
}
