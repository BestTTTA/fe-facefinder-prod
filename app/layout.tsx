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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const TITLE = "FaceFinder — Face Recognition API";
const DESCRIPTION =
  "Register faces, search a face and get the matching person back in milliseconds. Multi-tenant Face Recognition API with API keys, quotas and usage tracking.";

export const metadata: Metadata = {
  // Absolute base for og:image / canonical URLs; set NEXT_PUBLIC_SITE_URL in production.
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s — FaceFinder",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "FaceFinder",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: browser extensions inject attributes on <body> before hydration */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
