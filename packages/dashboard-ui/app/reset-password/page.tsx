"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare } from "lucide-react";

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <p className="mt-8 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
        This reset link is missing its token. Request a new one from the{" "}
        <Link href="/forgot-password" className="underline">forgot-password page</Link>.
      </p>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "This reset link is invalid or has expired.");
        return;
      }

      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="mt-8 rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
        Your password has been reset. Redirecting you to sign in…
      </div>
    );
  }

  return (
    <form className="mt-8 flex flex-col gap-5" onSubmit={handleSubmit}>
      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      <Button type="submit" className="w-full mt-1" disabled={loading}>
        {loading ? "Resetting…" : "Reset password"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          <MessageSquare className="text-primary" size={22} />
          <span className="text-lg font-bold tracking-tight">WaSphere</span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter a new password for your account.
        </p>

        <Suspense>
          <ResetForm />
        </Suspense>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
