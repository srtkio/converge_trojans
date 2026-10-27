import type { Metadata, Viewport } from "next";

// Shared by the citizen and track layouts: the installable-app manifest, the iOS home-screen
// settings and the status bar colour. Only these two layouts link the manifest, so the landing
// page and /operator are not installable.
export const citizenAppMetadata: Metadata = {
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "CONVERGE", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

// Static on purpose: with cacheComponents a generated viewport would block the page.
export const citizenAppViewport: Viewport = {
  themeColor: "#047857",
  viewportFit: "cover",
};
