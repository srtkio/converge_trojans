import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { CitizenPublicApp } from "@/components/CitizenApp";

import { citizenAppMetadata, citizenAppViewport } from "../citizen/appMeta";
import "../citizen/citizen-app.css";

export const metadata: Metadata = citizenAppMetadata;
export const viewport: Viewport = citizenAppViewport;

/** A case page inside the citizen app. Public: shared links work without signing in. */
export default function TrackLayout({ children }: { children: ReactNode }) {
  return <CitizenPublicApp>{children}</CitizenPublicApp>;
}
