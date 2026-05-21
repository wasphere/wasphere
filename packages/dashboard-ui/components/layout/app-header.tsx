"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, HelpCircle, Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b bg-background px-3 gap-2">
      {/* Left — trigger + logo + badge */}
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1 h-7 w-7" />
        <span className="text-muted-foreground/40 text-sm select-none">/</span>
        <span className="text-sm font-medium">WaSphere</span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 rounded-sm font-medium">
          v1.0
        </Badge>
      </div>

      {/* Right — search + help + avatar */}
      <div className="flex items-center gap-1">
        {/* Search */}
        <button className="flex items-center gap-2 rounded-md border border-input bg-background px-2.5 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors h-7 min-w-[140px]">
          <Search size={13} />
          <span className="text-xs flex-1 text-left">Search…</span>
          <kbd className="hidden sm:inline-flex h-4 select-none items-center gap-0.5 rounded border border-border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </button>

        {/* Help */}
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
          <HelpCircle size={15} className="text-muted-foreground" />
        </Button>

        {/* User avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Avatar className="h-7 w-7 cursor-pointer ring-2 ring-transparent hover:ring-primary/30 transition-all">
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                WA
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5 pb-2">
              <span className="font-semibold text-sm">Waqas Ahmed Waseer</span>
              <span className="text-xs text-muted-foreground font-normal">
                waqasahmadwaseer@gmail.com
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Account preferences</DropdownMenuItem>
            <DropdownMenuItem>Changelog</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal pb-1">
              Theme
            </DropdownMenuLabel>
            <DropdownMenuItem className="gap-2">
              <Sun size={14} /> Light
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <Moon size={14} /> Dark
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <Monitor size={14} /> System
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
