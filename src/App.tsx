import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import HewanList from "./pages/HewanList";
import HewanTambah from "./pages/HewanTambah";
import ShohibulList from "./pages/ShohibulList";
import { PanitiaPage, KeuanganPage, MustahiqPage, DistribusiPage, LaporanPage } from "./pages/PlaceholderPages";
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
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
            <Route path="/hewan" element={<ProtectedLayout><HewanList /></ProtectedLayout>} />
            <Route path="/hewan/tambah" element={<ProtectedLayout><HewanTambah /></ProtectedLayout>} />
            <Route path="/shohibul" element={<ProtectedLayout><ShohibulList /></ProtectedLayout>} />
            <Route path="/panitia" element={<ProtectedLayout><PanitiaPage /></ProtectedLayout>} />
            <Route path="/keuangan" element={<ProtectedLayout><KeuanganPage /></ProtectedLayout>} />
            <Route path="/mustahiq" element={<ProtectedLayout><MustahiqPage /></ProtectedLayout>} />
            <Route path="/distribusi" element={<ProtectedLayout><DistribusiPage /></ProtectedLayout>} />
            <Route path="/laporan" element={<ProtectedLayout><LaporanPage /></ProtectedLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
