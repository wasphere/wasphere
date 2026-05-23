"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface FormProps {
  onSubmit: (body: Record<string, unknown>) => Promise<void>
  submitting: boolean
  onClear?: () => void
}

export function PollForm({ onSubmit, submitting }: FormProps) {
  const [name, setName] = React.useState("")
  const [options, setOptions] = React.useState<string[]>(["", ""])
  const [selectableCount, setSelectableCount] = React.useState("1")
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const fillSample = () => {
    setName("Which WhatsApp feature do you use most?")
    setOptions(["Messaging", "Voice Calls", "Video Calls", "Status Updates"])
    setErrors({})
  }

  const addOption = () => {
    if (options.length < 12) setOptions([...options, ""])
  }

  const removeOption = (index: number) => {
    if (options.length > 2) setOptions(options.filter((_, i) => i !== index))
  }

  const updateOption = (index: number, value: string) => {
    setOptions(options.map((o, i) => (i === index ? value : o)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = "Poll question is required."
    const filledOptions = options.filter((o) => o.trim())
    if (filledOptions.length < 2) errs.options = "At least 2 options are required."
    const count = parseInt(selectableCount, 10)
    if (isNaN(count) || count < 1 || count > 12) {
      errs.selectableCount = "Selectable count must be between 1 and 12."
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    await onSubmit({
      name: name.trim(),
      options: filledOptions.map((o) => o.trim()),
      selectableCount: count,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center justify-between pb-1">
        <span className="text-xs text-muted-foreground">Fill in the fields below</span>
        <Button type="button" size="xs" variant="outline" onClick={fillSample}>
          Fill Sample
        </Button>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="poll-name">Poll Question</Label>
          <span className="text-xs text-muted-foreground">{name.length}/255</span>
        </div>
        <Textarea
          id="poll-name"
          placeholder="What is your favourite colour?"
          value={name}
          maxLength={255}
          onChange={(e) => setName(e.target.value)}
          rows={2}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Label>Options ({options.length}/12)</Label>
        {errors.options && (
          <p className="text-xs text-destructive">{errors.options}</p>
        )}
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              placeholder={`Option ${i + 1}`}
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              size="icon-sm"
              variant="destructive"
              onClick={() => removeOption(i)}
              disabled={options.length <= 2}
            >
              x
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addOption}
          disabled={options.length >= 12}
          className="w-fit"
        >
          + Add Option
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="poll-count">Selectable Count</Label>
        <Input
          id="poll-count"
          type="number"
          min={1}
          max={12}
          value={selectableCount}
          onChange={(e) => setSelectableCount(e.target.value)}
          className="w-24"
        />
        {errors.selectableCount && (
          <p className="text-xs text-destructive">{errors.selectableCount}</p>
        )}
        <p className="text-xs text-muted-foreground">
          How many options a recipient can select
        </p>
      </div>

      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? "Sending…" : "Send Message"}
      </Button>
    </form>
  )
}
