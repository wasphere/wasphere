import { redirect } from "next/navigation"
import { RegisterForm } from "./register-form"

const API_BASE = process.env.DASHBOARD_API_URL ?? "http://localhost:3000"

async function checkAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/register-available`, {
      cache: "no-store",
    })
    if (!res.ok) return false
    const data: { available: boolean } = await res.json()
    return data.available === true
  } catch {
    return false
  }
}

export default async function RegisterPage() {
  const available = await checkAvailable()
  if (!available) redirect("/login?reason=registration_locked")
  return <RegisterForm />
}
