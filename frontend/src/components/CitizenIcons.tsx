// Small line icons for the citizen pages. Decorative only: the text next to them carries the meaning.

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function PinIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`} {...STROKE}>
      <path d="M12 21.5s-7-5.7-7-11.5a7 7 0 0 1 14 0c0 5.8-7 11.5-7 11.5Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

export function CameraIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`} {...STROKE}>
      <path d="M4 7.5h3l1.6-2.5h6.8L17 7.5h3a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18V9A1.5 1.5 0 0 1 4 7.5Z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  );
}
