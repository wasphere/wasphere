"use client"

import {
  AlignLeft,
  Image,
  Video,
  Music,
  FileText,
  Smile,
  Film,
  MapPin,
  UserRound,
  LayoutList,
  List,
  BarChart2,
  Heart,
  Eye,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { type MessageType } from "@/lib/message-types"

const BASIC_TYPES: { type: MessageType; icon: React.ElementType; label: string }[] = [
  { type: "text", icon: AlignLeft, label: "Text" },
  { type: "image", icon: Image, label: "Image" },
  { type: "video", icon: Video, label: "Video" },
  { type: "audio", icon: Music, label: "Audio" },
  { type: "document", icon: FileText, label: "Document" },
  { type: "sticker", icon: Smile, label: "Sticker" },
  { type: "gif", icon: Film, label: "GIF" },
]

const INTERACTIVE_TYPES: { type: MessageType; icon: React.ElementType; label: string }[] = [
  { type: "location", icon: MapPin, label: "Location" },
  { type: "contact", icon: UserRound, label: "Contact" },
  { type: "buttons", icon: LayoutList, label: "Buttons" },
  { type: "list", icon: List, label: "List" },
  { type: "poll", icon: BarChart2, label: "Poll" },
  { type: "reaction", icon: Heart, label: "Reaction" },
  { type: "view-once", icon: Eye, label: "View Once" },
]

interface MessageTypeSelectorProps {
  value: MessageType
  onChange: (t: MessageType) => void
}

function TypePill({
  type,
  icon: Icon,
  label,
  active,
  onClick,
}: {
  type: MessageType
  icon: React.ElementType
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer select-none",
        active
          ? "bg-primary/10 text-primary border-primary/30 dark:bg-primary/15 dark:border-primary/40"
          : "bg-transparent text-muted-foreground border-border hover:bg-muted hover:text-foreground hover:border-muted-foreground/20"
      )}
    >
      <Icon size={13} className="shrink-0" />
      {label}
    </button>
  )
}

export function MessageTypeSelector({ value, onChange }: MessageTypeSelectorProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5">
        {BASIC_TYPES.map(({ type, icon, label }) => (
          <TypePill
            key={type}
            type={type}
            icon={icon}
            label={label}
            active={value === type}
            onClick={() => onChange(type)}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 shrink-0">
          Interactive
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {INTERACTIVE_TYPES.map(({ type, icon, label }) => (
          <TypePill
            key={type}
            type={type}
            icon={icon}
            label={label}
            active={value === type}
            onClick={() => onChange(type)}
          />
        ))}
      </div>
    </div>
  )
}
