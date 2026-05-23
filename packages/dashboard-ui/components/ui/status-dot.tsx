export function StatusDot({ status }: { status: string }) {
  let colorClass: string
  let animClass: string

  switch (status) {
    case "connected":
      colorClass = "bg-green-500"
      animClass = "animate-status-connected"
      break
    case "qr_ready":
    case "connecting":
      colorClass = "bg-amber-500"
      animClass = "animate-status-pending"
      break
    default:
      colorClass = "bg-red-500"
      animClass = ""
  }

  return (
    <span
      className={`inline-block shrink-0 rounded-full w-1.5 h-1.5 ${colorClass} ${animClass}`}
      aria-hidden="true"
    />
  )
}
