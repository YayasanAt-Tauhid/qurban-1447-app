import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Printer, ScanLine, Eye, FileUp, Download, CheckCircle2, XCircle } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { generateNomorKupon } from "@/lib/qurban-utils";
import { QRCodeCanvas } from "qrcode.react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import KuponTemplate from "@/components/KuponTemplate";
import ImportExcelDialog from "@/components/ImportExcelDialog";

type KategoriMustahiq = Database["public"]["Enums"]["kategori_mustahiq"];
type ScanState = "scanning" | "success" | "error";

const KATEGORI_OPTIONS: KategoriMustahiq[] = ["dhuafa", "warga", "jamaah", "shohibul_qurban", "bagian_tidak_direquest", "lainnya"];
const VALID_KATEGORI = new Set(KATEGORI_OPTIONS);

// Generate nomor kupon shohibul: SS-001 (sapi), SK-001 (kambing)
function generateNomorKuponShohibul(index: number, jenis: "sapi" | "kambing"): string {
  const prefix = jenis === "sapi" ? "SS" : "SK";
  return `${prefix}-${String(index).padStart(3, "0")}`;
}

const MustahiqPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [searchShohibul, setSearchShohibul] = useState("");
  const [activeTab, setActiveTab] = useState("mustahiq");
  const [showAdd, setShowAdd] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showPreview, setShowPreview] = useState<string | null>(null);
  const [showPreviewShohibul, setShowPreviewShohibul] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [formNama, setFormNama] = useState("");
  const [formKategori, setFormKategori] = useState<KategoriMustahiq>("warga");
  const [formKeterangan, setFormKeterangan] = useState("");
  const [formPenyalur, setFormPenyalur] = useState("");
  const { isAdmin, hasRole } = useAuth();

  // Scan states
  const [scanState, setScanState] = useState<ScanState>("scanning");
  const [scanResult, setScanResult] = useState<{ nama: string; nomor_kupon: string; kategori: string } | null>(null);
  const [scanError, setScanError] = useState("");
  const [scanKey, setScanKey] = useState(0);
  const scannerRef = useRef<any>(null);
  const isScanProcessingRef = useRef(false);

  // ── Query mustahiq ──────────────────────────────────────────────────────────
  const { data: mustahiqList, isLoading } = useQuery({
    queryKey: ["mustahiq-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mustahiq")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  // ── Query shohibul dengan join hewan untuk tahu jenis_hewan ───────────────
  const { data: shohibulList, isLoading: isLoadingShohibul } = useQuery({
    queryKey: ["shohibul-kupon-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shohibul_qurban")
        .select("id, nama, no_wa, tipe_kepemilikan, hewan_id, hewan_qurban(jenis_hewan, nomor_urut)")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  // ── Query status kupon shohibul (disimpan di tabel mustahiq dgn ref id shohibul) ──
  const { data: kuponShohibulMap } = useQuery({
    queryKey: ["kupon-shohibul-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mustahiq")
        .select("id, nama, nomor_kupon, qr_data, status_kupon, keterangan")
        .eq("kategori", "shohibul_qurban");
      if (error) throw error;
      // keterangan digunakan sebagai shohibul_id referensi
      const map: Record<string, typeof data[0]> = {};
      data?.forEach((m) => { if (m.keterangan) map[m.keterangan] = m; });
      return map;
    },
  });


  // Derived: shohibul sapi & kambing
  const shohibulSapi = shohibulList?.filter((s) => (s.hewan_qurban as any)?.jenis_hewan === "sapi") ?? [];
  const shohibulKambing = shohibulList?.filter((s) => (s.hewan_qurban as any)?.jenis_hewan === "kambing") ?? [];

  // ── Auto-generate kupon saat shohibul & kupon map sudah dimuat ────────────
  const autoGeneratedRef = useRef(false);
  useEffect(() => {
    if (autoGeneratedRef.current) return;
    if (!shohibulList || shohibulList.length === 0) return;
    if (kuponShohibulMap === undefined) return; // masih loading

    const belumAdaKupon = shohibulList.some((s) => !kuponShohibulMap[s.id]);
    if (!belumAdaKupon) return;

    autoGeneratedRef.current = true;

    const run = async () => {
      let sapiIdx = Object.values(kuponShohibulMap).filter(k => k.nomor_kupon?.startsWith("SS")).length;
      let kambingIdx = Object.values(kuponShohibulMap).filter(k => k.nomor_kupon?.startsWith("SK")).length;

      for (const s of shohibulSapi) {
        if (!kuponShohibulMap[s.id]) {
          sapiIdx++;
          const nomor = generateNomorKuponShohibul(sapiIdx, "sapi");
          await supabase.from("mustahiq").insert({
            nama: s.nama,
            kategori: "shohibul_qurban" as KategoriMustahiq,
            nomor_kupon: nomor,
            qr_data: nomor,
            keterangan: s.id,
          });
        }
      }
      for (const s of shohibulKambing) {
        if (!kuponShohibulMap[s.id]) {
          kambingIdx++;
          const nomor = generateNomorKuponShohibul(kambingIdx, "kambing");
          await supabase.from("mustahiq").insert({
            nama: s.nama,
            kategori: "shohibul_qurban" as KategoriMustahiq,
            nomor_kupon: nomor,
            qr_data: nomor,
            keterangan: s.id,
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["kupon-shohibul-map"] });
    };

    run();
  }, [shohibulList, kuponShohibulMap]);

  // ── Mutation: generate/ensure kupon untuk satu shohibul ──────────────────
  const ensureKuponShohibulMutation = useMutation({
    mutationFn: async ({ shohibulId, nama, jenis, index }: {
      shohibulId: string; nama: string; jenis: "sapi" | "kambing"; index: number;
    }) => {
      // Cek apakah sudah ada
      const existing = kuponShohibulMap?.[shohibulId];
      if (existing) return existing;
      // Buat baru
      const nomor = generateNomorKuponShohibul(index, jenis);
      const { data, error } = await supabase.from("mustahiq").insert({
        nama,
        kategori: "shohibul_qurban" as KategoriMustahiq,
        nomor_kupon: nomor,
        qr_data: nomor,
        keterangan: shohibulId, // referensi ke shohibul_qurban.id
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kupon-shohibul-map"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Generate kupon massal untuk semua shohibul yang belum punya kupon
  const generateAllKuponShohibul = async () => {
    if (!shohibulList) return;
    let sapiIdx = (shohibulSapi.length > 0 ? Object.values(kuponShohibulMap ?? {}).filter(k => k.nomor_kupon?.startsWith("SS")).length : 0);
    let kambingIdx = (shohibulKambing.length > 0 ? Object.values(kuponShohibulMap ?? {}).filter(k => k.nomor_kupon?.startsWith("SK")).length : 0);
    let generated = 0;
    for (const s of shohibulSapi) {
      if (!kuponShohibulMap?.[s.id]) {
        sapiIdx++;
        await ensureKuponShohibulMutation.mutateAsync({ shohibulId: s.id, nama: s.nama, jenis: "sapi", index: sapiIdx });
        generated++;
      }
    }
    for (const s of shohibulKambing) {
      if (!kuponShohibulMap?.[s.id]) {
        kambingIdx++;
        await ensureKuponShohibulMutation.mutateAsync({ shohibulId: s.id, nama: s.nama, jenis: "kambing", index: kambingIdx });
        generated++;
      }
    }
    if (generated > 0) toast.success(`${generated} kupon shohibul berhasil digenerate`);
    else toast.info("Semua shohibul sudah punya kupon");
  };


  // ── Mutations mustahiq ────────────────────────────────────────────────────
  const addMutation = useMutation({
    mutationFn: async () => {
      const nextIndex = (mustahiqList?.length ?? 0) + 1;
      const nomor = generateNomorKupon(nextIndex);
      const { error } = await supabase.from("mustahiq").insert({
        nama: formNama,
        kategori: formKategori,
        keterangan: formKeterangan || null,
        nama_penyalur: formPenyalur || null,
        nomor_kupon: nomor,
        qr_data: nomor,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mustahiq-list"] });
      setShowAdd(false);
      setFormNama(""); setFormKeterangan(""); setFormPenyalur("");
      toast.success("Mustahiq berhasil ditambahkan");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const scanMutation = useMutation({
    mutationFn: async (qrData: string) => {
      const { data: found } = await supabase
        .from("mustahiq")
        .select("id, nama, status_kupon, nomor_kupon, kategori")
        .eq("qr_data", qrData)
        .single();
      if (!found) throw new Error("Kupon tidak ditemukan");
      if (found.status_kupon === "sudah_ambil") throw new Error(`${found.nama} sudah mengambil kupon ini`);
      const { error } = await supabase.from("mustahiq").update({ status_kupon: "sudah_ambil" }).eq("id", found.id);
      if (error) throw error;
      return { nama: found.nama, nomor_kupon: found.nomor_kupon ?? "", kategori: found.kategori };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["mustahiq-list"] });
      queryClient.invalidateQueries({ queryKey: ["kupon-shohibul-map"] });
      setScanResult(result); setScanState("success");
    },
    onError: (err: any) => { setScanError(err.message); setScanState("error"); },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === "sudah_ambil" ? "belum_ambil" : "sudah_ambil";
      const { error } = await supabase.from("mustahiq").update({ status_kupon: newStatus as any }).eq("id", id);
      if (error) throw error;
      return newStatus;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["mustahiq-list"] });
      queryClient.invalidateQueries({ queryKey: ["kupon-shohibul-map"] });
      toast.success(newStatus === "sudah_ambil" ? "Ditandai sudah ambil" : "Status dikembalikan ke belum ambil");
    },
    onError: (err: any) => toast.error(err.message),
  });


  // ── Scanner ──────────────────────────────────────────────────────────────
  const stoppingRef = useRef(false);
  const stopScanner = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    try {
      const inst = scannerRef.current;
      if (inst) {
        scannerRef.current = null;
        try { if (inst.getState?.() === 2) await inst.stop(); } catch (_) {}
        try { inst.clear(); } catch (_) {}
      }
    } finally { stoppingRef.current = false; }
  }, []);

  const resetScanState = useCallback(() => {
    isScanProcessingRef.current = false;
    setScanState("scanning"); setScanResult(null); setScanError("");
  }, []);

  useEffect(() => {
    if (!showScanner || scanState !== "scanning") return;
    let scanner: any;
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      scanner = new Html5Qrcode("qr-reader");
      scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decoded: string) => {
          if (isScanProcessingRef.current) return;
          isScanProcessingRef.current = true;
          try { if (scanner.getState?.() === 2) await scanner.stop(); } catch { isScanProcessingRef.current = false; return; }
          if (scannerRef.current === scanner) scannerRef.current = null;
          scanMutation.mutate(decoded);
        },
        () => {}
      ).then(() => { scannerRef.current = scanner; })
       .catch(() => { isScanProcessingRef.current = false; toast.error("Tidak bisa mengakses kamera"); });
    });
    return () => { stopScanner(); };
  }, [showScanner, scanState, scanKey, stopScanner]);

  const handleScanAgain = () => { resetScanState(); setScanKey((k) => k + 1); };
  const handleCloseScanDialog = async (open: boolean) => {
    if (!open) { await stopScanner(); resetScanState(); }
    setShowScanner(open);
  };

  // ── Cetak PDF ─────────────────────────────────────────────────────────────
  const cetakKuponList = async (list: { id: string; nomor_kupon: string | null }[], filename: string) => {
    if (!list.length) return;
    const doc = new jsPDF({ unit: "mm", format: [210, 330], orientation: "portrait" });
    const pageW = 190; const marginX = 10; const marginY = 10; const gap = 5; const pageH = 330;
    let currentY = marginY; let firstOnPage = true;
    for (let i = 0; i < list.length; i++) {
      const el = document.getElementById(`kupon-${list[i].id}`);
      if (!el) continue;
      el.style.display = "block";
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true, width: 420, height: 160 });
      el.style.display = "none";
      const imgData = canvas.toDataURL("image/png");
      const ratio = canvas.height / canvas.width;
      const imgH = pageW * ratio;
      if (!firstOnPage && currentY + imgH > pageH - marginY) { doc.addPage([210, 330]); currentY = marginY; firstOnPage = true; }
      doc.addImage(imgData, "PNG", marginX, currentY, pageW, imgH);
      currentY += imgH + gap; firstOnPage = false;
    }
    doc.save(filename);
    toast.success(`PDF berhasil diunduh (${list.length} kupon)`);
  };

  const unduhSingleKupon = async (item: { id: string; nomor_kupon: string | null; nama?: string }) => {
    const el = document.getElementById(`kupon-${item.id}`);
    if (!el) return;
    el.style.display = "block";
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", width: 420, height: 160 });
    el.style.display = "none";
    const w = 95; const h = w * (canvas.height / canvas.width);
    const doc = new jsPDF({ unit: "mm", format: [w, h] });
    doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, w, h);
    doc.save(`kupon-${item.nomor_kupon ?? item.id}.pdf`);
  };

  const handleImport = async (rows: Record<string, any>[]) => {
    const currentCount = mustahiqList?.length ?? 0;
    const inserts = rows.map((r, i) => {
      const nomor = generateNomorKupon(currentCount + i + 1);
      const kat = VALID_KATEGORI.has(r.kategori?.toLowerCase?.().trim()) ? r.kategori.toLowerCase().trim() as KategoriMustahiq : "lainnya" as KategoriMustahiq;
      return { nama: String(r.nama).trim(), kategori: kat, nama_penyalur: r.nama_penyalur ? String(r.nama_penyalur).trim() : null, keterangan: r.keterangan ? String(r.keterangan).trim() : null, nomor_kupon: nomor, qr_data: nomor };
    });
    const { error } = await supabase.from("mustahiq").insert(inserts);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["mustahiq-list"] });
    toast.success(`${inserts.length} mustahiq berhasil diimport`);
  };


  // ── Helpers ───────────────────────────────────────────────────────────────
  const previewMustahiq = showPreview ? mustahiqList?.find((m) => m.id === showPreview) : null;

  const filteredMustahiq = mustahiqList?.filter((m) =>
    m.kategori !== "shohibul_qurban" &&
    (m.nama.toLowerCase().includes(search.toLowerCase()) || (m.nomor_kupon ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  const sudahAmbil = mustahiqList?.filter((m) => m.kategori !== "shohibul_qurban" && m.status_kupon === "sudah_ambil").length ?? 0;
  const totalMustahiq = mustahiqList?.filter((m) => m.kategori !== "shohibul_qurban").length ?? 0;

  // Shohibul dengan info kupon, difilter search
  const enrichShohibul = (list: typeof shohibulList) =>
    (list ?? [])
      .map((s) => ({ ...s, kupon: kuponShohibulMap?.[s.id] ?? null }))
      .filter((s) => s.nama.toLowerCase().includes(searchShohibul.toLowerCase()) ||
        (s.kupon?.nomor_kupon ?? "").toLowerCase().includes(searchShohibul.toLowerCase()));

  const shohibulSapiEnriched = enrichShohibul(shohibulSapi);
  const shohibulKambingEnriched = enrichShohibul(shohibulKambing);

  const sudahAmbilShohibul = Object.values(kuponShohibulMap ?? {}).filter(k => k.status_kupon === "sudah_ambil").length;
  const totalKuponShohibul = Object.values(kuponShohibulMap ?? {}).length;

  const renderStatusBadge = (status: string, id: string, canEdit: boolean) => {
    const isSudah = status === "sudah_ambil";
    const badge = (
      <Badge
        variant={isSudah ? "default" : "outline"}
        className={isSudah
          ? "bg-success/10 text-success border-success/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-colors"
          : "hover:bg-success/10 hover:text-success hover:border-success/20 transition-colors"}
      >
        {isSudah ? "Sudah Ambil" : "Belum Ambil"}
      </Badge>
    );
    if (!canEdit) return badge;
    return (
      <button onClick={() => toggleStatusMutation.mutate({ id, currentStatus: status })} disabled={toggleStatusMutation.isPending} className="cursor-pointer">
        {badge}
      </button>
    );
  };


  // ── Render tabel shohibul ─────────────────────────────────────────────────
  const renderShohibulTable = (list: ReturnType<typeof enrichShohibul>, jenis: "sapi" | "kambing") => {
    const canEdit = hasRole(["super_admin", "admin_kupon"]);
    return (
      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Kupon</TableHead>
              <TableHead>Nama Shohibul</TableHead>
              <TableHead>Hewan</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead>Status Kupon</TableHead>
              <TableHead className="w-12">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Belum ada data shohibul {jenis}
                </TableCell>
              </TableRow>
            )}
            {list.map((s, idx) => (
              <TableRow key={s.id}>
                <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                <TableCell className="font-mono text-xs">
                  {s.kupon?.nomor_kupon ?? <span className="text-muted-foreground italic text-xs">Belum ada</span>}
                </TableCell>
                <TableCell className="font-medium">{s.nama}</TableCell>
                <TableCell className="text-sm text-muted-foreground capitalize">
                  {(s.hewan_qurban as any)?.nomor_urut ? `${jenis} - ${(s.hewan_qurban as any).nomor_urut}` : jenis}
                </TableCell>
                <TableCell className="capitalize text-sm">{s.tipe_kepemilikan}</TableCell>
                <TableCell>
                  {s.kupon
                    ? renderStatusBadge(s.kupon.status_kupon, s.kupon.id, canEdit)
                    : <Badge variant="outline" className="text-xs text-muted-foreground">Kupon belum digenerate</Badge>
                  }
                </TableCell>
                <TableCell>
                  {s.kupon && (
                    <Button size="sm" variant="ghost" onClick={() => setShowPreviewShohibul(s.kupon!.id)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };


  const previewShohibulKupon = showPreviewShohibul
    ? Object.values(kuponShohibulMap ?? {}).find((k) => k.id === showPreviewShohibul)
    : null;

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Mustahiq & Shohibul · Kupon</h1>
          <p className="page-subtitle">
            Mustahiq: {sudahAmbil}/{totalMustahiq} sudah ambil ·
            Shohibul: {sudahAmbilShohibul}/{totalKuponShohibul} sudah ambil
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {hasRole(["super_admin", "admin_kupon"]) && (
            <Button variant="outline" onClick={() => { setScanKey((k) => k + 1); setShowScanner(true); }}>
              <ScanLine className="mr-2 h-4 w-4" /> Scan QR
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="mustahiq">Mustahiq ({totalMustahiq})</TabsTrigger>
          <TabsTrigger value="shohibul">Shohibul Qurban ({shohibulList?.length ?? 0})</TabsTrigger>
        </TabsList>

        {/* ── TAB MUSTAHIQ ─────────────────────────────────────────────── */}
        <TabsContent value="mustahiq" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari nama / kupon..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => cetakKuponList(filteredMustahiq ?? [], "kupon-mustahiq-1447H.pdf")}>
                <Printer className="mr-2 h-4 w-4" /> Cetak PDF
              </Button>
              {isAdmin() && (
                <>
                  <Button variant="outline" onClick={() => setShowImport(true)}>
                    <FileUp className="mr-2 h-4 w-4" /> Import Excel
                  </Button>
                  <Button onClick={() => setShowAdd(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Tambah
                  </Button>
                </>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
          ) : (
            <>
              <div className="table-container">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Kupon</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMustahiq?.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Belum ada data mustahiq</TableCell></TableRow>
                    )}
                    {filteredMustahiq?.map((m, idx) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-mono text-xs">{m.nomor_kupon}</TableCell>
                        <TableCell className="font-medium">{m.nama}</TableCell>
                        <TableCell className="capitalize">{m.kategori?.replace(/_/g, " ")}</TableCell>
                        <TableCell>{renderStatusBadge(m.status_kupon, m.id, hasRole(["super_admin", "admin_kupon"]))}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => setShowPreview(m.id)}><Eye className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {hasRole(["super_admin", "admin_kupon"]) && (
                <p className="text-xs text-muted-foreground mt-2">💡 Klik status untuk toggle manual</p>
              )}
            </>
          )}
        </TabsContent>


        {/* ── TAB SHOHIBUL ─────────────────────────────────────────────── */}
        <TabsContent value="shohibul" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari nama / kupon..." className="pl-10" value={searchShohibul} onChange={(e) => setSearchShohibul(e.target.value)} />
            </div>
            <div className="flex gap-2 flex-wrap">
              {isAdmin() && (
                <Button variant="outline" onClick={generateAllKuponShohibul} disabled={ensureKuponShohibulMutation.isPending}>
                  <Plus className="mr-2 h-4 w-4" /> Generate Semua Kupon
                </Button>
              )}
              <Button variant="outline" onClick={() => {
                const allKuponShohibul = Object.values(kuponShohibulMap ?? {});
                cetakKuponList(allKuponShohibul, "kupon-shohibul-1447H.pdf");
              }}>
                <Printer className="mr-2 h-4 w-4" /> Cetak PDF Semua
              </Button>
            </div>
          </div>

          {isLoadingShohibul ? (
            <div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
          ) : (
            <Tabs defaultValue="sapi">
              <TabsList>
                <TabsTrigger value="sapi">🐄 Sapi ({shohibulSapi.length})</TabsTrigger>
                <TabsTrigger value="kambing">🐐 Kambing ({shohibulKambing.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="sapi" className="mt-4">
                <div className="flex justify-end mb-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    const kuponSapi = shohibulSapiEnriched.filter(s => s.kupon).map(s => s.kupon!);
                    cetakKuponList(kuponSapi, "kupon-shohibul-sapi.pdf");
                  }}>
                    <Printer className="mr-2 h-3 w-3" /> Cetak Kupon Sapi
                  </Button>
                </div>
                {renderShohibulTable(shohibulSapiEnriched, "sapi")}
              </TabsContent>
              <TabsContent value="kambing" className="mt-4">
                <div className="flex justify-end mb-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    const kuponKambing = shohibulKambingEnriched.filter(s => s.kupon).map(s => s.kupon!);
                    cetakKuponList(kuponKambing, "kupon-shohibul-kambing.pdf");
                  }}>
                    <Printer className="mr-2 h-3 w-3" /> Cetak Kupon Kambing
                  </Button>
                </div>
                {renderShohibulTable(shohibulKambingEnriched, "kambing")}
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>
      </Tabs>


      {/* Hidden kupon templates untuk PDF — mustahiq */}
      <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
        {mustahiqList?.filter(m => m.kategori !== "shohibul_qurban").map((m) => (
          <KuponTemplate key={m.id} id={m.id} nomor_kupon={m.nomor_kupon} nama={m.nama} kategori={m.kategori} qr_data={m.qr_data} />
        ))}
        {/* Hidden kupon templates untuk PDF — shohibul */}
        {Object.values(kuponShohibulMap ?? {}).map((k) => (
          <KuponTemplate
            key={k.id} id={k.id} nomor_kupon={k.nomor_kupon} nama={k.nama}
            kategori="shohibul_qurban" qr_data={k.qr_data}
            jenis_hewan={k.nomor_kupon?.startsWith("SS") ? "sapi" : k.nomor_kupon?.startsWith("SK") ? "kambing" : null}
          />
        ))}
      </div>

      {/* Dialog Tambah Mustahiq */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tambah Mustahiq</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nama *</Label><Input value={formNama} onChange={(e) => setFormNama(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={formKategori} onValueChange={(v) => setFormKategori(v as KategoriMustahiq)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KATEGORI_OPTIONS.filter(k => k !== "shohibul_qurban").map((k) => (
                    <SelectItem key={k} value={k} className="capitalize">{k.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Nama Penyalur</Label><Input value={formPenyalur} onChange={(e) => setFormPenyalur(e.target.value)} placeholder="Opsional" /></div>
            <div className="space-y-2"><Label>Keterangan</Label><Input value={formKeterangan} onChange={(e) => setFormKeterangan(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Batal</Button>
            <Button onClick={() => addMutation.mutate()} disabled={!formNama || addMutation.isPending}>
              {addMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Dialog Preview Kupon Mustahiq */}
      <Dialog open={!!showPreview} onOpenChange={() => setShowPreview(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Preview Kupon Mustahiq</DialogTitle></DialogHeader>
          {previewMustahiq && (
            <div className="space-y-4">
              <div className="border rounded-lg p-4 text-center space-y-2">
                <p className="font-bold text-lg">Kupon Daging Qurban 1447H</p>
                <p className="text-sm text-muted-foreground">Masjid At-Tauhid Pangkalpinang</p>
                <div className="flex justify-center py-2">
                  <QRCodeCanvas value={previewMustahiq.qr_data ?? previewMustahiq.nomor_kupon ?? previewMustahiq.id} size={150} />
                </div>
                <p className="font-mono text-sm">{previewMustahiq.nomor_kupon}</p>
                <p className="font-medium">{previewMustahiq.nama}</p>
                <p className="text-sm capitalize text-muted-foreground">{previewMustahiq.kategori?.replace(/_/g, " ")}</p>
              </div>
              <Button className="w-full" variant="outline" onClick={() => unduhSingleKupon(previewMustahiq)}>
                <Download className="mr-2 h-4 w-4" /> Unduh kupon ini
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Preview Kupon Shohibul */}
      <Dialog open={!!showPreviewShohibul} onOpenChange={() => setShowPreviewShohibul(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Preview Kupon Shohibul</DialogTitle></DialogHeader>
          {previewShohibulKupon && (
            <div className="space-y-4">
              <div className="border rounded-lg p-4 text-center space-y-2">
                <p className="font-bold text-lg">Kupon Shohibul Qurban 1447H</p>
                <p className="text-sm text-muted-foreground">Masjid At-Tauhid Pangkalpinang</p>
                <p className="text-xs text-muted-foreground">
                  {previewShohibulKupon.nomor_kupon?.startsWith("SS") ? "🐄 Sapi" : "🐐 Kambing"}
                </p>
                <div className="flex justify-center py-2">
                  <QRCodeCanvas value={previewShohibulKupon.qr_data ?? previewShohibulKupon.nomor_kupon ?? previewShohibulKupon.id} size={150} />
                </div>
                <p className="font-mono text-sm">{previewShohibulKupon.nomor_kupon}</p>
                <p className="font-medium">{previewShohibulKupon.nama}</p>
                <Badge variant="outline" className="text-xs">Shohibul Qurban</Badge>
              </div>
              <Button className="w-full" variant="outline" onClick={() => unduhSingleKupon(previewShohibulKupon)}>
                <Download className="mr-2 h-4 w-4" /> Unduh kupon ini
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* Dialog QR Scanner */}
      <Dialog open={showScanner} onOpenChange={handleCloseScanDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Scan Kupon QR</DialogTitle></DialogHeader>
          <div id="qr-reader" key={scanKey} className="w-full" style={{ display: scanState === "scanning" ? "block" : "none" }} />
          {scanState === "success" && scanResult && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <p className="text-xl font-bold">{scanResult.nama}</p>
              <p className="font-mono text-sm text-muted-foreground">{scanResult.nomor_kupon}</p>
              <Badge className="capitalize">{scanResult.kategori.replace(/_/g, " ")}</Badge>
              <p className="text-sm text-green-600 font-medium">Kupon berhasil diverifikasi!</p>
              <div className="flex gap-2 w-full mt-2">
                <Button variant="outline" className="flex-1" onClick={handleScanAgain}>Scan Berikutnya</Button>
                <Button className="flex-1" onClick={() => handleCloseScanDialog(false)}>Selesai</Button>
              </div>
            </div>
          )}
          {scanState === "error" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <XCircle className="h-16 w-16 text-red-500" />
              <p className="text-sm text-destructive text-center">{scanError}</p>
              <div className="flex gap-2 w-full mt-2">
                <Button variant="outline" className="flex-1" onClick={handleScanAgain}>Coba Lagi</Button>
                <Button className="flex-1" onClick={() => handleCloseScanDialog(false)}>Tutup</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Import Excel */}
      <ImportExcelDialog
        open={showImport} onOpenChange={setShowImport}
        title="Import Mustahiq dari Excel"
        columns={[
          { key: "nama", label: "Nama", required: true },
          { key: "kategori", label: "Kategori", required: true },
          { key: "nama_penyalur", label: "Nama Penyalur" },
          { key: "keterangan", label: "Keterangan" },
        ]}
        templateData={[
          { nama: "Ahmad", kategori: "dhuafa", nama_penyalur: "Pak RT", keterangan: "" },
          { nama: "Fatimah", kategori: "warga", nama_penyalur: "", keterangan: "Jl. Merdeka 10" },
        ]}
        templateFileName="template-mustahiq.xlsx"
        validateRow={(r) => !!r.nama && String(r.nama).trim() !== ""}
        onImport={handleImport}
      />
    </div>
  );
};

export default MustahiqPage;
