import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare } from "lucide-react";

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

          <form className="mt-8 flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
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
              />
            </div>

            <Button type="submit" className="w-full mt-1">
              Sign in
            </Button>
          </form>

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

        {/* Center quote */}
        <div className="flex flex-col gap-6">
          <blockquote className="text-3xl font-medium leading-snug tracking-tight text-white">
            &ldquo;Send, receive, and automate WhatsApp at scale — without giving up your data or your infrastructure.&rdquo;
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary font-semibold text-sm">
              W
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">Waqas Ahmed Waseer</span>
              <span className="text-xs text-white/40">Founder, WaSphere</span>
            </div>
          </div>
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
