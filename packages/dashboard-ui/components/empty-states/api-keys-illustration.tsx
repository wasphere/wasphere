export function ApiKeysIllustration() {
  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-20 h-20 text-muted-foreground/30"
      aria-hidden="true"
    >
      {/* Key head circle */}
      <circle cx="28" cy="38" r="16" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="28" cy="38" r="8" style={{ fill: "var(--primary)", opacity: 0.12 }} />
      <circle cx="28" cy="38" r="8" stroke="currentColor" strokeWidth="1.2" style={{ color: "var(--primary)", opacity: 0.5 }} />
      {/* Key shaft */}
      <path
        d="M40 38 L68 38"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        style={{ color: "var(--primary)", opacity: 0.55 }}
      />
      {/* Key teeth */}
      <path
        d="M56 38 L56 44 M62 38 L62 46"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ color: "var(--primary)", opacity: 0.55 }}
      />
      {/* Inner key dot */}
      <circle cx="28" cy="38" r="3" style={{ fill: "var(--primary)", opacity: 0.5 }} />
    </svg>
  )
}
