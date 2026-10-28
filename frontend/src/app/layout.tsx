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

const DESCRIPTION =
  "CONVERGE merges duplicate city complaints, finds the shared root cause, sends the right crew and only closes a case when evidence proves the fix. Live pilot: Murthal–Sonipat corridor.";

export const metadata: Metadata = {
  metadataBase: new URL("https://converge-web-ten.vercel.app"),
  title: { default: "CONVERGE · City complaints, closed only when really fixed", template: "%s · CONVERGE" },
  description: DESCRIPTION,
  applicationName: "CONVERGE",
  icons: { icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icons/apple-touch-icon.png" },
  openGraph: {
    type: "website",
    siteName: "CONVERGE",
    title: "CONVERGE · City complaints, closed only when really fixed",
    description: DESCRIPTION,
    url: "/",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "CONVERGE" }],
  },
  twitter: { card: "summary", title: "CONVERGE", description: DESCRIPTION, images: ["/icons/icon-512.png"] },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
