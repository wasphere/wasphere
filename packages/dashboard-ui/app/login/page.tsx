"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare } from "lucide-react";

function SessionNotice() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");

  if (reason === "expired") {
    return (
      <p className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-2.5 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-300">
        Your session has expired. Please log in again.
      </p>
    );
  }

  if (reason === "logout") {
    return (
      <p className="mb-4 rounded-md border border-border bg-muted px-4 py-2.5 text-sm text-muted-foreground">
        You have been logged out.
      </p>
    );
  }

  if (reason === "registration_locked") {
    return (
      <p className="mb-4 rounded-md border border-border bg-muted px-4 py-2.5 text-sm text-muted-foreground">
        Registration is closed for this instance.
      </p>
    );
  }

  return null;
}

function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        setError(body.message ?? "Invalid email or password.");
        return;
      }

      router.push("/dashboard/overview");
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="mt-8 flex flex-col gap-5" onSubmit={handleSubmit}>
      <SessionNotice />

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      <Button type="submit" className="w-full mt-1" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      {/* ── Left panel — form ─────────────────────────────── */}
      <div className="flex w-full flex-col justify-between px-8 py-10 sm:px-12 lg:w-[44%]">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <MessageSquare className="text-primary" size={22} />
          <span className="text-lg font-bold tracking-tight">WaSphere</span>
        </div>

        {/* Form */}
        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your account</p>

          <Suspense>
            <LoginForm />
          </Suspense>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="underline hover:text-primary">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-primary">
            Privacy Policy
          </Link>
          .
        </p>
      </div>

      {/* ── Right panel — dark brand panel ───────────────── */}
      <div className="hidden lg:flex lg:w-[56%] flex-col justify-between bg-[#0a0a0a] px-16 py-16 text-white">
        {/* Top tag */}
        <div className="flex items-center gap-2 text-sm text-white/50">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
          Self-hosted WhatsApp Automation
        </div>

        {/* Center brand copy */}
        <div className="flex flex-col gap-6">
          <blockquote className="text-3xl font-medium leading-snug tracking-tight text-white">
            &ldquo;Self-hosted WhatsApp automation for hosting providers and developers&rdquo;
          </blockquote>
          <p className="text-sm text-white/40">
            WaSphere — Built on Baileys. MIT Core, Pro layer.
          </p>
        </div>

        {/* Bottom stats */}
        <div className="flex gap-10 border-t border-white/10 pt-8">
          {[
            { value: "10×", label: "lighter than whatsapp-web.js" },
            { value: "38", label: "API endpoints out of the box" },
            { value: "100%", label: "self-hosted, your data" },
          ].map(({ value, label }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-2xl font-bold text-primary">{value}</span>
              <span className="text-xs text-white/40">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
