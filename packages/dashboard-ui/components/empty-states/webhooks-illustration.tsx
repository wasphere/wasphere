export function WebhooksIllustration() {
  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-20 h-20 text-muted-foreground/30"
      aria-hidden="true"
    >
      {/* Server block (left) */}
      <rect x="5" y="24" width="22" height="32" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <line x1="5" y1="33" x2="27" y2="33" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <line x1="5" y1="42" x2="27" y2="42" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <circle cx="11" cy="28.5" r="1.8" fill="currentColor" opacity="0.4" />
      <circle cx="11" cy="37.5" r="1.8" fill="currentColor" opacity="0.4" />
      <circle cx="11" cy="46.5" r="1.8" fill="currentColor" opacity="0.4" />
      {/* Endpoint block (right) */}
      <rect x="53" y="24" width="22" height="32" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <rect x="58" y="31" width="12" height="2" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="58" y="38" width="8" height="2" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="58" y="45" width="10" height="2" rx="1" fill="currentColor" opacity="0.3" />
      {/* Flow path + arrow — mint */}
      <path
        d="M29 40 L51 40"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        style={{ color: "var(--primary)", opacity: 0.7 }}
      />
      <path
        d="M46 36 L51 40 L46 44"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: "var(--primary)", opacity: 0.7 }}
      />
      {/* Data packet dots along the path */}
      <circle cx="35" cy="40" r="2" style={{ fill: "var(--primary)", opacity: 0.45 }} />
      <circle cx="40" cy="40" r="2" style={{ fill: "var(--primary)", opacity: 0.65 }} />
    </svg>
  )
}
