"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface RecipientInputProps {
  value: string
  onChange: (v: string) => void
  error?: string
}

export function RecipientInput({ value, onChange, error }: RecipientInputProps) {
  const [recipientType, setRecipientType] = React.useState<"personal" | "group">(
    "personal"
  )

  return (
    <div className="flex flex-col gap-1.5">
      <Label>Recipient</Label>
      <div className="flex gap-1 p-0.5 bg-muted rounded-lg w-fit">
        <Button
          type="button"
          size="sm"
          variant={recipientType === "personal" ? "default" : "ghost"}
          onClick={() => setRecipientType("personal")}
          className="text-xs"
        >
          Personal
        </Button>
        <Button
          type="button"
          size="sm"
          variant={recipientType === "group" ? "default" : "ghost"}
          onClick={() => setRecipientType("group")}
          className="text-xs"
        >
          Group
        </Button>
      </div>
      <Input
        placeholder={
          recipientType === "personal"
            ? "+923XXXXXXXXX or 923XXXXXXXXX@s.whatsapp.net"
            : "XXXXXXXXXX-XXXXXXXXXX@g.us"
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(error && "border-destructive")}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
