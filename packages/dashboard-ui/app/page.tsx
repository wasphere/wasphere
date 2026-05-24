import { redirect } from "next/navigation"

// Middleware handles the smart routing for "/".
// This component is the fallback if middleware is bypassed.
export default function Home() {
  redirect("/login")
}
