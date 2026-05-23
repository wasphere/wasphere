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

interface ListRow {
  id: string
  title: string
  description: string
}

interface ListSection {
  title: string
  rows: ListRow[]
}

function emptyRow(): ListRow {
  return { id: "", title: "", description: "" }
}

function emptySection(): ListSection {
  return { title: "", rows: [emptyRow()] }
}

export function ListForm({ onSubmit, submitting }: FormProps) {
  const [title, setTitle] = React.useState("")
  const [text, setText] = React.useState("")
  const [buttonText, setButtonText] = React.useState("")
  const [sections, setSections] = React.useState<ListSection[]>([emptySection()])
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const fillSample = () => {
    setTitle("WaSphere Menu")
    setText("Choose an option from the list below:")
    setButtonText("View Options")
    setSections([
      {
        title: "Options",
        rows: [
          { id: "row_1", title: "Send Message", description: "Test sending a message" },
          { id: "row_2", title: "View Sessions", description: "Check connected sessions" },
        ],
      },
    ])
    setErrors({})
  }

  const addSection = () => {
    if (sections.length < 10) setSections([...sections, emptySection()])
  }

  const removeSection = (si: number) => {
    if (sections.length > 1) setSections(sections.filter((_, i) => i !== si))
  }

  const updateSection = (si: number, value: string) => {
    setSections(sections.map((s, i) => (i === si ? { ...s, title: value } : s)))
  }

  const addRow = (si: number) => {
    if (sections[si].rows.length < 10) {
      setSections(
        sections.map((s, i) =>
          i === si ? { ...s, rows: [...s.rows, emptyRow()] } : s
        )
      )
    }
  }

  const removeRow = (si: number, ri: number) => {
    if (sections[si].rows.length > 1) {
      setSections(
        sections.map((s, i) =>
          i === si ? { ...s, rows: s.rows.filter((_, j) => j !== ri) } : s
        )
      )
    }
  }

  const updateRow = (si: number, ri: number, field: keyof ListRow, value: string) => {
    setSections(
      sections.map((s, i) =>
        i === si
          ? {
              ...s,
              rows: s.rows.map((r, j) =>
                j === ri ? { ...r, [field]: value } : r
              ),
            }
          : s
      )
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!title.trim()) errs.title = "Title is required."
    if (!text.trim()) errs.text = "Text is required."
    if (!buttonText.trim()) errs.buttonText = "Button text is required."
    sections.forEach((s, si) => {
      if (!s.title.trim()) errs[`sec_title_${si}`] = "Section title is required."
      s.rows.forEach((r, ri) => {
        if (!r.id.trim()) errs[`row_id_${si}_${ri}`] = "Row ID is required."
        if (!r.title.trim()) errs[`row_title_${si}_${ri}`] = "Row title is required."
      })
    })
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    await onSubmit({
      title: title.trim(),
      text: text.trim(),
      buttonText: buttonText.trim(),
      sections: sections.map((s) => ({
        title: s.title.trim(),
        rows: s.rows.map((r) => ({
          id: r.id.trim(),
          title: r.title.trim(),
          ...(r.description.trim() ? { description: r.description.trim() } : {}),
        })),
      })),
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
      <div className="rounded-lg border border-amber-400/40 bg-amber-50/60 dark:bg-amber-900/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
        WhatsApp has deprecated interactive list messages for personal accounts. Recipients on newer WhatsApp versions may see plain text instead.
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="list-title">Title</Label>
          <span className="text-xs text-muted-foreground">{title.length}/60</span>
        </div>
        <Input
          id="list-title"
          placeholder="Menu title"
          value={title}
          maxLength={60}
          onChange={(e) => setTitle(e.target.value)}
        />
        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="list-text">Text</Label>
          <span className="text-xs text-muted-foreground">{text.length}/1024</span>
        </div>
        <Textarea
          id="list-text"
          placeholder="Body message…"
          value={text}
          maxLength={1024}
          onChange={(e) => setText(e.target.value)}
          rows={3}
        />
        {errors.text && <p className="text-xs text-destructive">{errors.text}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="list-btntext">Button Text</Label>
          <span className="text-xs text-muted-foreground">{buttonText.length}/20</span>
        </div>
        <Input
          id="list-btntext"
          placeholder="View Options"
          value={buttonText}
          maxLength={20}
          onChange={(e) => setButtonText(e.target.value)}
        />
        {errors.buttonText && (
          <p className="text-xs text-destructive">{errors.buttonText}</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <Label>Sections ({sections.length}/10)</Label>
        {sections.map((section, si) => (
          <div key={si} className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Section {si + 1}
              </span>
              {sections.length > 1 && (
                <Button
                  type="button"
                  size="xs"
                  variant="destructive"
                  onClick={() => removeSection(si)}
                >
                  Remove
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`sec-title-${si}`} className="text-xs">
                Section Title
              </Label>
              <Input
                id={`sec-title-${si}`}
                placeholder="Section name"
                value={section.title}
                maxLength={24}
                onChange={(e) => updateSection(si, e.target.value)}
              />
              {errors[`sec_title_${si}`] && (
                <p className="text-xs text-destructive">
                  {errors[`sec_title_${si}`]}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 pl-2 border-l-2 border-muted">
              <span className="text-xs text-muted-foreground font-medium">
                Rows ({section.rows.length}/10)
              </span>
              {section.rows.map((row, ri) => (
                <div key={ri} className="flex flex-col gap-2 rounded-md bg-muted/30 p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Row {ri + 1}</span>
                    {section.rows.length > 1 && (
                      <Button
                        type="button"
                        size="xs"
                        variant="destructive"
                        onClick={() => removeRow(si, ri)}
                      >
                        x
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`row-id-${si}-${ri}`} className="text-xs">
                        ID
                      </Label>
                      <Input
                        id={`row-id-${si}-${ri}`}
                        placeholder="row_1"
                        value={row.id}
                        onChange={(e) => updateRow(si, ri, "id", e.target.value)}
                      />
                      {errors[`row_id_${si}_${ri}`] && (
                        <p className="text-xs text-destructive">
                          {errors[`row_id_${si}_${ri}`]}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`row-title-${si}-${ri}`} className="text-xs">
                        Title
                      </Label>
                      <Input
                        id={`row-title-${si}-${ri}`}
                        placeholder="Option name"
                        value={row.title}
                        maxLength={24}
                        onChange={(e) => updateRow(si, ri, "title", e.target.value)}
                      />
                      {errors[`row_title_${si}_${ri}`] && (
                        <p className="text-xs text-destructive">
                          {errors[`row_title_${si}_${ri}`]}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`row-desc-${si}-${ri}`} className="text-xs">
                      Description{" "}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </Label>
                    <Input
                      id={`row-desc-${si}-${ri}`}
                      placeholder="Optional description"
                      value={row.description}
                      maxLength={72}
                      onChange={(e) => updateRow(si, ri, "description", e.target.value)}
                    />
                  </div>
                </div>
              ))}
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => addRow(si)}
                disabled={section.rows.length >= 10}
                className="w-fit"
              >
                + Add Row
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addSection}
          disabled={sections.length >= 10}
          className="w-fit"
        >
          + Add Section
        </Button>
      </div>

      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? "Sending…" : "Send Message"}
      </Button>
    </form>
  )
}
