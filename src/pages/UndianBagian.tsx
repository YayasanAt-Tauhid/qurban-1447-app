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
  { id: "ekor",          label: "Ekor",           kuota: 1, bisa_multi: false },
  { id: "rangka_kepala", label: "Rangka Kepala",  kuota: 1, bisa_multi: false },
  { id: "lidah",         label: "Lidah",          kuota: 1, bisa_multi: false },
  { id: "ginjal",        label: "Ginjal",         kuota: 1, bisa_multi: false },
  { id: "jantung",       label: "Jantung",        kuota: 1, bisa_multi: false },
  { id: "limpa",         label: "Limpa",          kuota: 1, bisa_multi: false },
  { id: "tulang_kaki_1", label: "Tulang Kaki 1",  kuota: 1, bisa_multi: false },
  { id: "tulang_kaki_2", label: "Tulang Kaki 2",  kuota: 1, bisa_multi: false },
  { id: "tulang_kaki_3", label: "Tulang Kaki 3",  kuota: 1, bisa_multi: false },
  { id: "tulang_kaki_4", label: "Tulang Kaki 4",  kuota: 1, bisa_multi: false },
  { id: "paru_1",        label: "Paru 1",         kuota: 1, bisa_multi: true  },
  { id: "paru_2",        label: "Paru 2",         kuota: 1, bisa_multi: true  },
  { id: "babat_1",       label: "Babat 1",        kuota: 1, bisa_multi: true  },
  { id: "babat_2",       label: "Babat 2",        kuota: 1, bisa_multi: true  },
  { id: "babat_3",       label: "Babat 3",        kuota: 1, bisa_multi: true  },
  { id: "usus_1",        label: "Usus 1",         kuota: 1, bisa_multi: true  },
  { id: "usus_2",        label: "Usus 2",         kuota: 1, bisa_multi: true  },
  { id: "lemak_1",       label: "Lemak 1",        kuota: 1, bisa_multi: true  },
  { id: "lemak_2",       label: "Lemak 2",        kuota: 1, bisa_multi: true  },
  { id: "lemak_3",       label: "Lemak 3",        kuota: 1, bisa_multi: true  },
  { id: "daging_pipi_1", label: "Daging Pipi 1",  kuota: 1, bisa_multi: true  },
  { id: "daging_pipi_2", label: "Daging Pipi 2",  kuota: 1, bisa_multi: true  },
  { id: "kulit_1",       label: "Kulit 1",        kuota: 1, bisa_multi: true  },
  { id: "kulit_2",       label: "Kulit 2",        kuota: 1, bisa_multi: true  },
  { id: "kulit_3",       label: "Kulit 3",        kuota: 1, bisa_multi: true  },
];

// ─── Kategori bagian (untuk survei awal & undian) ────────────────────────────
// slots.length = kuota maksimum shohibul yang bisa dapat kategori ini
export const KATEGORI_BAGIAN: { id: string; label: string; icon: string; slots: string[] }[] = [
  { id: "ekor",          label: "Ekor",          icon: "🦴", slots: ["ekor"] },
  { id: "rangka_kepala", label: "Rangka Kepala", icon: "🐄", slots: ["rangka_kepala"] },
  { id: "lidah",         label: "Lidah",         icon: "👅", slots: ["lidah"] },
  { id: "ginjal",        label: "Ginjal",        icon: "🫘", slots: ["ginjal"] },
  { id: "jantung",       label: "Jantung",       icon: "🫀", slots: ["jantung"] },
  { id: "limpa",         label: "Limpa",         icon: "🟣", slots: ["limpa"] },
  { id: "tulang_kaki",   label: "Tulang Kaki",   icon: "🦿", slots: ["tulang_kaki_1","tulang_kaki_2","tulang_kaki_3","tulang_kaki_4"] },
  { id: "paru",          label: "Paru",          icon: "🫁", slots: ["paru_1","paru_2"] },
  { id: "babat",         label: "Babat",         icon: "🟤", slots: ["babat_1","babat_2","babat_3"] },
  { id: "usus",          label: "Usus",          icon: "🌀", slots: ["usus_1","usus_2"] },
  { id: "lemak",         label: "Lemak",         icon: "🟡", slots: ["lemak_1","lemak_2","lemak_3"] },
  { id: "daging_pipi",   label: "Daging Pipi",   icon: "🥩", slots: ["daging_pipi_1","daging_pipi_2"] },
  { id: "kulit",         label: "Kulit",         icon: "🟫", slots: ["kulit_1","kulit_2","kulit_3"] },
];

// Helper: dari kategori id → max kuota (jumlah slot)
export function getKuotaKategori(kategoriId: string): number {
  return KATEGORI_BAGIAN.find(k => k.id === kategoriId)?.slots.length ?? 1;
}

// Helper: dari slot id → kategori id
export function getKategoriDariSlot(slotId: string): string {
  return KATEGORI_BAGIAN.find(k => k.slots.includes(slotId))?.id ?? slotId;
}

// ─── Types ───────────────────────────────────────────────────────────────────
type StatusKategori = "aman" | "sengketa" | "selesai" | "kosong";

// Request dari survei awal (per kategori, bukan per slot)
interface RequestRow {
  id: string;
  shohibul_qurban_id: string;
  bagian: string; // kategori id, misal "tulang_kaki"
  catatan: string | null;
  shohibul_qurban: { nama: string } | null;
}

// Status finalisasi per slot (untuk menyimpan pemenang akhir)
interface StatusRow {
  id: string;
  bagian: string; // slot id, misal "tulang_kaki_1"
  status: string;
  pemenang_id: string | null;
  catatan_panitia: string | null;
}

interface ShohibulRow { id: string; nama: string; no_wa: string | null; }

const statusColor: Record<StatusKategori, string> = {
  aman:     "bg-green-100 text-green-700 border-green-200",
  sengketa: "bg-yellow-100 text-yellow-700 border-yellow-200",
  selesai:  "bg-green-200 text-green-800 border-green-300",
  kosong:   "bg-gray-100 text-gray-500 border-gray-200",
};
const statusLabel: Record<StatusKategori, string> = {
  aman:     "✅ Aman",
  sengketa: "⚠️ Sengketa",
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

  const [animating, setAnimating] = useState<string | null>(null);
  const [animName, setAnimName] = useState("");

  // ── Data hewan ──
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

  // ── Data shohibul ──
  const { data: shohibulList } = useQuery<ShohibulRow[]>({
    queryKey: ["shohibul-undian", hewanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shohibul_qurban")
        .select("id, nama, no_wa")
        .eq("hewan_id", hewanId!);
      if (error) throw error;
      return (data ?? []) as ShohibulRow[];
    },
    enabled: !!hewanId,
  });

  // ── Request bagian dari survei awal (per kategori) ──
  const { data: requestList } = useQuery<RequestRow[]>({
    queryKey: ["request-bagian-undian", hewanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_bagian")
        .select("id, shohibul_qurban_id, bagian, catatan, shohibul_qurban(nama)")
        .eq("hewan_id", hewanId!);
      if (error) throw error;
      return (data ?? []) as RequestRow[];
    },
    enabled: !!hewanId,
  });

  // ── Status finalisasi per slot ──
  const { data: statusList } = useQuery<StatusRow[]>({
    queryKey: ["status-bagian", hewanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("status_bagian")
        .select("id, bagian, status, pemenang_id, catatan_panitia")
        .eq("hewan_id", hewanId!);
      if (error) throw error;
      return (data ?? []) as StatusRow[];
    },
    enabled: !!hewanId,
  });

  // ── Realtime subscription ──
  useEffect(() => {
    if (!hewanId) return;
    const ch = supabase
      .channel(`undian-${hewanId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "request_bagian", filter: `hewan_id=eq.${hewanId}` },
        () => { qc.invalidateQueries({ queryKey: ["request-bagian-undian", hewanId] }); })
      .on("postgres_changes", { event: "*", schema: "public", table: "status_bagian", filter: `hewan_id=eq.${hewanId}` },
        () => { qc.invalidateQueries({ queryKey: ["status-bagian", hewanId] }); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [hewanId, qc]);

  // ── Helpers ──
  const getShohibul = useCallback((id: string) =>
    (shohibulList as ShohibulRow[] | undefined)?.find(s => s.id === id), [shohibulList]);

  // Ambil semua request untuk kategori tertentu
  const getRequestKategori = useCallback((kategoriId: string): RequestRow[] =>
    (requestList as RequestRow[] | undefined)?.filter(r => r.bagian === kategoriId) ?? [],
    [requestList]);

  // Ambil status finalisasi untuk slot tertentu
  const getStatusSlot = useCallback((slotId: string): StatusRow | undefined =>
    (statusList as StatusRow[] | undefined)?.find(s => s.bagian === slotId), [statusList]);

  // Cek apakah semua slot kategori sudah selesai
  const isKategoriSelesai = useCallback((kategori: typeof KATEGORI_BAGIAN[0]): boolean => {
    const requests = getRequestKategori(kategori.id);
    if (requests.length === 0) return false;
    // Semua shohibul yang request sudah punya slot selesai
    const selesaiSlots = kategori.slots.filter(slotId => {
      const st = getStatusSlot(slotId);
      return st?.status === "selesai";
    });
    return selesaiSlots.length >= Math.min(requests.length, kategori.slots.length);
  }, [getRequestKategori, getStatusSlot]);

  // Hitung status keseluruhan kategori
  const computeStatusKategori = useCallback((kategori: typeof KATEGORI_BAGIAN[0]): StatusKategori => {
    const requests = getRequestKategori(kategori.id);
    if (requests.length === 0) return "kosong";
    if (isKategoriSelesai(kategori)) return "selesai";
    // Sengketa jika peminat > kuota (jumlah slot)
    if (requests.length > kategori.slots.length) return "sengketa";
    return "aman";
  }, [getRequestKategori, isKategoriSelesai]);

  // ── Mutasi: finalisasi satu slot ──
  const finalisasiSlot = useMutation({
    mutationFn: async ({ slotId, status, pemenangId }: { slotId: string; status: string; pemenangId?: string }) => {
      const existing = (statusList as StatusRow[] | undefined)?.find(s => s.bagian === slotId);
      if (existing) {
        await supabase.from("status_bagian")
          .update({ status, pemenang_id: pemenangId ?? null, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("status_bagian")
          .insert({ hewan_id: hewanId!, bagian: slotId, status, pemenang_id: pemenangId ?? null });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["status-bagian", hewanId] }),
    onError: (e: any) => toast.error(e.message),
  });

  // ── Aksi: tetapkan kategori aman (peminat ≤ kuota) langsung ──
  // Jika hanya 1 shohibul yang request → dia dapat SEMUA slot kategori ini
  // Jika peminat > 1 (tapi ≤ kuota) → setiap shohibul dapat 1 slot masing-masing
  const handleTetapkanAman = async (kategori: typeof KATEGORI_BAGIAN[0]) => {
    const requests = getRequestKategori(kategori.id);
    if (requests.length === 1) {
      // 1 shohibul saja → dapat semua slot
      for (const slotId of kategori.slots) {
        await finalisasiSlot.mutateAsync({
          slotId,
          status: "selesai",
          pemenangId: requests[0].shohibul_qurban_id,
        });
      }
      const nama = requests[0].shohibul_qurban?.nama ?? getShohibul(requests[0].shohibul_qurban_id)?.nama ?? "?";
      toast.success(`✅ ${kategori.label} (semua ${kategori.slots.length}) → ${nama}`);
    } else {
      // Beberapa shohibul, masing-masing dapat 1 slot
      for (let i = 0; i < requests.length && i < kategori.slots.length; i++) {
        await finalisasiSlot.mutateAsync({
          slotId: kategori.slots[i],
          status: "selesai",
          pemenangId: requests[i].shohibul_qurban_id,
        });
      }
      toast.success(`✅ ${kategori.label} ditetapkan untuk ${requests.length} shohibul.`);
    }
  };

  // ── Aksi: shohibul mengalah (hapus request-nya) ──
  const handleMengalah = async (kategoriId: string, shohibulId: string, requestId: string) => {
    await supabase.from("request_bagian").delete().eq("id", requestId);

    // Ambil fresh data setelah delete
    const { data: freshRequests } = await supabase
      .from("request_bagian")
      .select("id, shohibul_qurban_id, bagian, catatan, shohibul_qurban(nama)")
      .eq("hewan_id", hewanId!)
      .eq("bagian", kategoriId);

    await qc.invalidateQueries({ queryKey: ["request-bagian-undian", hewanId] });

    const sisa = (freshRequests ?? []) as RequestRow[];
    const kategori = KATEGORI_BAGIAN.find(k => k.id === kategoriId)!;

    if (sisa.length === 1) {
      // Tinggal 1 shohibul → dia dapat SEMUA slot
      for (const slotId of kategori.slots) {
        await finalisasiSlot.mutateAsync({
          slotId,
          status: "selesai",
          pemenangId: sisa[0].shohibul_qurban_id,
        });
      }
      const nama = sisa[0].shohibul_qurban?.nama ?? getShohibul(sisa[0].shohibul_qurban_id)?.nama ?? "?";
      toast.success(`Musyawarah selesai! ${kategori.label} (semua ${kategori.slots.length}) → ${nama}`);
    } else if (sisa.length > 0 && sisa.length <= kategori.slots.length) {
      // Beberapa shohibul, masing-masing dapat 1 slot
      for (let i = 0; i < sisa.length && i < kategori.slots.length; i++) {
        await finalisasiSlot.mutateAsync({
          slotId: kategori.slots[i],
          status: "selesai",
          pemenangId: sisa[i].shohibul_qurban_id,
        });
      }
      toast.success(`Musyawarah selesai! ${kategori.label} langsung ditetapkan.`);
    } else {
      toast.success(`${getShohibul(shohibulId)?.nama} mengalah.`);
    }
  };

  // ── Aksi: lakukan undian (jika masih sengketa setelah musyawarah) ──
  // Undian memilih siapa yang TIDAK dapat (dikeluarkan) sampai peminat = kuota
  const handleUndian = async (kategori: typeof KATEGORI_BAGIAN[0]) => {
    const requests = getRequestKategori(kategori.id);
    const kuota = kategori.slots.length;
    if (requests.length <= kuota) return;

    setAnimating(kategori.id);
    const names = requests.map(r => r.shohibul_qurban?.nama ?? getShohibul(r.shohibul_qurban_id)?.nama ?? "?");
    let count = 0;
    const interval = setInterval(() => {
      setAnimName(names[count % names.length]);
      count++;
    }, 120);

    await new Promise(r => setTimeout(r, 2800));
    clearInterval(interval);
    setAnimating(null);

    // Seed transparan & verifiable
    const seed = `${kategori.id}-${Date.now()}-${requests.map(r => r.shohibul_qurban_id).sort().join(",")}`;
    const shuffled = seededShuffle(requests, seed);
    // Pemenang = kuota pertama dari hasil shuffle
    const pemenang = shuffled.slice(0, kuota);

    // Simpan log undian (satu log per kategori)
    await supabase.from("log_undian").insert({
      hewan_id: hewanId!,
      bagian: kategori.id,
      peserta: requests.map(r => r.shohibul_qurban_id),
      pemenang_id: pemenang[0].shohibul_qurban_id, // pemenang utama (slot 1)
      seed,
    });

    // Tetapkan setiap pemenang ke slotnya
    for (let i = 0; i < pemenang.length; i++) {
      await finalisasiSlot.mutateAsync({
        slotId: kategori.slots[i],
        status: "selesai",
        pemenangId: pemenang[i].shohibul_qurban_id,
      });
    }

    const namaPemenang = pemenang.map(p => p.shohibul_qurban?.nama ?? getShohibul(p.shohibul_qurban_id)?.nama).join(", ");
    toast.success(`🎉 ${kategori.label} → ${namaPemenang}`);
  };

  // ── Reset kategori ──
  const handleReset = async (kategori: typeof KATEGORI_BAGIAN[0]) => {
    for (const slotId of kategori.slots) {
      const existing = (statusList as StatusRow[] | undefined)?.find(s => s.bagian === slotId);
      if (existing) {
        await supabase.from("status_bagian")
          .update({ status: "kosong", pemenang_id: null, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      }
    }
    await qc.invalidateQueries({ queryKey: ["status-bagian", hewanId] });
    toast.success("Reset berhasil.");
  };

  // ── Kirim hasil ke semua WA ──
  const kirimHasil = () => {
    if (!shohibulList || !statusList) return;
    const selesaiList = (statusList as StatusRow[]).filter(s => s.status === "selesai" && s.pemenang_id);
    if (selesaiList.length === 0) { toast.error("Belum ada bagian yang selesai."); return; }

    (shohibulList as ShohibulRow[]).forEach(sh => {
      if (!sh.no_wa) return;
      const dapatBagian = selesaiList
        .filter(s => s.pemenang_id === sh.id)
        .map(s => {
          const kategori = KATEGORI_BAGIAN.find(k => k.slots.includes(s.bagian));
          const slotLabel = BAGIAN_KOLEKTIF.find(b => b.id === s.bagian)?.label ?? s.bagian;
          // Jika kategori punya banyak slot, tampilkan label slot (misal "Tulang Kaki 1")
          // Jika single slot, tampilkan label kategori saja
          return kategori && kategori.slots.length > 1 ? slotLabel : (kategori?.label ?? slotLabel);
        })
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

  const totalShohibul = (shohibulList as ShohibulRow[] | undefined)?.length ?? 0;

  // Hitung summary dari KATEGORI_BAGIAN
  const selesaiCount  = KATEGORI_BAGIAN.filter(k => computeStatusKategori(k) === "selesai").length;
  const sengketaCount = KATEGORI_BAGIAN.filter(k => computeStatusKategori(k) === "sengketa").length;
  const kosongCount   = KATEGORI_BAGIAN.filter(k => computeStatusKategori(k) === "kosong").length;

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-10">
      {/* Header */}
      <div className="page-header">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
        </Button>
        <h1 className="page-title">🎲 Pembagian Bagian Resmi — Sapi {hewan.nomor_urut}</h1>
        <p className="page-subtitle">
          Berdasarkan survei awal shohibul · Kolektif · {totalShohibul}/7 shohibul terdaftar
        </p>
        <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300">
          <span>💡</span>
          <span>Data diambil dari survei minat shohibul. Jika peminat melebihi kuota, lakukan musyawarah atau undian.</span>
        </div>
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
            <p className="text-2xl font-bold text-gray-700">{kosongCount}</p>
            <p className="text-gray-500">Belum ada minat</p>
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

      {/* Daftar kategori bagian */}
      <div className="space-y-3">
        <div className="flex flex-col gap-0.5 mb-1">
          <h2 className="font-semibold text-base">Bagian Khusus — Penetapan Resmi</h2>
          <p className="text-xs text-muted-foreground">
            Jika peminat ≤ kuota → langsung tetapkan. Jika peminat lebih dari kuota → musyawarah atau undian.
          </p>
        </div>

        {KATEGORI_BAGIAN.map(kategori => {
          const requests   = getRequestKategori(kategori.id);
          const status     = computeStatusKategori(kategori);
          const kuota      = kategori.slots.length;
          const isAnim     = animating === kategori.id;

          // Slot-slot yang sudah selesai
          const selesaiSlots = kategori.slots
            .map(slotId => ({ slotId, st: getStatusSlot(slotId) }))
            .filter(({ st }) => st?.status === "selesai");

          const cardBorder = status === "sengketa"
            ? "border-yellow-300"
            : status === "selesai"
            ? "border-green-300"
            : "";

          return (
            <Card key={kategori.id} className={`transition-all ${cardBorder}`}>
              <CardContent className="p-4">
                {/* Header: nama + kuota + status */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{kategori.icon} {kategori.label}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      kuota {kuota}
                    </span>
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

                {/* Hasil selesai — tampilkan pemenang per slot */}
                {status === "selesai" && selesaiSlots.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {selesaiSlots.map(({ slotId, st }) => {
                      const slotLabel = BAGIAN_KOLEKTIF.find(b => b.id === slotId)?.label ?? slotId;
                      const nama = getShohibul(st!.pemenang_id!)?.nama
                        ?? requests.find(r => r.shohibul_qurban_id === st!.pemenang_id)?.shohibul_qurban?.nama
                        ?? "—";
                      return (
                        <div key={slotId} className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2">
                          <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                          <span className="text-xs text-green-600 w-24 shrink-0">
                            {kuota > 1 ? slotLabel : kategori.label}
                          </span>
                          <span className="text-sm font-medium text-green-700">{nama}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Daftar peminat dari survei */}
                {requests.length > 0 && status !== "selesai" && (
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground mb-1.5">
                      Peminat ({requests.length}/{kuota} kuota):
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {requests.map(r => {
                        const nama = r.shohibul_qurban?.nama ?? getShohibul(r.shohibul_qurban_id)?.nama ?? "?";
                        return (
                          <span
                            key={r.id}
                            className="text-xs px-2.5 py-1 rounded-full border bg-primary/10 border-primary/30 text-primary"
                          >
                            {nama}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tidak ada peminat */}
                {requests.length === 0 && (
                  <p className="text-xs text-muted-foreground italic mb-2">Tidak ada shohibul yang merequest bagian ini.</p>
                )}

                {/* Aman: peminat ≤ kuota → tombol tetapkan langsung */}
                {status === "aman" && !isAnim && (
                  <Button
                    size="sm"
                    className="text-xs bg-green-600 hover:bg-green-700"
                    onClick={() => handleTetapkanAman(kategori)}
                  >
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Tetapkan {requests.length === 1
                      ? requests[0].shohibul_qurban?.nama ?? getShohibul(requests[0].shohibul_qurban_id)?.nama
                      : `${requests.length} shohibul`}
                  </Button>
                )}

                {/* Sengketa: peminat > kuota → musyawarah atau undian */}
                {status === "sengketa" && !isAnim && (
                  <div className="mt-2 p-3 bg-yellow-50 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-yellow-700 text-xs font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      {requests.length} peminat, kuota hanya {kuota} — musyawarah dulu:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {requests.map(r => {
                        const nama = r.shohibul_qurban?.nama ?? getShohibul(r.shohibul_qurban_id)?.nama ?? "?";
                        return (
                          <Button
                            key={r.id}
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                            onClick={() => handleMengalah(kategori.id, r.shohibul_qurban_id, r.id)}
                          >
                            {nama} mengalah
                          </Button>
                        );
                      })}
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
                      onClick={() => handleUndian(kategori)}
                      disabled={!!animating}
                    >
                      <Shuffle className="mr-2 h-3 w-3" /> Lakukan Undian
                    </Button>
                  </div>
                )}

                {/* Reset jika sudah selesai */}
                {status === "selesai" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-muted-foreground mt-1"
                    onClick={() => handleReset(kategori)}
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
              <span className="font-semibold text-sm">{selesaiCount} kategori bagian sudah ditetapkan</span>
            </div>

            {/* Link hasil publik */}
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
            {(shohibulList as ShohibulRow[] ?? []).map(sh => {
              const selesaiMilik = (statusList as StatusRow[] ?? [])
                .filter(s => s.status === "selesai" && s.pemenang_id === sh.id);
              const bagianDapat = selesaiMilik.map(s => {
                const kategori = KATEGORI_BAGIAN.find(k => k.slots.includes(s.bagian));
                const slotLabel = BAGIAN_KOLEKTIF.find(b => b.id === s.bagian)?.label ?? s.bagian;
                return kategori && kategori.slots.length > 1 ? slotLabel : (kategori?.label ?? slotLabel);
              });
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