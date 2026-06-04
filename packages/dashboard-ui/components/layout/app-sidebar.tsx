"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Smartphone,
  Inbox,
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
  ExternalLink,
  BookOpen,
  ShieldCheck,
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
  { label: "Inbox", href: "/dashboard/inbox", icon: Inbox },
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
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem className="mb-0.5">
      <SidebarMenuButton
        render={<Link href={href} onClick={() => { if (isMobile) setOpenMobile(false); }} />}
        isActive={active}
        tooltip={label}
        className={[
          collapsed
            ? "flex-col justify-center gap-1 h-auto py-2"
            : "flex-row gap-2",
          // active: dark bg + black/white text, bold
          "data-active:!bg-primary/10 data-active:!text-primary dark:data-active:!bg-primary/15 dark:data-active:!text-primary data-active:!font-semibold",
        ].join(" ")}
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

function ExternalNavItem({
  label,
  href,
  icon: Icon,
  collapsed,
  disabled,
  disabledReason,
}: {
  label: string;
  href: string | null;
  icon: React.ElementType;
  collapsed: boolean;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const inner = (
    <SidebarMenuButton
      disabled={disabled}
      tooltip={disabled ? disabledReason : label}
      className={[
        collapsed ? "flex-col justify-center gap-1 h-auto py-2" : "flex-row gap-2",
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      <Icon className="shrink-0" size={18} />
      <span className={collapsed ? "text-[10px] text-center leading-none" : "text-sm leading-none flex-1"}>
        {label}
      </span>
      {!collapsed && !disabled && <ExternalLink size={12} className="shrink-0 ml-auto opacity-50" />}
    </SidebarMenuButton>
  );

  if (disabled || !href) return <SidebarMenuItem className="mb-0.5">{inner}</SidebarMenuItem>;

  return (
    <SidebarMenuItem className="mb-0.5">
      <a href={href} target="_blank" rel="noopener noreferrer" className="w-full">
        {inner}
      </a>
    </SidebarMenuItem>
  );
}

export function AppSidebar({ demoMode = false }: { demoMode?: boolean }) {
  const pathname = usePathname();
  const { state, setOpen, isMobile } = useSidebar();
  // On mobile the sidebar is a full drawer — never icon-collapse it, and the
  // hover-to-expand behaviour is desktop-only.
  const collapsed = !isMobile && state === "collapsed";

  // In demo mode the local API-docs proxy has no backend, so link to the public
  // hosted docs instead.
  const docsBase = demoMode ? "https://app.wasphere.com" : "";

  return (
    <Sidebar
      collapsible="icon"
      onMouseEnter={isMobile ? undefined : () => setOpen(true)}
      onMouseLeave={isMobile ? undefined : () => setOpen(false)}
    >
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
              API Docs
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              <ExternalNavItem
                label="WhatsApp API"
                href={`${docsBase}/docs/wa-server`}
                icon={BookOpen}
                collapsed={collapsed}
              />
              <ExternalNavItem
                label="Admin API"
                href={`${docsBase}/docs/admin`}
                icon={ShieldCheck}
                collapsed={collapsed}
              />
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
                      <span className="flex items-center gap-1.5">
                        <Lock size={12} />
                        Available in WaSphere Pro — coming soon
                      </span>
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
