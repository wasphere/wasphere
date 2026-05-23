"use client"

import { Button } from "@/components/ui/button"
import {
  MESSAGE_TYPE_LABELS,
  TYPE_ROW_1,
  TYPE_ROW_2,
  type MessageType,
} from "@/lib/message-types"
import { cn } from "@/lib/utils"

interface MessageTypeSelectorProps {
  value: MessageType
  onChange: (t: MessageType) => void
}

export function MessageTypeSelector({ value, onChange }: MessageTypeSelectorProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        {TYPE_ROW_1.map((type) => (
          <Button
            key={type}
            type="button"
            size="sm"
            variant={value === type ? "default" : "outline"}
            onClick={() => onChange(type)}
            className={cn("text-xs")}
          >
            {MESSAGE_TYPE_LABELS[type]}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TYPE_ROW_2.map((type) => (
          <Button
            key={type}
            type="button"
            size="sm"
            variant={value === type ? "default" : "outline"}
            onClick={() => onChange(type)}
            className={cn("text-xs")}
          >
            {MESSAGE_TYPE_LABELS[type]}
          </Button>
        ))}
      </div>
    </div>
  )
}
