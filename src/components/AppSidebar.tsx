import {
  LayoutDashboard,
  Beef,
  Users,
  UserCheck,
  Wallet,
  Ticket,
  Truck,
  FileText,
  LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth, type RolePanitia } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const menuItems: { title: string; url: string; icon: any; allowedRoles?: RolePanitia[] }[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Hewan Qurban", url: "/hewan", icon: Beef },
  { title: "Shohibul Qurban", url: "/shohibul", icon: Users },
  { title: "Panitia", url: "/panitia", icon: UserCheck, allowedRoles: ["super_admin"] },
  { title: "Keuangan", url: "/keuangan", icon: Wallet, allowedRoles: ["super_admin", "admin_keuangan"] },
  { title: "Mustahiq & Kupon", url: "/mustahiq", icon: Ticket, allowedRoles: ["super_admin", "admin_kupon"] },
  { title: "Distribusi", url: "/distribusi", icon: Truck, allowedRoles: ["super_admin", "admin_kupon", "admin_hewan"] },
  { title: "Laporan", url: "/laporan", icon: FileText, allowedRoles: ["super_admin", "admin_keuangan"] },
];

const formatRole = (role: string) =>
  role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut, hasRole, role, panitiaName } = useAuth();

  const visibleItems = menuItems.filter(
    (item) => !item.allowedRoles || hasRole(item.allowedRoles)
  );

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="bg-sidebar">
        <div className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-sidebar-primary rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-sidebar-primary-foreground text-lg">🕌</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-sidebar-foreground truncate">Qurban Manager</h2>
              <p className="text-xs text-sidebar-foreground/60">1447H</p>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
            Menu Utama
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="hover:bg-sidebar-accent text-sidebar-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4 flex-shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="bg-sidebar p-3 space-y-2">
        {panitiaName && !collapsed && (
          <div className="px-2 text-xs text-sidebar-foreground/70">
            <p className="font-medium text-sidebar-foreground truncate">{panitiaName}</p>
            {role && <p className="truncate">{formatRole(role)}</p>}
          </div>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && "Keluar"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
