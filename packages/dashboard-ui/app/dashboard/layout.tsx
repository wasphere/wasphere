import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { AuthProvider } from "@/components/auth/auth-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side guard: if no access cookie, send to login before any render.
  const cookieStore = await cookies();
  const hasAccess = cookieStore.has("wa_access");
  if (!hasAccess) {
    redirect("/login?reason=expired");
  }

  return (
    <AuthProvider>
      <SidebarProvider>
        <AppSidebar />
        <div className="flex flex-col flex-1 min-h-screen overflow-hidden">
          <AppHeader />
          <main className="flex flex-1 flex-col gap-4 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </SidebarProvider>
    </AuthProvider>
  );
}
