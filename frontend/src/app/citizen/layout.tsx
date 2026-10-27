import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { CitizenTabsApp } from "@/components/CitizenApp";

import { citizenAppMetadata, citizenAppViewport } from "./appMeta";
import "./citizen-app.css";

export const metadata: Metadata = citizenAppMetadata;
export const viewport: Viewport = citizenAppViewport;

/** The citizen app: Report · My cases · Map, behind the sign-in gate. */
export default function CitizenLayout({ children }: { children: ReactNode }) {
  return <CitizenTabsApp>{children}</CitizenTabsApp>;
}
