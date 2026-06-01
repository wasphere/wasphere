import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { AuthProvider } from "@/components/auth/auth-provider";
import { DEMO_MODE } from "@/lib/demo";
import { DemoBanner } from "@/components/demo/demo-banner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side guard: if no access cookie, send to login before any render.
  // DEMO_MODE bypasses auth entirely (seeded read-only showcase).
  const cookieStore = await cookies();
  const hasAccess = cookieStore.has("wa_access");
  if (!DEMO_MODE && !hasAccess) {
    redirect("/login?reason=expired");
  }

  return (
    <AuthProvider>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <div className="flex flex-col flex-1 min-h-screen overflow-hidden">
          <AppHeader />
          {DEMO_MODE && <DemoBanner />}
          <main className="flex flex-1 flex-col gap-4 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </SidebarProvider>
    </AuthProvider>
  );
}
