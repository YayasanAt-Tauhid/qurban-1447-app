import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Printer, ScanLine, Eye, FileUp, FileDown, CheckCircle2, XCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { generateNomorKupon } from "@/lib/qurban-utils";
import { QRCodeCanvas } from "qrcode.react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useAuth } from "@/hooks/useAuth";
import KuponTemplate from "@/components/KuponTemplate";
import ImportExcelDialog from "@/components/ImportExcelDialog";

// ─── Types ───────────────────────────────────────────────────────────────────
type StatusWarga   = "warga" | "bukan_warga" | null;
type StatusJamaah  = "jamaah" | "bukan_jamaah" | null;
type StatusPanitia = "panitia" | "bukan_panitia" | null;
type StatusLainnya   = "dhuafa" | "shohibul_qurban" | null;
type StatusPengambilan = "belum_ambil" | "sudah_ambil";
type ScanState       = "scanning" | "success" | "error";
type MainTab         = "mustahiq" | "shohibul";

interface MustahiqRow {
  id: string;
  tahun: number;
  nomor_kupon: string | null;
  nama: string;
  status_warga: StatusWarga;
  status_jamaah: StatusJamaah;
  status_panitia: StatusPanitia;
  status_lainnya: StatusLainnya;
  status_kupon: StatusPengambilan;
  nama_penyalur: string | null;
  keterangan: string | null;
  created_at: string;
}

interface FormData {
  nama: string;
  status_warga: StatusWarga;
  status_jamaah: StatusJamaah;
  status_panitia: StatusPanitia;
  status_lainnya: StatusLainnya;
  nama_penyalur: string;
  keterangan: string;
}

const EMPTY_FORM: FormData = {
  nama: "",
  status_warga: null,
  status_jamaah: null,
  status_panitia: null,
  status_lainnya: null,
  nama_penyalur: "",
  keterangan: "",
};

// ─── Excel helpers ────────────────────────────────────────────────────────────
function rowToExcel(m: MustahiqRow, no: number) {
  return {
    "No": no,
    "Nomor Kupon": m.nomor_kupon ?? "",
    "Nama Penerima": m.nama,
    "Status Warga":   m.status_warga   === "warga"        ? "Warga"
                    : m.status_warga   === "bukan_warga"   ? "Bukan Warga" : "",
    "Status Jama'ah": m.status_jamaah  === "jamaah"       ? "Jama'ah"
                    : m.status_jamaah  === "bukan_jamaah"  ? "Bukan Jama'ah" : "",
    "Status Panitia": m.status_panitia === "panitia"      ? "Panitia"
                    : m.status_panitia === "bukan_panitia" ? "Bukan Panitia" : "",
    "Status Lainnya": m.status_lainnya === "dhuafa" ? "Dhu'afa" : "",
    "Penyalur": m.nama_penyalur ?? "",
    "Status Pengambilan": m.status_kupon === "sudah_ambil" ? "Sudah Ambil" : "Belum Ambil",
  };
}

function rowToExcelShohibul(m: MustahiqRow, no: number) {
  return {
    "No": no,
    "Nomor Kupon": m.nomor_kupon ?? "",
    "Nama Shohibul": m.nama,
    "Hewan Qurban": m.keterangan ?? "",
    "Status Pengambilan": m.status_kupon === "sudah_ambil" ? "Sudah Ambil" : "Belum Ambil",
  };
}


function excelToForm(row: Record<string, any>): Omit<FormData, "keterangan"> | null {
  const nama = String(row["Nama Penerima"] ?? "").trim();
  if (!nama) return null;

  const sw = String(row["Status Warga"] ?? "").trim().toLowerCase();
  const sj = String(row["Status Jama'ah"] ?? "").trim().toLowerCase();
  const sp = String(row["Status Panitia"] ?? "").trim().toLowerCase();
  const sl = String(row["Status Lainnya"] ?? "").trim().toLowerCase();

  return {
    nama,
    status_warga:   sw.includes("bukan") ? "bukan_warga"   : sw ? "warga"   : null,
    status_jamaah:  sj.includes("bukan") ? "bukan_jamaah"  : sj ? "jamaah"  : null,
    status_panitia: sp.includes("bukan") ? "bukan_panitia" : sp ? "panitia" : null,
    status_lainnya: sl.includes("dhu") ? "dhuafa" : null,
    nama_penyalur:  String(row["Penyalur"] ?? "").trim(),
  };
}

const IMPORT_COLS = [
  { key: "Nama Penerima",  label: "Nama Penerima",  required: true },
  { key: "Status Warga",   label: "Status Warga"   },
  { key: "Status Jama'ah", label: "Status Jama'ah" },
  { key: "Status Panitia", label: "Status Panitia" },
  { key: "Status Lainnya", label: "Status Lainnya" },
  { key: "Penyalur",       label: "Penyalur"       },
];

const IMPORT_TEMPLATE = [
  { "Nama Penerima": "Ahmad Fauzi",   "Status Warga": "Warga",       "Status Jama'ah": "Jama'ah",      "Status Panitia": "",          "Status Lainnya": "",       "Penyalur": "Pak RT"   },
  { "Nama Penerima": "Siti Aminah",   "Status Warga": "Bukan Warga", "Status Jama'ah": "Bukan Jama'ah","Status Panitia": "Panitia",   "Status Lainnya": "Dhu'afa","Penyalur": ""         },
  { "Nama Penerima": "Hasan bin Ali", "Status Warga": "",            "Status Jama'ah": "",              "Status Panitia": "Bukan Panitia","Status Lainnya": "",    "Penyalur": "Pak Lurah"},
];

// ─── Badge helpers ────────────────────────────────────────────────────────────
function StatusBadge({ value, labels }: { value: string | null; labels: [string, string, string] }) {
  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  const [pos, neg] = [labels[0], labels[1]];
  const isPos = !value.startsWith("bukan_") && value !== null;
  return (
    <Badge variant={isPos ? "default" : "secondary"} className="text-xs">
      {isPos ? pos : neg}
    </Badge>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const MustahiqPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [mainTab, setMainTab] = useState<MainTab>("mustahiq");
  const [pageMustahiq, setPageMustahiq] = useState(1);
  const [pageShohibul, setPageShohibul] = useState(1);
  const PAGE_SIZE = 25;
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showKupon, setShowKupon] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [scanKey, setScanKey] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState<MustahiqRow | null>(null);
  const [scanState, setScanState] = useState<ScanState>("scanning");
  const [scanError, setScanError] = useState("");
  const [scanResult, setScanResult] = useState<any>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const kuponRef = useRef<HTMLDivElement>(null);

  // ── Queries ──
  const { data: mustahiqList = [], isLoading: loadingMustahiq } = useQuery({
    queryKey: ["mustahiq"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mustahiq").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MustahiqRow[];
    },
  });

  const { data: shohibulList = [], isLoading: loadingShohibul } = useQuery({
    queryKey: ["mustahiq_shohibul"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mustahiq").select("*").eq("status_lainnya", "shohibul_qurban").order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MustahiqRow[];
    },
  });

  const { data: kuponList = [] } = useQuery({
    queryKey: ["kupon_qurban"],
    queryFn: async () => {
      const { data, error } = await supabase.from("kupon_qurban").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Mutations ──
  const addMutation = useMutation({
    mutationFn: async (values: FormData) => {
      const { data: existingQM } = await supabase
        .from("mustahiq")
        .select("nomor_kupon")
        .like("nomor_kupon", "QM-%");
      const nextNo = (existingQM?.length ?? 0) + 1;
      const nomor_kupon = generateNomorKupon(nextNo);
      const { error } = await supabase.from("mustahiq").insert({ ...values, nomor_kupon });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["mustahiq"] }); toast.success("Mustahiq ditambahkan"); setShowAdd(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: async (values: FormData) => {
      const { error } = await supabase.from("mustahiq").update(values).eq("id", selected!.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["mustahiq"] }); queryClient.invalidateQueries({ queryKey: ["mustahiq_shohibul"] }); toast.success("Data diperbarui"); setShowEdit(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mustahiq").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["mustahiq"] }); queryClient.invalidateQueries({ queryKey: ["mustahiq_shohibul"] }); toast.success("Data dihapus"); },
    onError: (e: any) => toast.error(e.message),
  });

  const verifyKuponMutation = useMutation({
    mutationFn: async (input: string) => {
      // cari berdasarkan nomor_kupon atau qr_data
      const { data, error } = await supabase
        .from("mustahiq")
        .select("*")
        .or(`nomor_kupon.eq.${input},qr_data.eq.${input}`)
        .single();
      if (error || !data) throw new Error("Kupon tidak ditemukan");
      if (data.status_kupon === "sudah_ambil") throw new Error(`${data.nama} sudah mengambil daging`);
      const { error: updateError } = await supabase
        .from("mustahiq")
        .update({ status_kupon: "sudah_ambil" })
        .eq("id", data.id);
      if (updateError) throw updateError;
      return data;
    },
    onSuccess: (data) => { setScanResult(data); setScanState("success"); queryClient.invalidateQueries({ queryKey: ["mustahiq"] }); queryClient.invalidateQueries({ queryKey: ["mustahiq_shohibul"] }); },
    onError: (e: any) => { setScanError(e.message); setScanState("error"); },
  });

  // ── Helpers ──
  const filteredMustahiq = mustahiqList.filter((m) =>
    m.status_lainnya !== "shohibul_qurban" &&
    (!search || m.nama?.toLowerCase().includes(search.toLowerCase()) || m.nomor_kupon?.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredShohibul = shohibulList.filter((m) =>
    !search || m.nama?.toLowerCase().includes(search.toLowerCase()) || m.nomor_kupon?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPagesMustahiq = Math.max(1, Math.ceil(filteredMustahiq.length / PAGE_SIZE));
  const totalPagesShohibul = Math.max(1, Math.ceil(filteredShohibul.length / PAGE_SIZE));
  const pagedMustahiq = filteredMustahiq.slice((pageMustahiq - 1) * PAGE_SIZE, pageMustahiq * PAGE_SIZE);
  const pagedShohibul = filteredShohibul.slice((pageShohibul - 1) * PAGE_SIZE, pageShohibul * PAGE_SIZE);
  const offsetMustahiq = (pageMustahiq - 1) * PAGE_SIZE;
  const offsetShohibul = (pageShohibul - 1) * PAGE_SIZE;

  const togglePengambilan = useMutation({
    mutationFn: async (m: MustahiqRow) => {
      const next: StatusPengambilan = m.status_kupon === "sudah_ambil" ? "belum_ambil" : "sudah_ambil";
      const { error } = await supabase.from("mustahiq").update({ status_kupon: next }).eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["mustahiq"] }); queryClient.invalidateQueries({ queryKey: ["mustahiq_shohibul"] }); toast.success("Status pengambilan diperbarui"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (m: MustahiqRow) => { setSelected(m); setForm({ nama: m.nama, status_warga: m.status_warga, status_jamaah: m.status_jamaah, status_panitia: m.status_panitia, status_lainnya: m.status_lainnya, nama_penyalur: m.nama_penyalur ?? "", keterangan: m.keterangan ?? "" }); setShowEdit(true); };
  const openKupon = (m: MustahiqRow) => { setSelected(m); setShowKupon(true); };
  const handleScanAgain = () => { setScanState("scanning"); setScanResult(null); setScanError(""); setScanKey((k) => k + 1); };
  const handleCloseScan = (open: boolean) => { if (!open) { setScanState("scanning"); setScanResult(null); setScanError(""); } setShowScan(open); };

  // ── QR Scanner via html5-qrcode ──
  const scanningRef = useRef(false);

  useEffect(() => {
    if (!showScan || scanState !== "scanning") return;
    scanningRef.current = false;
    let scanner: any;
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      scanner = new Html5Qrcode("qr-reader");
      scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          if (scanningRef.current) return; // cegah scan ganda
          scanningRef.current = true;
          scanner.stop().catch(() => {});
          verifyKuponMutation.mutate(decodedText);
        },
        () => {}
      ).catch(() => {});
    });
    return () => {
      if (scanner) { try { scanner.stop().then(() => scanner.clear()).catch(() => {}); } catch { /* ignore */ } }
    };
  }, [showScan, scanState, scanKey]);
  const kuponMustahiq = selected ? kuponList.find((k: any) => k.mustahiq_id === selected.id) : null;

  const handleExport = () => {
    const rows = filteredMustahiq.map((m, i) => rowToExcel(m, i + 1));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 4 }, { wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mustahiq");
    XLSX.writeFile(wb, `mustahiq-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Export berhasil");
  };

  const handleExportShohibul = () => {
    const rows = filteredShohibul.map((m, i) => rowToExcelShohibul(m, i + 1));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 4 }, { wch: 14 }, { wch: 28 }, { wch: 20 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Shohibul Qurban");
    XLSX.writeFile(wb, `shohibul-qurban-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Export berhasil");
  };

  const handleImport = async (rows: Record<string, any>[]) => {
    const mapped = rows.map(excelToForm).filter(Boolean);
    if (!mapped.length) throw new Error("Tidak ada data valid");
    const { data: existingQM } = await supabase
      .from("mustahiq")
      .select("nomor_kupon")
      .like("nomor_kupon", "QM-%");
    const baseNo = existingQM?.length ?? 0;
    let added = 0;
    for (let i = 0; i < mapped.length; i++) {
      const m = mapped[i]!;
      const nomor_kupon = generateNomorKupon(baseNo + i + 1);
      const { error } = await supabase.from("mustahiq").insert({ ...m, keterangan: "", nomor_kupon });
      if (!error) added++;
    }
    queryClient.invalidateQueries({ queryKey: ["mustahiq"] });
    toast.success(`${added} mustahiq berhasil diimport`);
  };

  const handlePrintKupon = async () => {
    if (!kuponRef.current) return;
    const canvas = await html2canvas(kuponRef.current, { scale: 2 });
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [100, 60] });
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 100, 60);
    pdf.save(`kupon-${selected?.nomor_kupon ?? "kupon"}.pdf`);
  };

  // ── Form Select helper ──
  const SF = <T extends string | null>({ label, value, options, onChange }: {
    label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
  }) => (
    <div>
      <Label>{label}</Label>
      <Select value={value ?? "__null__"} onValueChange={(v) => onChange((v === "__null__" ? null : v) as T)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__null__">— Kosong —</SelectItem>
          {options.map((o) => <SelectItem key={String(o.value)} value={String(o.value)}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Pengambilan Daging</h1>
        <div className="flex gap-2 flex-wrap">
          {mainTab === "mustahiq" && <>
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)}><FileUp className="mr-1 h-4 w-4" />Import</Button>
            <Button variant="outline" size="sm" onClick={handleExport}><FileDown className="mr-1 h-4 w-4" />Export</Button>
          </>}
          {mainTab === "shohibul" && (
            <Button variant="outline" size="sm" onClick={handleExportShohibul}><FileDown className="mr-1 h-4 w-4" />Export</Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowScan(true)}><ScanLine className="mr-1 h-4 w-4" />Scan Kupon</Button>
          {mainTab === "mustahiq" && (
            <Button size="sm" onClick={() => { setForm(EMPTY_FORM); setShowAdd(true); }}><Plus className="mr-1 h-4 w-4" />Tambah</Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cari nama / nomor kupon..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPageMustahiq(1); setPageShohibul(1); }} />
      </div>

      {/* Main Tabs: Mustahiq | Shohibul Qurban */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as MainTab)}>
        <TabsList>
          <TabsTrigger value="mustahiq">Mustahiq ({mustahiqList.filter(m => m.status_lainnya !== "shohibul_qurban").length})</TabsTrigger>
          <TabsTrigger value="shohibul">Shohibul Qurban ({shohibulList.length})</TabsTrigger>
        </TabsList>

        {/* ── Tab Mustahiq ── */}
        <TabsContent value="mustahiq" className="mt-4">
          {loadingMustahiq ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">No</TableHead>
                    <TableHead>Nama Penerima</TableHead>
                    <TableHead>Status Warga</TableHead>
                    <TableHead>Status Jama'ah</TableHead>
                    <TableHead>Status Panitia</TableHead>
                    <TableHead>Status Lainnya</TableHead>
                    <TableHead>Penyalur</TableHead>
                    <TableHead>No Kupon</TableHead>
                    <TableHead>Pengambilan</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMustahiq.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Belum ada data</TableCell></TableRow>
                  ) : pagedMustahiq.map((m, i) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{offsetMustahiq + i + 1}</TableCell>
                      <TableCell className="font-medium">{m.nama}</TableCell>
                      <TableCell><StatusBadge value={m.status_warga} labels={["Warga", "Bukan Warga", ""]} /></TableCell>
                      <TableCell><StatusBadge value={m.status_jamaah} labels={["Jama'ah", "Bukan Jama'ah", ""]} /></TableCell>
                      <TableCell><StatusBadge value={m.status_panitia} labels={["Panitia", "Bukan Panitia", ""]} /></TableCell>
                      <TableCell>{m.status_lainnya === "dhuafa" ? <Badge variant="outline" className="text-xs">Dhu'afa</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-xs">{m.nama_penyalur ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="font-mono text-xs">{m.nomor_kupon ?? "—"}</Badge></TableCell>
                      <TableCell>
                        <Button
                          variant="ghost" size="sm"
                          className={m.status_kupon === "sudah_ambil" ? "text-green-600 hover:text-green-700" : "text-muted-foreground hover:text-foreground"}
                          onClick={() => togglePengambilan.mutate(m)}
                        >
                          {m.status_kupon === "sudah_ambil"
                            ? <><CheckCircle2 className="h-4 w-4 mr-1" />Sudah Ambil</>
                            : <><XCircle className="h-4 w-4 mr-1" />Belum Ambil</>}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openKupon(m)}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Printer className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if (confirm("Hapus data ini?")) deleteMutation.mutate(m.id); }}><XCircle className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Paging Mustahiq */}
            {totalPagesMustahiq > 1 && (
              <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
                <span>Halaman {pageMustahiq} dari {totalPagesMustahiq} · {filteredMustahiq.length} data</span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" disabled={pageMustahiq === 1} onClick={() => setPageMustahiq(1)}>«</Button>
                  <Button variant="outline" size="sm" disabled={pageMustahiq === 1} onClick={() => setPageMustahiq(p => p - 1)}>‹</Button>
                  <Button variant="outline" size="sm" disabled={pageMustahiq === totalPagesMustahiq} onClick={() => setPageMustahiq(p => p + 1)}>›</Button>
                  <Button variant="outline" size="sm" disabled={pageMustahiq === totalPagesMustahiq} onClick={() => setPageMustahiq(totalPagesMustahiq)}>»</Button>
                </div>
              </div>
            )}
          )}
        </TabsContent>
        <TabsContent value="shohibul" className="mt-4">
          {loadingShohibul ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">No</TableHead>
                    <TableHead>Nama Shohibul</TableHead>
                    <TableHead>Hewan Qurban</TableHead>
                    <TableHead>No Kupon</TableHead>
                    <TableHead>Pengambilan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShohibul.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Belum ada data</TableCell></TableRow>
                  ) : pagedShohibul.map((m, i) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{offsetShohibul + i + 1}</TableCell>
                      <TableCell className="font-medium">{m.nama}</TableCell>
                      <TableCell className="text-xs">{m.keterangan ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="font-mono text-xs">{m.nomor_kupon ?? "—"}</Badge></TableCell>
                      <TableCell>
                        <Button
                          variant="ghost" size="sm"
                          className={m.status_kupon === "sudah_ambil" ? "text-green-600 hover:text-green-700" : "text-muted-foreground hover:text-foreground"}
                          onClick={() => togglePengambilan.mutate(m)}
                        >
                          {m.status_kupon === "sudah_ambil"
                            ? <><CheckCircle2 className="h-4 w-4 mr-1" />Sudah Ambil</>
                            : <><XCircle className="h-4 w-4 mr-1" />Belum Ambil</>}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Paging Shohibul */}
            {totalPagesShohibul > 1 && (
              <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
                <span>Halaman {pageShohibul} dari {totalPagesShohibul} · {filteredShohibul.length} data</span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" disabled={pageShohibul === 1} onClick={() => setPageShohibul(1)}>«</Button>
                  <Button variant="outline" size="sm" disabled={pageShohibul === 1} onClick={() => setPageShohibul(p => p - 1)}>‹</Button>
                  <Button variant="outline" size="sm" disabled={pageShohibul === totalPagesShohibul} onClick={() => setPageShohibul(p => p + 1)}>›</Button>
                  <Button variant="outline" size="sm" disabled={pageShohibul === totalPagesShohibul} onClick={() => setPageShohibul(totalPagesShohibul)}>»</Button>
                </div>
              </div>
            )}
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog Tambah */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{form.status_lainnya === "shohibul_qurban" ? "Tambah Shohibul Qurban" : "Tambah Mustahiq"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nama <span className="text-destructive">*</span></Label>
              <Input value={form.nama} onChange={(e) => setForm((p) => ({ ...p, nama: e.target.value }))} />
            </div>
            <SF label="Status Warga" value={form.status_warga}
              options={[{ value: "warga", label: "Warga" }, { value: "bukan_warga", label: "Bukan Warga" }]}
              onChange={(v) => setForm((p) => ({ ...p, status_warga: v }))} />
            <SF label="Status Jama'ah" value={form.status_jamaah}
              options={[{ value: "jamaah", label: "Jama'ah" }, { value: "bukan_jamaah", label: "Bukan Jama'ah" }]}
              onChange={(v) => setForm((p) => ({ ...p, status_jamaah: v }))} />
            <SF label="Status Panitia" value={form.status_panitia}
              options={[{ value: "panitia", label: "Panitia" }, { value: "bukan_panitia", label: "Bukan Panitia" }]}
              onChange={(v) => setForm((p) => ({ ...p, status_panitia: v }))} />
            <SF label="Status Lainnya" value={form.status_lainnya}
              options={[{ value: "dhuafa", label: "Dhu'afa" }, { value: "shohibul_qurban", label: "Shohibul Qurban" }]}
              onChange={(v) => setForm((p) => ({ ...p, status_lainnya: v }))} />
            <div><Label>Nama Penyalur</Label>
              <Input value={form.nama_penyalur} onChange={(e) => setForm((p) => ({ ...p, nama_penyalur: e.target.value }))} />
            </div>
            <div><Label>Keterangan</Label>
              <Input value={form.keterangan} onChange={(e) => setForm((p) => ({ ...p, keterangan: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Batal</Button>
            <Button onClick={() => addMutation.mutate(form)} disabled={!form.nama || addMutation.isPending}>
              {addMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Edit */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{form.status_lainnya === "shohibul_qurban" ? "Edit Shohibul Qurban" : "Edit Mustahiq"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nama <span className="text-destructive">*</span></Label>
              <Input value={form.nama} onChange={(e) => setForm((p) => ({ ...p, nama: e.target.value }))} />
            </div>
            <SF label="Status Warga" value={form.status_warga}
              options={[{ value: "warga", label: "Warga" }, { value: "bukan_warga", label: "Bukan Warga" }]}
              onChange={(v) => setForm((p) => ({ ...p, status_warga: v }))} />
            <SF label="Status Jama'ah" value={form.status_jamaah}
              options={[{ value: "jamaah", label: "Jama'ah" }, { value: "bukan_jamaah", label: "Bukan Jama'ah" }]}
              onChange={(v) => setForm((p) => ({ ...p, status_jamaah: v }))} />
            <SF label="Status Panitia" value={form.status_panitia}
              options={[{ value: "panitia", label: "Panitia" }, { value: "bukan_panitia", label: "Bukan Panitia" }]}
              onChange={(v) => setForm((p) => ({ ...p, status_panitia: v }))} />
            <SF label="Status Lainnya" value={form.status_lainnya}
              options={[{ value: "dhuafa", label: "Dhu'afa" }, { value: "shohibul_qurban", label: "Shohibul Qurban" }]}
              onChange={(v) => setForm((p) => ({ ...p, status_lainnya: v }))} />
            <div><Label>Nama Penyalur</Label>
              <Input value={form.nama_penyalur} onChange={(e) => setForm((p) => ({ ...p, nama_penyalur: e.target.value }))} />
            </div>
            <div><Label>Keterangan</Label>
              <Input value={form.keterangan} onChange={(e) => setForm((p) => ({ ...p, keterangan: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Batal</Button>
            <Button onClick={() => editMutation.mutate(form)} disabled={!form.nama || editMutation.isPending}>
              {editMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Kupon */}
      <Dialog open={showKupon} onOpenChange={setShowKupon}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Kupon Mustahiq</DialogTitle></DialogHeader>
          {selected && (
            <div className="flex flex-col items-center gap-3">
              <div ref={kuponRef}><KuponTemplate mustahiq={selected} kupon={kuponMustahiq} /></div>
              <Button onClick={handlePrintKupon}><Printer className="mr-2 h-4 w-4" />Cetak Kupon</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Scan */}
      <Dialog open={showScan} onOpenChange={handleCloseScan}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Scan Kupon</DialogTitle></DialogHeader>
          {scanState === "scanning" && (
            <div>
              <div id="qr-reader" className="w-full rounded-lg overflow-hidden" />
            </div>
          )}
          {scanState === "success" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <p className="font-medium">{scanResult?.mustahiq?.nama ?? scanResult?.nama}</p>
              <p className="text-sm text-muted-foreground">{scanResult?.nomor_kupon}</p>
              <p className="text-sm text-green-600 font-medium">Kupon berhasil diverifikasi!</p>
              <div className="flex gap-2 w-full mt-2">
                <Button variant="outline" className="flex-1" onClick={handleScanAgain}>Scan Berikutnya</Button>
                <Button className="flex-1" onClick={() => handleCloseScan(false)}>Selesai</Button>
              </div>
            </div>
          )}
          {scanState === "error" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <XCircle className="h-16 w-16 text-red-500" />
              <p className="text-sm text-destructive text-center">{scanError}</p>
              <div className="flex gap-2 w-full mt-2">
                <Button variant="outline" className="flex-1" onClick={handleScanAgain}>Coba Lagi</Button>
                <Button className="flex-1" onClick={() => handleCloseScan(false)}>Tutup</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Import */}
      <ImportExcelDialog
        open={showImport} onOpenChange={setShowImport}
        title="Import Mustahiq dari Excel"
        columns={IMPORT_COLS}
        templateData={IMPORT_TEMPLATE}
        templateFileName="template-mustahiq.xlsx"
        validateRow={(r) => !!r["Nama Penerima"] && String(r["Nama Penerima"]).trim() !== ""}
        onImport={handleImport}
      />
    </div>
  );
};

export default MustahiqPage;
