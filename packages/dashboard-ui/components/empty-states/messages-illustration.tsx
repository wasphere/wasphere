export function MessagesIllustration() {
  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-20 h-20 text-muted-foreground/30"
      aria-hidden="true"
    >
      {/* Received bubble (back, muted) */}
      <rect x="8" y="26" width="38" height="24" rx="10" fill="currentColor" opacity="0.12" />
      <path d="M16 50 L10 58 L24 50" fill="currentColor" opacity="0.12" />
      {/* Received bubble border */}
      <rect x="8" y="26" width="38" height="24" rx="10" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
      {/* Typing dots in received */}
      <circle cx="20" cy="38" r="2.5" fill="currentColor" opacity="0.4" />
      <circle cx="28" cy="38" r="2.5" fill="currentColor" opacity="0.4" />
      <circle cx="36" cy="38" r="2.5" fill="currentColor" opacity="0.4" />
      {/* Sent bubble (front, mint) */}
      <rect x="34" y="18" width="38" height="24" rx="10" style={{ fill: "var(--primary)", opacity: 0.15 }} />
      <path d="M64 42 L70 50 L56 42" style={{ fill: "var(--primary)", opacity: 0.15 }} />
      <rect x="34" y="18" width="38" height="24" rx="10" stroke="currentColor" strokeWidth="1.2" style={{ color: "var(--primary)", opacity: 0.5 }} />
      {/* Double-check in sent */}
      <path d="M45 30 L50 35 L63 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)", opacity: 0.7 }} />
      <path d="M41 30 L46 35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ color: "var(--primary)", opacity: 0.45 }} />
    </svg>
  )
}
