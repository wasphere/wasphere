"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Smartphone,
  MessageSquare,
  Webhook,
  Code,
  Settings,
  Send,
  Workflow,
  Users,
  Sparkles,
  Plug,
  Lock,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const NAV_ITEMS = [
  { label: "Overview", href: "/dashboard/overview", icon: LayoutDashboard },
  { label: "Sessions", href: "/dashboard/sessions", icon: Smartphone },
  { label: "Messages", href: "/dashboard/messages", icon: MessageSquare },
  { label: "Webhooks", href: "/dashboard/webhooks", icon: Webhook },
  { label: "Developer", href: "/dashboard/developer", icon: Code },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

const PRO_ITEMS = [
  { label: "Campaigns", icon: Send },
  { label: "Automations", icon: Workflow },
  { label: "CRM & Inbox", icon: Users },
  { label: "AI Replies", icon: Sparkles },
  { label: "WHMCS", icon: Plug },
];

function NavItem({
  label,
  href,
  icon: Icon,
  active,
  collapsed,
}: {
  label: string;
  href: string;
  icon: React.ElementType;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link href={href} />}
        isActive={active}
        tooltip={label}
        className={
          collapsed
            ? "flex-col justify-center gap-1 h-auto py-2"
            : "flex-row gap-2"
        }
      >
        <Icon className="shrink-0" size={18} />
        <span
          className={
            collapsed
              ? "text-[10px] text-center leading-none"
              : "text-sm leading-none"
          }
        >
          {label}
        </span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-3">
        {collapsed ? (
          <span className="text-primary font-bold text-lg flex justify-center">W</span>
        ) : (
          <span className="text-primary font-bold text-lg tracking-tight">WaSphere</span>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(({ label, href, icon }) => {
                const active =
                  pathname === href || pathname.startsWith(href + "/");
                return (
                  <NavItem
                    key={href}
                    label={label}
                    href={href}
                    icon={icon}
                    active={active}
                    collapsed={collapsed}
                  />
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-muted-foreground/60 text-xs uppercase tracking-wider px-2 mb-1">
              Coming in Pro
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {PRO_ITEMS.map(({ label, icon: Icon }) => (
                <SidebarMenuItem key={label}>
                  <Tooltip>
                    <TooltipTrigger
                      className="w-full"
                      render={
                        <SidebarMenuButton
                          disabled
                          className={[
                            "opacity-40 cursor-not-allowed",
                            collapsed
                              ? "flex-col justify-center gap-1 h-auto py-2"
                              : "flex-row gap-2",
                          ].join(" ")}
                        />
                      }
                    >
                      <Icon className="shrink-0" size={18} />
                      <span
                        className={
                          collapsed
                            ? "text-[10px] text-center leading-none"
                            : "text-sm leading-none flex-1"
                        }
                      >
                        {label}
                      </span>
                      {!collapsed && <Lock size={12} className="shrink-0 ml-auto" />}
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      Available in Pro v2.0
                    </TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter />
    </Sidebar>
  );
}
