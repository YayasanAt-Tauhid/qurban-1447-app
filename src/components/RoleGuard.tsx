import { useAuth, type RolePanitia } from "@/hooks/useAuth";
import { ShieldX, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface RoleGuardProps {
  allowedRoles: RolePanitia[];
  children: React.ReactNode;
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!role || !allowedRoles.includes(role)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <ShieldX className="h-16 w-16 text-destructive mx-auto" />
            <h2 className="text-xl font-bold">Akses Ditolak</h2>
            <p className="text-muted-foreground text-sm">
              Anda tidak memiliki izin untuk mengakses halaman ini. Hubungi administrator jika Anda merasa ini adalah kesalahan.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
