import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Beef, Users, Ticket, Wallet, TrendingUp } from "lucide-react";
import { formatRupiah } from "@/lib/qurban-utils";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { Database } from "@/integrations/supabase/types";

type BagianHewan = Database["public"]["Enums"]["bagian_hewan"];
const BAGIAN_LIST: BagianHewan[] = ["jeroan", "kepala", "kulit", "ekor", "kaki", "tulang"];

function CountdownCard() {
  const targetDate = new Date("2026-05-27T06:00:00+07:00");
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();
      if (diff <= 0) { setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return; }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Card className="col-span-full bg-primary text-primary-foreground border-0">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm opacity-80">Menuju Hari Raya Qurban</p>
            <h3 className="text-xl font-bold">10 Dzulhijjah 1447H / 27 Mei 2026</h3>
          </div>
          <div className="flex gap-3">
            {[
              { label: "Hari", value: timeLeft.days },
              { label: "Jam", value: timeLeft.hours },
              { label: "Menit", value: timeLeft.minutes },
              { label: "Detik", value: timeLeft.seconds },
            ].map((item) => (
              <div key={item.label} className="text-center bg-primary-foreground/10 rounded-lg px-3 py-2 min-w-[60px]">
                <div className="text-2xl font-bold">{String(item.value).padStart(2, "0")}</div>
                <div className="text-xs opacity-70">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  loading?: boolean;
  subtitle?: string;
}

function StatCard({ title, value, icon: Icon, loading, subtitle }: StatCardProps) {
  if (loading) return <Card><CardContent className="p-5"><Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-8 w-16" /></CardContent></Card>;
  return (
    <Card className="stat-card animate-fade-in">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const Dashboard = () => {
  const navigate = useNavigate();

  const { data: hewanStats, isLoading: loadingHewan } = useQuery({
    queryKey: ["dashboard-hewan"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hewan_qurban").select("id, jenis_hewan, status").eq("tahun", 1447);
      if (error) throw error;
      const total = data.length;
      const sapi = data.filter((h) => h.jenis_hewan === "sapi").length;
      const kambing = data.filter((h) => h.jenis_hewan === "kambing").length;
      return { total, sapi, kambing };
    },
  });

  const { data: shohibulCount, isLoading: loadingShohibul } = useQuery({
    queryKey: ["dashboard-shohibul-count"],
    queryFn: async () => {
      const { count } = await supabase.from("shohibul_qurban").select("*", { count: "exact", head: true }).eq("tahun", 1447);
      return count ?? 0;
    },
  });

  const { data: mustahiqCount, isLoading: loadingMustahiq } = useQuery({
    queryKey: ["dashboard-mustahiq-count"],
    queryFn: async () => {
      const { count } = await supabase.from("mustahiq").select("*", { count: "exact", head: true }).eq("tahun", 1447);
      return count ?? 0;
    },
  });

  const { data: kasStats, isLoading: loadingKas } = useQuery({
    queryKey: ["dashboard-kas"],
    queryFn: async () => {
      const { data } = await supabase.from("kas").select("jenis, jumlah").eq("tahun", 1447);
      if (!data) return { masuk: 0, keluar: 0, saldo: 0 };
      const masuk = data.filter((k) => k.jenis === "masuk").reduce((a, k) => a + Number(k.jumlah), 0);
      const keluar = data.filter((k) => k.jenis === "keluar").reduce((a, k) => a + Number(k.jumlah), 0);
      return { masuk, keluar, saldo: masuk - keluar };
    },
  });

  // Rekap request bagian
  const { data: rekapData } = useQuery({
    queryKey: ["dashboard-rekap-bagian"],
    queryFn: async () => {
      const { data: hewanData } = await supabase.from("hewan_qurban").select("id, nomor_urut, jenis_hewan").in("status", ["booking", "lunas"]);
      if (!hewanData) return [];
      const { data: requestData } = await supabase.from("request_bagian").select("hewan_id, bagian");
      if (!requestData) return hewanData.map((h) => ({ ...h, counts: {} as Record<string, number> }));

      return hewanData.map((h) => {
        const counts: Record<string, number> = {};
        BAGIAN_LIST.forEach((b) => {
          counts[b] = requestData.filter((r) => r.hewan_id === h.id && r.bagian === b).length;
        });
        return { ...h, counts };
      });
    },
  });

  // Progress chart
  const { data: progressData } = useQuery({
    queryKey: ["dashboard-progress"],
    queryFn: async () => {
      const { data } = await supabase.from("shohibul_qurban").select("created_at").eq("tahun", 1447).order("created_at");
      if (!data || data.length === 0) return [];
      const weeks: Record<string, number> = {};
      data.forEach((s) => {
        const d = new Date(s.created_at);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const key = weekStart.toISOString().split("T")[0];
        weeks[key] = (weeks[key] || 0) + 1;
      });
      let cumulative = 0;
      return Object.entries(weeks).sort().map(([week, count]) => {
        cumulative += count;
        return { week: new Date(week).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }), total: cumulative };
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Ringkasan pengelolaan qurban 1447H</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CountdownCard />
        <StatCard title="Total Hewan" value={hewanStats?.total ?? 0} icon={Beef} loading={loadingHewan} subtitle={hewanStats ? `${hewanStats.sapi} sapi, ${hewanStats.kambing} kambing` : undefined} />
        <StatCard title="Shohibul Qurban" value={shohibulCount ?? 0} icon={Users} loading={loadingShohibul} />
        <StatCard title="Mustahiq" value={mustahiqCount ?? 0} icon={Ticket} loading={loadingMustahiq} />
        <StatCard title="Iuran Terkumpul" value={formatRupiah(kasStats?.masuk ?? 0)} icon={TrendingUp} loading={loadingKas} />
        <StatCard title="Saldo Kas" value={formatRupiah(kasStats?.saldo ?? 0)} icon={Wallet} loading={loadingKas} />
      </div>

      {/* Rekap Request Bagian */}
      {rekapData && rekapData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Rekap Request Bagian</CardTitle></CardHeader>
          <CardContent>
            <div className="table-container">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hewan</TableHead>
                    {BAGIAN_LIST.map((b) => <TableHead key={b} className="text-center capitalize">{b}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rekapData.map((h) => (
                    <TableRow key={h.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/hewan/${h.id}`)}>
                      <TableCell className="font-medium">{h.nomor_urut} <span className="text-muted-foreground capitalize">({h.jenis_hewan})</span></TableCell>
                      {BAGIAN_LIST.map((b) => {
                        const count = h.counts[b] ?? 0;
                        return (
                          <TableCell key={b} className="text-center">
                          {count > 0 ? (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/20">{count}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Chart */}
      {progressData && progressData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Progres Pendaftaran Shohibul</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="hsl(147, 58%, 27%)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
