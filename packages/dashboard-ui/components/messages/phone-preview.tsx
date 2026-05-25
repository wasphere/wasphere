"use client"

import {
  AlignLeft, Image as ImageIcon, Video, Music, FileText, Smile, Film,
  MapPin, UserRound, LayoutList, List, BarChart2, Eye,
} from "lucide-react"
import { type MessageType } from "@/lib/message-types"

interface PhonePreviewProps {
  messageType: MessageType
  recipient: string
  previewData: Record<string, unknown>
}

function getAvatar(r: string): string {
  const digits = r.replace(/\D/g, "")
  if (digits.startsWith("92")) return "PK"
  if (digits.startsWith("44")) return "UK"
  if (digits.startsWith("1")) return "US"
  if (digits.startsWith("91")) return "IN"
  if (r.length > 2) return r.replace(/\D/g, "").slice(0, 2)
  return "WA"
}

function formatRecipient(r: string): string {
  if (!r || r === "+" || r.length < 3) return "+1 234 567 8901"
  if (r.length > 22) return r.slice(0, 22) + "…"
  return r
}

function Bubble({ children }: { children: React.ReactNode }) {
  const now = new Date()
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
  return (
    <div style={{
      background: "#005c4b", color: "#e9edef", fontSize: 13, lineHeight: 1.4,
      borderRadius: "8px 8px 1px 8px", padding: "7px 10px 22px",
      maxWidth: "78%", minWidth: 60, position: "relative", wordBreak: "break-word",
    }}>
      {children}
      <div style={{
        position: "absolute", bottom: 5, right: 8, display: "flex", alignItems: "center",
        gap: 3, color: "rgba(255,255,255,0.55)", fontSize: 10, whiteSpace: "nowrap",
      }}>
        <span>{time}</span>
        <span style={{ fontSize: 13, letterSpacing: -3 }}>✓✓</span>
      </div>
    </div>
  )
}

function MediaPlaceholder({ icon: Icon, height = 90, label }: { icon: React.ElementType; height?: number; label?: string }) {
  return (
    <div style={{
      width: "100%", height, background: "rgba(255,255,255,0.07)", borderRadius: 6,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
    }}>
      <Icon size={22} style={{ color: "#fff", opacity: 0.45 }} />
      {label && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{label}</span>}
    </div>
  )
}

function BubbleContent({ type, data }: { type: MessageType; data: Record<string, unknown> }) {
  const text = (data.text as string) || ""
  const caption = (data.caption as string) || ""
  const placeholder = <span style={{ opacity: 0.35, fontStyle: "italic" }}>Your message…</span>

  switch (type) {
    case "text":
      return <span style={{ whiteSpace: "pre-wrap" }}>{text || placeholder}</span>

    case "image":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <MediaPlaceholder icon={ImageIcon} label="Image" />
          {caption && <span style={{ fontSize: 12 }}>{caption}</span>}
        </div>
      )

    case "video":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{
            width: "100%", height: 90, background: "rgba(255,255,255,0.07)", borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
          }}>
            <Video size={22} style={{ color: "#fff", opacity: 0.45 }} />
            <div style={{
              position: "absolute", width: 28, height: 28, borderRadius: "50%",
              background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderLeft: "9px solid white", marginLeft: 2 }} />
            </div>
          </div>
          {caption && <span style={{ fontSize: 12 }}>{caption}</span>}
        </div>
      )

    case "audio":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: 4 }}>
          <Music size={15} style={{ color: "#fff", opacity: 0.6, flexShrink: 0 }} />
          <div style={{ display: "flex", gap: 2, alignItems: "flex-end" }}>
            {[4, 8, 6, 12, 8, 5, 9, 6, 11, 7, 4, 8].map((h, i) => (
              <div key={i} style={{ width: 2, height: h, background: "rgba(255,255,255,0.45)", borderRadius: 2 }} />
            ))}
          </div>
          <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 2 }}>0:04</span>
        </div>
      )

    case "document":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 4, background: "rgba(255,255,255,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <FileText size={16} style={{ color: "#fff", opacity: 0.75 }} />
          </div>
          <div>
            <div style={{ fontSize: 12 }}>document.pdf</div>
            <div style={{ fontSize: 10, opacity: 0.45 }}>PDF · ~1 MB</div>
          </div>
        </div>
      )

    case "sticker":
      return (
        <div style={{
          width: 72, height: 72, background: "rgba(255,255,255,0.05)", borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Smile size={30} style={{ opacity: 0.35, color: "#fff" }} />
        </div>
      )

    case "gif":
      return (
        <div style={{
          width: "100%", height: 72, background: "rgba(255,255,255,0.07)", borderRadius: 6,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <Film size={16} style={{ color: "#fff", opacity: 0.5 }} />
          <span style={{ fontWeight: 700, fontSize: 13, opacity: 0.5, color: "#fff", letterSpacing: 1 }}>GIF</span>
        </div>
      )

    case "location":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{
            width: "100%", height: 72, background: "#1c2b1f", borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <MapPin size={22} style={{ color: "#25D366" }} />
          </div>
          <div style={{ fontSize: 11, opacity: 0.65 }}>Location shared</div>
        </div>
      )

    case "contact":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%", background: "#3b5166",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <UserRound size={16} style={{ color: "#fff" }} />
          </div>
          <div>
            <div style={{ fontSize: 13 }}>Contact</div>
            <div style={{ fontSize: 10, opacity: 0.5 }}>WhatsApp User</div>
          </div>
        </div>
      )

    case "buttons":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ whiteSpace: "pre-wrap", paddingBottom: 5 }}>{text || placeholder}</span>
          {["Option A", "Option B", "Option C"].map((btn, i) => (
            <div key={i} style={{
              borderTop: "0.5px solid rgba(255,255,255,0.12)", paddingTop: 4,
              color: "#53bdeb", fontSize: 12, textAlign: "center", display: "flex",
              alignItems: "center", justifyContent: "center", gap: 4,
            }}>
              <LayoutList size={10} />
              {btn}
            </div>
          ))}
        </div>
      )

    case "list":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ whiteSpace: "pre-wrap" }}>{text || placeholder}</span>
          <div style={{
            borderTop: "0.5px solid rgba(255,255,255,0.12)", paddingTop: 5,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            color: "#53bdeb", fontSize: 12,
          }}>
            <List size={11} /> View list
          </div>
        </div>
      )

    case "poll":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <BarChart2 size={13} style={{ opacity: 0.7, color: "#fff" }} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>Poll</span>
          </div>
          {["Option 1", "Option 2", "Option 3"].map((o, i) => (
            <div key={i} style={{
              background: "rgba(255,255,255,0.07)", borderRadius: 4, padding: "3px 8px", fontSize: 12,
            }}>{o}</div>
          ))}
        </div>
      )

    case "reaction":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 22 }}>👍</span>
          <span style={{ fontSize: 11, opacity: 0.55 }}>Reaction sent</span>
        </div>
      )

    case "view-once":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Eye size={16} style={{ opacity: 0.6, color: "#fff" }} />
          <div>
            <div style={{ fontSize: 12 }}>View Once</div>
            <div style={{ fontSize: 10, opacity: 0.45 }}>Opens once, then disappears</div>
          </div>
        </div>
      )

    default:
      return <span style={{ opacity: 0.35 }}>Preview not available</span>
  }
}

export function PhonePreview({ messageType, recipient, previewData }: PhonePreviewProps) {
  const avatar = getAvatar(recipient)
  const displayRecipient = formatRecipient(recipient)

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--muted)" }}>
      {/* Strip header */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          Live Preview
        </span>
        <span className="text-[10px] text-muted-foreground/35">updates as you type</span>
      </div>

      {/* Phone frame */}
      <div style={{ background: "#0b141a", margin: "0 8px 8px", borderRadius: 8, overflow: "hidden" }}>
        {/* WhatsApp top bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
          borderBottom: "0.5px solid rgba(255,255,255,0.07)", background: "#1f2c34",
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%", background: "#054640", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 9, fontWeight: 700,
          }}>
            {avatar}
          </div>
          <div>
            <div style={{ color: "#e9edef", fontSize: 12, fontWeight: 500, lineHeight: 1.2 }}>
              {displayRecipient}
            </div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>online</div>
          </div>
        </div>

        {/* Chat area */}
        <div style={{
          minHeight: 110, padding: "10px 8px", display: "flex", flexDirection: "column",
          alignItems: "flex-end",
        }}>
          <Bubble>
            <BubbleContent type={messageType} data={previewData} />
          </Bubble>
        </div>
      </div>
    </div>
  )
}
