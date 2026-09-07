import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { ClipboardList, FileVideo, LayoutDashboard, LogOut, PanelLeft, ShieldCheck } from "lucide-react";
import { CSSProperties, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const SIDEBAR_WIDTH_KEY = "sidebar-width";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(localStorage.getItem(SIDEBAR_WIDTH_KEY)) || 260);
  const { loading, user } = useAuth();
  useEffect(() => localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth)), [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return (
    <div className="min-h-screen grid place-items-center bg-[#f7f8fa] px-6">
      <div className="max-w-md text-center space-y-5">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#192a3a] text-white"><FileVideo className="h-6 w-6" /></div>
        <h1 className="text-3xl font-semibold tracking-tight text-[#192a3a]">Your production workspace</h1>
        <p className="text-muted-foreground">Sign in to access assigned capture tasks, uploads, and review feedback.</p>
        <Button onClick={() => startLogin()} className="rounded-full bg-[#d65d3e] px-7 hover:bg-[#b94b30]">Sign in</Button>
      </div>
    </div>
  );

  return <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}><LayoutContent user={user}>{children}</LayoutContent></SidebarProvider>;
}

function LayoutContent({ children, user }: { children: React.ReactNode; user: NonNullable<ReturnType<typeof useAuth>["user"]> }) {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toggleSidebar } = useSidebar();
  const items = user.role === "admin"
    ? [{ label: "Review queue", path: "/", icon: ShieldCheck }, { label: "Daily tasks", path: "/tasks", icon: ClipboardList }]
    : [{ label: "My workspace", path: "/", icon: LayoutDashboard }, { label: "My submissions", path: "/submissions", icon: FileVideo }];

  return <>
    <Sidebar className="border-r border-[#e4e8ec] bg-[#fbfcfd]" collapsible="icon">
      <SidebarHeader className="h-20 px-4 justify-center"><button onClick={toggleSidebar} className="flex items-center gap-3 text-left" aria-label="Toggle navigation"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#192a3a] text-white"><FileVideo className="h-5 w-5" /></span><span className="group-data-[collapsible=icon]:hidden"><span className="block text-sm font-semibold tracking-tight text-[#192a3a]">Fieldframe</span><span className="block text-[11px] uppercase tracking-[0.18em] text-[#8996a3]">Capture ops</span></span><PanelLeft className="ml-auto h-4 w-4 text-[#9aa5ae] group-data-[collapsible=icon]:hidden" /></button></SidebarHeader>
      <SidebarContent className="px-3 py-5"><p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a4afb8] group-data-[collapsible=icon]:hidden">Workspace</p><SidebarMenu>{items.map(item => <SidebarMenuItem key={item.path}><SidebarMenuButton onClick={() => setLocation(item.path)} tooltip={item.label} className="h-11 rounded-xl text-[#52616f] hover:bg-[#eef2f4] hover:text-[#192a3a]"><item.icon className="h-4 w-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarContent>
      <SidebarFooter className="border-t border-[#e4e8ec] p-3"><DropdownMenu><DropdownMenuTrigger asChild><button className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-[#eef2f4]"><Avatar className="h-9 w-9"><AvatarFallback className="bg-[#f0ded7] text-[#a84c35]">{user.name?.slice(0, 1).toUpperCase() || "U"}</AvatarFallback></Avatar><span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><span className="block truncate text-sm font-medium text-[#192a3a]">{user.name || "Operator"}</span><span className="block truncate text-xs text-[#8996a3]">{user.role === "admin" ? "Administrator" : "Video operator"}</span></span></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52"><DropdownMenuItem onClick={logout} className="text-destructive"><LogOut className="mr-2 h-4 w-4" /> Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu></SidebarFooter>
    </Sidebar>
    <SidebarInset><div className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[#e4e8ec] bg-white/90 px-5 backdrop-blur md:hidden"><SidebarTrigger /><span className="text-sm font-semibold text-[#192a3a]">Fieldframe</span></div><main className="min-h-screen bg-[#f7f8fa] p-4 sm:p-6 lg:p-10">{children}</main></SidebarInset>
  </>;
}
