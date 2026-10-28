import type { CSSProperties, ReactNode } from "react";

// The operator console is dark; the other pages stay light until they are redesigned.
const DARK = {
  colorScheme: "dark",
  "--background": "#070a12",
  "--foreground": "#e6e9f2",
} as CSSProperties;

export default function OperatorLayout({ children }: { children: ReactNode }) {
  return (
    <div style={DARK} className="min-h-dvh bg-background text-foreground">
      {children}
    </div>
  );
}
