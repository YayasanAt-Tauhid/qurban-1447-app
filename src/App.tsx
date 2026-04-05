import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleGuard } from "@/components/RoleGuard";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import HewanList from "./pages/HewanList";
import HewanTambah from "./pages/HewanTambah";
import HewanDetail from "./pages/HewanDetail";
import ShohibulList from "./pages/ShohibulList";
import ShohibulDaftar from "./pages/ShohibulDaftar";
import ShohibulDetail from "./pages/ShohibulDetail";
import AkadPage from "./pages/AkadPage";
import MustahiqPage from "./pages/MustahiqPage";
import LaporanPage from "./pages/LaporanPage";
import LaporanPublik from "./pages/LaporanPublik";
import DistribusiPage from "./pages/DistribusiPage";
import PanitiaPage from "./pages/PanitiaPage";
import KeuanganPage from "./pages/KeuanganPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/akad/:shohibulId" element={<AkadPage />} />
            <Route path="/publik/laporan" element={<LaporanPublik />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
            <Route path="/hewan" element={<ProtectedLayout><HewanList /></ProtectedLayout>} />
            <Route path="/hewan/tambah" element={<ProtectedLayout><RoleGuard allowedRoles={["super_admin", "admin_hewan"]}><HewanTambah /></RoleGuard></ProtectedLayout>} />
            <Route path="/hewan/:id" element={<ProtectedLayout><HewanDetail /></ProtectedLayout>} />
            <Route path="/shohibul" element={<ProtectedLayout><ShohibulList /></ProtectedLayout>} />
            <Route path="/shohibul/daftar" element={<ProtectedLayout><RoleGuard allowedRoles={["super_admin", "admin_pendaftaran"]}><ShohibulDaftar /></RoleGuard></ProtectedLayout>} />
            <Route path="/shohibul/:id" element={<ProtectedLayout><ShohibulDetail /></ProtectedLayout>} />
            <Route path="/panitia" element={<ProtectedLayout><RoleGuard allowedRoles={["super_admin"]}><PanitiaPage /></RoleGuard></ProtectedLayout>} />
            <Route path="/keuangan" element={<ProtectedLayout><RoleGuard allowedRoles={["super_admin", "admin_keuangan"]}><KeuanganPage /></RoleGuard></ProtectedLayout>} />
            <Route path="/mustahiq" element={<ProtectedLayout><RoleGuard allowedRoles={["super_admin", "admin_kupon"]}><MustahiqPage /></RoleGuard></ProtectedLayout>} />
            <Route path="/distribusi" element={<ProtectedLayout><RoleGuard allowedRoles={["super_admin", "admin_kupon", "admin_hewan"]}><DistribusiPage /></RoleGuard></ProtectedLayout>} />
            <Route path="/laporan" element={<ProtectedLayout><RoleGuard allowedRoles={["super_admin", "admin_keuangan"]}><LaporanPage /></RoleGuard></ProtectedLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
