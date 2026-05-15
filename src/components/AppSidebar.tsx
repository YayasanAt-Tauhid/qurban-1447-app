import {
  LayoutDashboard,
  Beef,
  Users,
  UserCheck,
  Wallet,
  Ticket,
  Truck,
  FileText,
  Tag,
  LogOut,
  ClipboardList,
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
  { title: "Pengambilan Daging", url: "/pengambilan", icon: Ticket, allowedRoles: ["super_admin", "admin_kupon"] },
  { title: "Distribusi", url: "/distribusi", icon: Truck, allowedRoles: ["super_admin", "admin_kupon", "admin_hewan"] },
  { title: "Laporan", url: "/laporan", icon: FileText, allowedRoles: ["super_admin", "admin_keuangan"] },
  { title: "Cetak Label", url: "/cetak-label", icon: Tag, allowedRoles: ["super_admin", "admin_pendaftaran", "admin_kupon"] },
  { title: "Cetak Label Kambing", url: "/cetak-label-dua", icon: Tag, allowedRoles: ["super_admin", "admin_pendaftaran", "admin_kupon"] },
  { title: "Cetak Dokumen Hewan", url: "/cetak-dokumen", icon: ClipboardList, allowedRoles: ["super_admin", "admin_pendaftaran", "admin_hewan", "admin_kupon"] },
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
          <div className="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center" style={{background:"#1a6b3c"}}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="40" height="40">
              <ellipse cx="100" cy="88" rx="52" ry="54" fill="#ffffff"/>
              <rect x="48" y="88" width="104" height="60" fill="#ffffff"/>
              <rect x="83" y="118" width="34" height="30" rx="17" fill="#1a6b3c"/>
              <rect x="30" y="100" width="18" height="48" rx="4" fill="rgba(255,255,255,0.85)"/>
              <ellipse cx="39" cy="100" rx="9" ry="14" fill="#ffffff"/>
              <rect x="152" y="100" width="18" height="48" rx="4" fill="rgba(255,255,255,0.85)"/>
              <ellipse cx="161" cy="100" rx="9" ry="14" fill="#ffffff"/>
              <ellipse cx="100" cy="38" rx="10" ry="10" fill="#f5c842"/>
              <ellipse cx="105" cy="35" rx="8" ry="8" fill="#1a6b3c"/>
              <circle cx="118" cy="32" r="3" fill="#f5c842"/>
              <rect x="22" y="148" width="156" height="6" rx="3" fill="#f5c842"/>
              <ellipse cx="100" cy="172" rx="30" ry="14" fill="#f5c842"/>
              <ellipse cx="124" cy="163" rx="11" ry="9" fill="#f5c842"/>
              <path d="M119 156 Q116 148 122 145" fill="none" stroke="#f5c842" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M126 156 Q130 149 127 145" fill="none" stroke="#f5c842" strokeWidth="2.5" strokeLinecap="round"/>
              <rect x="78" y="184" width="6" height="12" rx="3" fill="#f5c842"/>
              <rect x="90" y="184" width="6" height="12" rx="3" fill="#f5c842"/>
              <rect x="104" y="184" width="6" height="12" rx="3" fill="#f5c842"/>
              <rect x="116" y="184" width="6" height="12" rx="3" fill="#f5c842"/>
              <path d="M70 168 Q62 162 65 155" fill="none" stroke="#f5c842" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-sidebar-foreground truncate">Qurban Manager</h2>
              <p className="text-xs text-sidebar-foreground/60">1447H · Yayasan At-Tauhid</p>
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
