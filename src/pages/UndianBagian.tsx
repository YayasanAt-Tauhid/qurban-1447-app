import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Shuffle, CheckCircle, AlertTriangle, Users, Send, Copy, ExternalLink } from "lucide-react";

// ─── Definisi bagian khusus sapi kolektif (sesuai form fisik) ───────────────
export const BAGIAN_KOLEKTIF: { id: string; label: string; kuota: number; bisa_multi: boolean }[] = [
  { id: "ekor",        label: "Ekor",              kuota: 1, bisa_multi: false },
  { id: "kepala",      label: "Kepala (lidah+pipi)", kuota: 1, bisa_multi: false },
  { id: "rangka_kepala", label: "Rangka Kepala (otak)", kuota: 1, bisa_multi: false },
  { id: "ginjal",      label: "Ginjal",             kuota: 1, bisa_multi: false },
  { id: "jantung",     label: "Jantung",            kuota: 1, bisa_multi: false },
  { id: "limpa",       label: "Limpa",              kuota: 1, bisa_multi: false },
  { id: "lidah",       label: "Lidah",              kuota: 1, bisa_multi: false },
  { id: "tulang_kaki_1", label: "Tulang Kaki 1",   kuota: 1, bisa_multi: false },
  { id: "tulang_kaki_2", label: "Tulang Kaki 2",   kuota: 1, bisa_multi: false },
  { id: "tulang_kaki_3", label: "Tulang Kaki 3",   kuota: 1, bisa_multi: false },
  { id: "tulang_kaki_4", label: "Tulang Kaki 4",   kuota: 1, bisa_multi: false },
  { id: "paru_1",      label: "Paru 1",             kuota: 1, bisa_multi: true  },
  { id: "paru_2",      label: "Paru 2",             kuota: 1, bisa_multi: true  },
  { id: "babat_1",     label: "Babat 1",            kuota: 1, bisa_multi: true  },
  { id: "babat_2",     label: "Babat 2",            kuota: 1, bisa_multi: true  },
  { id: "babat_3",     label: "Babat 3",            kuota: 1, bisa_multi: true  },
  { id: "usus_1",      label: "Usus 1",             kuota: 1, bisa_multi: true  },
  { id: "usus_2",      label: "Usus 2",             kuota: 1, bisa_multi: true  },
  { id: "lemak_1",     label: "Lemak 1",            kuota: 1, bisa_multi: true  },
  { id: "lemak_2",     label: "Lemak 2",            kuota: 1, bisa_multi: true  },
  { id: "lemak_3",     label: "Lemak 3",            kuota: 1, bisa_multi: true  },
  { id: "daging_pipi_1", label: "Daging Pipi 1",   kuota: 1, bisa_multi: true  },
  { id: "daging_pipi_2", label: "Daging Pipi 2",   kuota: 1, bisa_multi: true  },
  { id: "kulit_1",     label: "Kulit 1",            kuota: 1, bisa_multi: true  },
  { id: "kulit_2",     label: "Kulit 2",            kuota: 1, bisa_multi: true  },
  { id: "kulit_3",     label: "Kulit 3",            kuota: 1, bisa_multi: true  },
];

type StatusBagian = "aman" | "sengketa" | "undian" | "selesai" | "kosong";

interface PilihanRow { id: string; shohibul_id: string; bagian: string; }
interface StatusRow  { id: string; bagian: string; status: StatusBagian; pemenang_id: string | null; catatan_panitia: string | null; }
interface ShohibulRow { id: string; nama: string; no_wa: string | null; }

const statusColor: Record<StatusBagian, string> = {
  aman:     "bg-green-100 text-green-700 border-green-200",
  sengketa: "bg-yellow-100 text-yellow-700 border-yellow-200",
  undian:   "bg-blue-100 text-blue-700 border-blue-200",
  selesai:  "bg-green-200 text-green-800 border-green-300",
  kosong:   "bg-gray-100 text-gray-500 border-gray-200",
};
const statusLabel: Record<StatusBagian, string> = {
  aman:     "✅ Aman",
  sengketa: "⚠️ Sengketa",
  undian:   "🎲 Undian",
  selesai:  "✔️ Selesai",
  kosong:   "○ Kosong",
};

// ─── Seeded random (Fisher-Yates) — deterministik & verifiable ──────────────
function seededShuffle<T>(arr: T[], seed: string): T[] {
  const copy = [...arr];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  for (let i = copy.length - 1; i > 0; i--) {
    h ^= h << 13; h ^= h >> 7; h ^= h << 17;
    const j = Math.abs(h) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ─── Komponen utama ──────────────────────────────────────────────────────────
const UndianBagian = () => {
  const { hewanId } = useParams<{ hewanId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [animating, setAnimating] = useState<string | null>(null); // bagian yg sedang diundi
  const [animName, setAnimName] = useState("");

  // ── Data hewan & shohibul ──
  const { data: hewan } = useQuery({
    queryKey: ["hewan-undian", hewanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hewan_qurban")
        .select("id, nomor_urut, jenis_hewan, tipe_kepemilikan, kuota")
        .eq("id", hewanId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!hewanId,
  });

  const { data: shohibulList } = useQuery<ShohibulRow[]>({
    queryKey: ["shohibul-undian", hewanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shohibul_qurban")
        .select("id, nama, no_wa")
        .eq("hewan_id", hewanId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hewanId,
  });

  // ── Pilihan semua shohibul ──
  const { data: pilihanList } = useQuery<PilihanRow[]>({
    queryKey: ["pilihan-bagian", hewanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pilihan_bagian")
        .select("id, shohibul_id, bagian")
        .eq("hewan_id", hewanId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hewanId,
  });

  // ── Status per bagian ──
  const { data: statusList } = useQuery<StatusRow[]>({
    queryKey: ["status-bagian", hewanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("status_bagian")
        .select("id, bagian, status, pemenang_id, catatan_panitia")
        .eq("hewan_id", hewanId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hewanId,
  });

  // ── Realtime subscription ──
  useEffect(() => {
    if (!hewanId) return;
    const ch = supabase
      .channel(`undian-${hewanId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pilihan_bagian", filter: `hewan_id=eq.${hewanId}` },
        () => { qc.invalidateQueries({ queryKey: ["pilihan-bagian", hewanId] }); })
      .on("postgres_changes", { event: "*", schema: "public", table: "status_bagian", filter: `hewan_id=eq.${hewanId}` },
        () => { qc.invalidateQueries({ queryKey: ["status-bagian", hewanId] }); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [hewanId, qc]);

  // ── Helpers ──
  const getStatus = useCallback((bagianId: string): StatusRow | undefined =>
    statusList?.find(s => s.bagian === bagianId), [statusList]);

  const getPilihan = useCallback((bagianId: string): PilihanRow[] =>
    pilihanList?.filter(p => p.bagian === bagianId) ?? [], [pilihanList]);

  const getShohibul = useCallback((id: string) =>
    shohibulList?.find(s => s.id === id), [shohibulList]);

  // Hitung status otomatis berdasarkan jumlah peminat
  const computeStatus = useCallback((bagianId: string): StatusBagian => {
    const st = getStatus(bagianId);
    if (st?.status === "selesai" || st?.status === "undian") return st.status;
    const p = getPilihan(bagianId);
    if (p.length === 0) return "kosong";
    if (p.length === 1) return "aman";
    return "sengketa";
  }, [getStatus, getPilihan]);

  // ── Mutasi: simpan/hapus pilihan ──
  const togglePilihan = useMutation({
    mutationFn: async ({ shohibulId, bagian }: { shohibulId: string; bagian: string }) => {
      const existing = pilihanList?.find(p => p.shohibul_id === shohibulId && p.bagian === bagian);
      if (existing) {
        await supabase.from("pilihan_bagian").delete().eq("id", existing.id);
      } else {
        const { error } = await supabase.from("pilihan_bagian").insert({
          hewan_id: hewanId!, shohibul_id: shohibulId, bagian,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pilihan-bagian", hewanId] }),
    onError: (e: any) => toast.error(e.message),
  });

  // ── Mutasi: finalisasi status bagian ──
  const finalisasiStatus = useMutation({
    mutationFn: async ({ bagian, status, pemenangId }: { bagian: string; status: StatusBagian; pemenangId?: string }) => {
      const existing = statusList?.find(s => s.bagian === bagian);
      if (existing) {
        await supabase.from("status_bagian").update({ status, pemenang_id: pemenangId ?? null, updated_at: new Date().toISOString() }).eq("id", existing.id);
      } else {
        await supabase.from("status_bagian").insert({ hewan_id: hewanId!, bagian, status, pemenang_id: pemenangId ?? null });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["status-bagian", hewanId] }),
    onError: (e: any) => toast.error(e.message),
  });

  // ── Aksi: shohibul mengalah ──
  const handleMengalah = async (bagian: string, shohibulId: string) => {
    // Hapus pilihan shohibul ini
    const existing = pilihanList?.find(p => p.shohibul_id === shohibulId && p.bagian === bagian);
    if (existing) {
      await supabase.from("pilihan_bagian").delete().eq("id", existing.id);
      await qc.invalidateQueries({ queryKey: ["pilihan-bagian", hewanId] });
    }
    // Cek apakah sisa peminat = 1 → selesai otomatis
    const sisa = (pilihanList ?? []).filter(p => p.bagian === bagian && p.shohibul_id !== shohibulId);
    if (sisa.length === 1) {
      await finalisasiStatus.mutateAsync({ bagian, status: "selesai", pemenangId: sisa[0].shohibul_id });
      toast.success("Musyawarah selesai! Bagian langsung ditetapkan.");
    } else {
      toast.success(`${getShohibul(shohibulId)?.nama} mengalah.`);
    }
  };

  // ── Aksi: lakukan undian ──
  const handleUndian = async (bagian: string) => {
    const peserta = getPilihan(bagian);
    if (peserta.length < 2) return;

    // Tandai mode undian dulu
    await finalisasiStatus.mutateAsync({ bagian, status: "undian" });

    // Animasi nama berputar
    setAnimating(bagian);
    const names = peserta.map(p => getShohibul(p.shohibul_id)?.nama ?? "?");
    let count = 0;
    const interval = setInterval(() => {
      setAnimName(names[count % names.length]);
      count++;
    }, 120);

    await new Promise(r => setTimeout(r, 2800));
    clearInterval(interval);
    setAnimating(null);

    // Seed = bagian + waktu + semua peserta (transparan & verifiable)
    const seed = `${bagian}-${Date.now()}-${peserta.map(p => p.shohibul_id).sort().join(",")}`;
    const shuffled = seededShuffle(peserta, seed);
    const pemenang = shuffled[0];

    // Simpan log undian
    await supabase.from("log_undian").insert({
      hewan_id: hewanId!,
      bagian,
      peserta: peserta.map(p => p.shohibul_id),
      pemenang_id: pemenang.shohibul_id,
      seed,
    });

    await finalisasiStatus.mutateAsync({ bagian, status: "selesai", pemenangId: pemenang.shohibul_id });
    toast.success(`🎉 ${getShohibul(pemenang.shohibul_id)?.nama} mendapat ${BAGIAN_KOLEKTIF.find(b => b.id === bagian)?.label}!`);
  };

  // ── Kirim hasil ke semua WA ──
  const kirimHasil = () => {
    if (!shohibulList || !statusList) return;
    const selesaiList = statusList.filter(s => s.status === "selesai" && s.pemenang_id);
    if (selesaiList.length === 0) { toast.error("Belum ada bagian yang selesai."); return; }

    shohibulList.forEach(sh => {
      if (!sh.no_wa) return;
      const dapatBagian = selesaiList
        .filter(s => s.pemenang_id === sh.id)
        .map(s => BAGIAN_KOLEKTIF.find(b => b.id === s.bagian)?.label ?? s.bagian)
        .join(", ");

      const msg = dapatBagian
        ? `Assalamu'alaikum ${sh.nama}, hasil pembagian bagian sapi ${hewan?.nomor_urut}:\n✅ Anda mendapat: ${dapatBagian}\n\nJazakallah khairan.`
        : `Assalamu'alaikum ${sh.nama}, Anda tidak mendapat bagian khusus sapi ${hewan?.nomor_urut}. Bagian umum (daging, tulang rusuk, hati) tetap didapat ya. Jazakallah khairan.`;

      const cleaned = sh.no_wa.replace(/\D/g, "").replace(/^0/, "62");
      window.open(`https://wa.me/${cleaned}?text=${encodeURIComponent(msg)}`, "_blank");
    });
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  if (!hewan) return <p className="text-muted-foreground p-8">Memuat data...</p>;

  const totalShohibul = shohibulList?.length ?? 0;
  const sengketaCount = BAGIAN_KOLEKTIF.filter(b => computeStatus(b.id) === "sengketa").length;
  const selesaiCount  = BAGIAN_KOLEKTIF.filter(b => computeStatus(b.id) === "selesai").length;

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-10">
      {/* Header */}
      <div className="page-header">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
        </Button>
        <h1 className="page-title">Pembagian Bagian Sapi</h1>
        <p className="page-subtitle">
          🐄 Sapi {hewan.nomor_urut} · Kolektif · {totalShohibul}/7 shohibul terdaftar
        </p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-3">
            <p className="text-2xl font-bold text-green-700">{selesaiCount}</p>
            <p className="text-green-600">Selesai</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-3">
            <p className="text-2xl font-bold text-yellow-700">{sengketaCount}</p>
            <p className="text-yellow-600">Sengketa</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200 bg-gray-50">
          <CardContent className="p-3">
            <p className="text-2xl font-bold text-gray-700">
              {BAGIAN_KOLEKTIF.filter(b => computeStatus(b.id) === "kosong").length}
            </p>
            <p className="text-gray-500">Kosong</p>
          </CardContent>
        </Card>
      </div>

      {/* Info bagian umum */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4 text-sm text-blue-800 space-y-1">
          <p className="font-semibold">📦 Bagian Umum (semua shohibul dapat):</p>
          <p>1) 1/7 dari setengah daging bersih tertimbang &nbsp; 2) Tulang Rusuk (~1 kg) &nbsp; 3) 1/7 Hati</p>
        </CardContent>
      </Card>

      {/* Daftar bagian */}
      <div className="space-y-3">
        <h2 className="font-semibold text-base">Bagian Khusus — Pilih yang Ingin Diambil</h2>
        {BAGIAN_KOLEKTIF.map(bagian => {
          const peminat = getPilihan(bagian.id);
          const status  = computeStatus(bagian.id);
          const stRow   = getStatus(bagian.id);
          const isAnim  = animating === bagian.id;

          return (
            <Card key={bagian.id} className={`transition-all ${status === "sengketa" ? "border-yellow-300" : status === "selesai" ? "border-green-300" : ""}`}>
              <CardContent className="p-4">
                {/* Baris atas: nama + status badge */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{bagian.label}</span>
                    {bagian.bisa_multi && (
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">bisa multi</span>
                    )}
                  </div>
                  <Badge className={statusColor[status]}>{statusLabel[status]}</Badge>
                </div>

                {/* Animasi undian */}
                {isAnim && (
                  <div className="text-center py-4 bg-blue-50 rounded-lg mb-3">
                    <p className="text-xs text-blue-500 mb-1">🎲 Mengundi...</p>
                    <p className="text-xl font-bold text-blue-700 animate-pulse">{animName}</p>
                  </div>
                )}

                {/* Pemenang */}
                {status === "selesai" && stRow?.pemenang_id && (
                  <div className="flex items-center gap-2 bg-green-50 rounded-lg p-3 mb-3">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">
                      {getShohibul(stRow.pemenang_id)?.nama}
                    </span>
                  </div>
                )}

                {/* Pilihan shohibul */}
                {status !== "selesai" && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Pilih shohibul yang menginginkan:</p>
                    <div className="flex flex-wrap gap-2">
                      {(shohibulList ?? []).map(sh => {
                        const sudahPilih = peminat.some(p => p.shohibul_id === sh.id);
                        return (
                          <button
                            key={sh.id}
                            onClick={() => togglePilihan.mutate({ shohibulId: sh.id, bagian: bagian.id })}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                              sudahPilih
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background border-border hover:border-primary/50"
                            }`}
                          >
                            {sh.nama}
                          </button>
                        );
                      })}
                    </div>

                    {/* Sengketa: tombol musyawarah & undian */}
                    {status === "sengketa" && !isAnim && (
                      <div className="mt-3 p-3 bg-yellow-50 rounded-lg space-y-2">
                        <div className="flex items-center gap-2 text-yellow-700 text-xs font-medium">
                          <AlertTriangle className="h-4 w-4" />
                          {peminat.length} orang menginginkan bagian ini — musyawarah dulu:
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {peminat.map(p => (
                            <Button
                              key={p.shohibul_id}
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                              onClick={() => handleMengalah(bagian.id, p.shohibul_id)}
                            >
                              {getShohibul(p.shohibul_id)?.nama} mengalah
                            </Button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <div className="flex-1 h-px bg-yellow-200" />
                          <span className="text-xs text-yellow-600">jika tidak ada yang mengalah</span>
                          <div className="flex-1 h-px bg-yellow-200" />
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs border-blue-300 text-blue-600 hover:bg-blue-50"
                          onClick={() => handleUndian(bagian.id)}
                          disabled={!!animating}
                        >
                          <Shuffle className="mr-2 h-3 w-3" /> Lakukan Undian
                        </Button>
                      </div>
                    )}

                    {/* Aman: langsung tetapkan */}
                    {status === "aman" && peminat.length === 1 && (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          className="text-xs bg-green-600 hover:bg-green-700"
                          onClick={() => finalisasiStatus.mutate({ bagian: bagian.id, status: "selesai", pemenangId: peminat[0].shohibul_id })}
                        >
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Tetapkan {getShohibul(peminat[0].shohibul_id)?.nama}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Tombol reset jika sudah selesai */}
                {status === "selesai" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-muted-foreground mt-1"
                    onClick={() => finalisasiStatus.mutate({ bagian: bagian.id, status: "kosong" })}
                  >
                    Batalkan
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tombol kirim hasil */}
      {selesaiCount > 0 && (
        <Card className="border-green-300 bg-green-50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-green-700">
              <Users className="h-4 w-4" />
              <span className="font-semibold text-sm">{selesaiCount} bagian sudah ditetapkan</span>
            </div>

            {/* Link hasil publik untuk shohibul */}
            <div className="rounded-lg border border-green-300 bg-white p-3 space-y-2">
              <p className="text-xs font-medium text-green-800">🔗 Link Hasil untuk Shohibul (tanpa login):</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-green-50 border border-green-200 rounded px-2 py-1.5 truncate text-green-900 select-all">
                  {`${window.location.origin}/publik/undian/${hewanId}`}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-green-300 text-green-700 hover:bg-green-50 h-8 px-2"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/publik/undian/${hewanId}`);
                    toast.success("Link disalin!");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-green-300 text-green-700 hover:bg-green-50 h-8 px-2"
                  onClick={() => window.open(`/publik/undian/${hewanId}`, "_blank")}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Bagikan link ini ke shohibul via WA agar mereka bisa lihat hasil secara transparan.</p>
            </div>

            <Button className="w-full bg-green-600 hover:bg-green-700" onClick={kirimHasil}>
              <Send className="mr-2 h-4 w-4" /> Kirim Hasil ke Semua WhatsApp
            </Button>
            <p className="text-xs text-green-600 text-center">
              Pesan otomatis dikirim ke WA masing-masing shohibul
            </p>
          </CardContent>
        </Card>
      )}

      {/* Ringkasan hasil */}
      {selesaiCount > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">📋 Ringkasan Hasil</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(shohibulList ?? []).map(sh => {
              const bagianDapat = (statusList ?? [])
                .filter(s => s.status === "selesai" && s.pemenang_id === sh.id)
                .map(s => BAGIAN_KOLEKTIF.find(b => b.id === s.bagian)?.label ?? s.bagian);
              return (
                <div key={sh.id} className="flex justify-between items-start py-2 border-b last:border-0">
                  <span className="font-medium">{sh.nama}</span>
                  <span className="text-right text-muted-foreground max-w-[55%]">
                    {bagianDapat.length > 0 ? bagianDapat.join(", ") : "—"}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UndianBagian;
