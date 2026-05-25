export function SessionsIllustration() {
  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-20 h-20 text-muted-foreground/30"
      aria-hidden="true"
    >
      {/* Phone body */}
      <rect x="20" y="8" width="40" height="64" rx="6" stroke="currentColor" strokeWidth="1.5" />
      {/* Screen */}
      <rect x="24" y="17" width="32" height="44" rx="2" fill="currentColor" opacity="0.08" />
      {/* Pill notch */}
      <rect x="32" y="11" width="16" height="3" rx="1.5" fill="currentColor" opacity="0.3" />
      {/* Home bar */}
      <rect x="32" y="66" width="16" height="2" rx="1" fill="currentColor" opacity="0.3" />
      {/* Sent bubble — mint */}
      <rect x="38" y="23" width="15" height="8" rx="4" style={{ fill: "var(--primary)", opacity: 0.65 }} />
      {/* Received bubble */}
      <rect x="27" y="35" width="15" height="8" rx="4" fill="currentColor" opacity="0.2" />
      {/* Sent bubble 2 — mint */}
      <rect x="40" y="48" width="13" height="8" rx="4" style={{ fill: "var(--primary)", opacity: 0.45 }} />
      {/* Signal arc 1 */}
      <path d="M66 30 Q72 36 66 42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
      {/* Signal arc 2 */}
      <path d="M69 26 Q78 36 69 46" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.2" />
    </svg>
  )
}
