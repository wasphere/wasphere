"use client"

import * as React from "react"
import { toast } from "sonner"
import { Eye, EyeOff, Copy, ExternalLink } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ApiError } from "@/components/ui/api-error"
import { EmptyState } from "@/components/ui/empty-state"

// ─── Types ──────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string
  sessionId?: string | null
  method: string
  path: string
  statusCode: number
  durationMs?: number | null
  timestamp: string
}

interface AuditLogsResponse {
  items: AuditLog[]
  total: number
  page: number
  pageSize: number
}

interface Filters {
  sessionId: string
  from: string
  to: string
  statusCode: string
}

// ─── API Reference Tab ────────────────────────────────────────────────────────

interface ApiReferenceTabProps {
  waServerUrl: string | null
}

function ApiReferenceTab({ waServerUrl }: ApiReferenceTabProps) {
  const [token, setToken] = React.useState<string | null>(null)
  const [revealed, setRevealed] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [fetchError, setFetchError] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false

    async function loadToken() {
      setLoading(true)
      setFetchError(false)
      try {
        const res = await fetch("/api/developer/token")
        if (!res.ok) {
          if (!cancelled) setFetchError(true)
          return
        }
        const data = await res.json()
        if (!cancelled) setToken(data.token ?? null)
      } catch {
        if (!cancelled) setFetchError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadToken()

    return () => {
      cancelled = true
    }
  }, [])

  const handleCopy = async () => {
    if (!token) return
    try {
      await navigator.clipboard.writeText(token)
      toast.success("Token copied.")
    } catch {
      toast.error("Failed to copy token.")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* WA Server URL */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-foreground">WA Server URL</Label>
        {waServerUrl ? (
          <div className="flex items-center gap-2">
            <Input value={waServerUrl} readOnly className="font-mono text-sm placeholder:text-zinc-400 placeholder:font-light" />
            <a
              href={`${waServerUrl}/api/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ExternalLink className="size-3.5" />
              View API Docs
            </a>
          </div>
        ) : (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">Not configured</p>
        )}
      </div>

      {/* API Token */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-foreground">API Token</Label>
        {loading ? (
          <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
        ) : fetchError ? (
          <ApiError message="Could not load token." />
        ) : token === null ? (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            No token configured. Set one in{" "}
            <a
              href="/dashboard/settings"
              className="font-medium underline underline-offset-2"
            >
              Settings
            </a>
            .
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              value={revealed ? token : "••••••••••••"}
              readOnly
              className="font-mono text-sm placeholder:text-zinc-400 placeholder:font-light"
              aria-label="API token"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? "Hide token" : "Show token"}
            >
              {revealed ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              aria-label="Copy token"
            >
              <Copy className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Audit Log Tab ────────────────────────────────────────────────────────────

function AuditLogTab() {
  const [page, setPage] = React.useState(1)
  const pageSize = 50

  const [pendingFilters, setPendingFilters] = React.useState<Filters>({
    sessionId: "",
    from: "",
    to: "",
    statusCode: "",
  })
  const [appliedFilters, setAppliedFilters] = React.useState<Filters>({
    sessionId: "",
    from: "",
    to: "",
    statusCode: "",
  })

  const [items, setItems] = React.useState<AuditLog[]>([])
  const [total, setTotal] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Guard against overlapping fetches.
  const isFetchingRef = React.useRef(false)

  const fetchLogs = React.useCallback(
    async (currentPage: number, filters: Filters) => {
      if (isFetchingRef.current) return
      isFetchingRef.current = true
      setIsLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        params.set("page", String(currentPage))
        params.set("pageSize", String(pageSize))
        if (filters.sessionId) params.set("sessionId", filters.sessionId)
        if (filters.from) params.set("from", filters.from)
        if (filters.to) params.set("to", filters.to)
        if (filters.statusCode) params.set("statusCode", filters.statusCode)

        const res = await fetch(`/api/developer/audit-logs?${params.toString()}`)
        if (!res.ok) {
          setError("Could not load audit logs.")
          return
        }
        const data: AuditLogsResponse = await res.json()
        setItems(data.items ?? [])
        setTotal(data.total ?? 0)
      } catch {
        setError("Could not load audit logs.")
      } finally {
        setIsLoading(false)
        isFetchingRef.current = false
      }
    },
    [pageSize]
  )

  // Fetch on mount and whenever page or applied filters change.
  React.useEffect(() => {
    fetchLogs(page, appliedFilters)
  }, [page, appliedFilters, fetchLogs])

  const handleApply = () => {
    setPage(1)
    setAppliedFilters({ ...pendingFilters })
  }

  const hasNextPage = page * pageSize < total

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="al-session" className="text-sm font-medium text-foreground">Session ID</Label>
          <Input
            id="al-session"
            placeholder="session-id"
            value={pendingFilters.sessionId}
            onChange={(e) =>
              setPendingFilters((f) => ({ ...f, sessionId: e.target.value }))
            }
            className="w-40 placeholder:text-zinc-400 placeholder:font-light"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="al-status" className="text-sm font-medium text-foreground">Status Code</Label>
          <Input
            id="al-status"
            placeholder="200"
            value={pendingFilters.statusCode}
            onChange={(e) =>
              setPendingFilters((f) => ({ ...f, statusCode: e.target.value }))
            }
            className="w-24 placeholder:text-zinc-400 placeholder:font-light"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="al-from" className="text-sm font-medium text-foreground">From</Label>
          <Input
            id="al-from"
            type="datetime-local"
            value={pendingFilters.from}
            onChange={(e) =>
              setPendingFilters((f) => ({ ...f, from: e.target.value }))
            }
            className="w-52 placeholder:text-zinc-400 placeholder:font-light"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="al-to" className="text-sm font-medium text-foreground">To</Label>
          <Input
            id="al-to"
            type="datetime-local"
            value={pendingFilters.to}
            onChange={(e) =>
              setPendingFilters((f) => ({ ...f, to: e.target.value }))
            }
            className="w-52 placeholder:text-zinc-400 placeholder:font-light"
          />
        </div>

        <Button variant="outline" onClick={handleApply}>
          Apply
        </Button>
      </div>

      {/* Table */}
      {error ? (
        <ApiError
          message="Could not load audit logs."
          onRetry={() => fetchLogs(page, appliedFilters)}
        />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState message="No audit log entries." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Timestamp</TableHead>
              <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Session ID</TableHead>
              <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Method</TableHead>
              <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Path</TableHead>
              <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Duration (ms)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-xs text-zinc-400 font-light tabular-nums">
                  {new Date(log.timestamp).toLocaleString()}
                </TableCell>
                <TableCell className="font-mono text-sm text-zinc-700 dark:text-zinc-300">
                  {log.sessionId ?? "—"}
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {log.method}
                  </span>
                </TableCell>
                <TableCell className="max-w-xs truncate font-mono text-sm text-zinc-700 dark:text-zinc-300">
                  {log.path}
                </TableCell>
                <TableCell>
                  <span
                    className={
                      log.statusCode >= 500
                        ? "font-medium text-destructive"
                        : log.statusCode >= 400
                          ? "font-medium text-amber-600 dark:text-amber-400"
                          : "font-medium text-green-600 dark:text-green-400"
                    }
                  >
                    {log.statusCode}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-zinc-700 dark:text-zinc-300 tabular-nums">
                  {log.durationMs ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Pagination */}
      {!error && !isLoading && items.length > 0 && (
        <div className="flex items-center justify-between text-sm text-zinc-700 dark:text-zinc-300">
          <span>
            Page {page} — {total} total
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNextPage}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Developer Panel ──────────────────────────────────────────────────────────

interface DeveloperPanelProps {
  waServerUrl: string | null
}

export function DeveloperPanel({ waServerUrl }: DeveloperPanelProps) {
  const [activeTab, setActiveTab] = React.useState<"api-reference" | "audit-log">(
    "api-reference"
  )

  return (
    <Tabs
      value={activeTab}
      onValueChange={(val) =>
        setActiveTab(val as "api-reference" | "audit-log")
      }
    >
      <TabsList>
        <TabsTrigger value="api-reference">API Reference</TabsTrigger>
        <TabsTrigger value="audit-log">Audit Log</TabsTrigger>
      </TabsList>

      <TabsContent value="api-reference" className="mt-4">
        <ApiReferenceTab waServerUrl={waServerUrl} />
      </TabsContent>

      <TabsContent value="audit-log" className="mt-4">
        <AuditLogTab />
      </TabsContent>
    </Tabs>
  )
}
