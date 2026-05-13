import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, ShieldCheck } from "lucide-react";
import { BAGIAN_KOLEKTIF } from "./UndianBagian";

// ─── Types ────────────────────────────────────────────────────────────────────
interface StatusRow {
  bagian: string;
  status: string;
  pemenang_id: string | null;
}
interface ShohibulRow { id: string; nama: string; }
interface LogUndianRow {
  id: string;
  bagian: string;
  peserta: string[];
  pemenang_id: string;
  seed: string;
  created_at: string;
}

// ─── Komponen utama ───────────────────────────────────────────────────────────
const UndianHasil = () => {
  const { hewanId } = useParams<{ hewanId: string }>();
  const qc = useQueryClient();

  // Data hewan
  const { data: hewan } = useQuery({
    queryKey: ["hewan-hasil", hewanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hewan_qurban")
        .select("id, nomor_urut, jenis_hewan")
        .eq("id", hewanId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!hewanId,
  });

  // Daftar shohibul
  const { data: shohibulList } = useQuery<ShohibulRow[]>({
    queryKey: ["shohibul-hasil", hewanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shohibul_qurban")
        .select("id, nama")
        .eq("hewan_id", hewanId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hewanId,
  });

  // Status per bagian
  const { data: statusList } = useQuery<StatusRow[]>({
    queryKey: ["status-hasil", hewanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("status_bagian")
        .select("bagian, status, pemenang_id")
        .eq("hewan_id", hewanId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hewanId,
  });

  // Log undian (bukti audit)
  const { data: logList } = useQuery<LogUndianRow[]>({
    queryKey: ["log-hasil", hewanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("log_undian")
        .select("id, bagian, peserta, pemenang_id, seed, created_at")
        .eq("hewan_id", hewanId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hewanId,
  });

  // ── Realtime: update otomatis saat panitia mengubah status ──
  useEffect(() => {
    if (!hewanId) return;
    const ch = supabase
      .channel(`hasil-publik-${hewanId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "status_bagian",
        filter: `hewan_id=eq.${hewanId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ["status-hasil", hewanId] });
      })
      .on("postgres_changes", {
        event: "*", schema: "public", table: "log_undian",
        filter: `hewan_id=eq.${hewanId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ["log-hasil", hewanId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [hewanId, qc]);

  // ── Helpers ──
  const getShohibul = (id: string) => shohibulList?.find(s => s.id === id);

  const selesaiList = statusList?.filter(s => s.status === "selesai" && s.pemenang_id) ?? [];
  const selesaiCount = selesaiList.length;
  const totalBagian = BAGIAN_KOLEKTIF.length;

  // Bagian per shohibul
  const bagianPerShohibul = (shohibulId: string) =>
    selesaiList
      .filter(s => s.pemenang_id === shohibulId)
      .map(s => BAGIAN_KOLEKTIF.find(b => b.id === s.bagian)?.label ?? s.bagian);

  if (!hewan) return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <p className="text-muted-foreground animate-pulse">Memuat data...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <div className="text-3xl">🐄</div>
          <h1 className="text-xl font-bold">Hasil Pembagian Bagian</h1>
          <p className="text-muted-foreground text-sm">
            Sapi {hewan.nomor_urut} · Kolektif
          </p>
        </div>

        {/* Progress */}
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Progress Penetapan</span>
              <span className="text-sm text-muted-foreground">{selesaiCount}/{totalBagian} bagian</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${totalBagian > 0 ? (selesaiCount / totalBagian) * 100 : 0}%` }}
              />
            </div>
            {selesaiCount < totalBagian && (
              <div className="flex items-center gap-1.5 mt-3 text-xs text-amber-600 bg-amber-50 rounded-md px-3 py-2">
                <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                Proses pembagian masih berlangsung. Halaman ini diperbarui otomatis.
              </div>
            )}
            {selesaiCount === totalBagian && (
              <div className="flex items-center gap-1.5 mt-3 text-xs text-green-700 bg-green-50 rounded-md px-3 py-2">
                <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                Semua bagian sudah ditetapkan.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bagian umum untuk semua */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 text-sm text-blue-800 space-y-1">
            <p className="font-semibold">📦 Bagian Umum (semua shohibul dapat):</p>
            <p>1) 1/7 dari setengah daging bersih tertimbang &nbsp;·&nbsp; 2) Tulang Rusuk (~1 kg) &nbsp;·&nbsp; 3) 1/7 Hati</p>
          </CardContent>
        </Card>

        {/* Ringkasan per shohibul */}
        {(shohibulList ?? []).length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">👤 Bagian Per Shohibul</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(shohibulList ?? []).map(sh => {
                const bagian = bagianPerShohibul(sh.id);
                return (
                  <div key={sh.id} className="flex justify-between items-start py-2 border-b last:border-0 gap-2">
                    <span className="font-medium text-sm min-w-[30%]">{sh.nama}</span>
                    <div className="text-right flex flex-wrap gap-1 justify-end">
                      {bagian.length > 0
                        ? bagian.map(b => (
                            <Badge key={b} variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
                              {b}
                            </Badge>
                          ))
                        : <span className="text-xs text-muted-foreground">Belum ditetapkan</span>
                      }
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Tabel semua bagian */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">📋 Detail Semua Bagian Khusus</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {BAGIAN_KOLEKTIF.map(bagian => {
              const st = selesaiList.find(s => s.bagian === bagian.id);
              const pemenang = st?.pemenang_id ? getShohibul(st.pemenang_id) : null;
              const log = logList?.find(l => l.bagian === bagian.id);

              return (
                <div key={bagian.id} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div>
                    <span className="text-sm font-medium">{bagian.label}</span>
                    {log && (
                      <p className="text-xs text-muted-foreground mt-0.5">🎲 via undian</p>
                    )}
                  </div>
                  <div className="text-right">
                    {pemenang
                      ? <Badge className="bg-green-100 text-green-700 border-green-200">{pemenang.nama}</Badge>
                      : <span className="text-xs text-muted-foreground">—</span>
                    }
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Bukti audit undian */}
        {(logList ?? []).length > 0 && (
          <Card className="border-gray-200">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-gray-500" />
                <CardTitle className="text-base text-gray-700">Bukti Audit Undian</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Setiap undian menggunakan seed deterministik yang bisa diverifikasi ulang.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {(logList ?? []).map(log => {
                const bagianLabel = BAGIAN_KOLEKTIF.find(b => b.id === log.bagian)?.label ?? log.bagian;
                const pemenangNama = getShohibul(log.pemenang_id)?.nama ?? log.pemenang_id;
                const pesertaNama = (log.peserta ?? [])
                  .map(id => getShohibul(id)?.nama ?? id)
                  .join(", ");
                const waktu = new Date(log.created_at).toLocaleString("id-ID", {
                  day: "2-digit", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                });

                return (
                  <div key={log.id} className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">{bagianLabel}</span>
                      <span className="text-muted-foreground">{waktu}</span>
                    </div>
                    <p>Peserta: <span className="text-foreground">{pesertaNama}</span></p>
                    <p>Pemenang: <span className="font-semibold text-green-700">{pemenangNama}</span></p>
                    <p className="text-muted-foreground break-all">Seed: {log.seed}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pb-4">
          Halaman ini hanya untuk melihat hasil. Tidak dapat diubah oleh siapapun kecuali panitia.
        </p>
      </div>
    </div>
  );
};

export default UndianHasil;
