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
  { "Nama Penerima": "Ahmad Fauzi",   "Status Warga": "Warga",       "Status Jama'ah": "Jama'ah",       "Status Panitia": "",             "Status Lainnya": "",        "Penyalur": "Pak RT"    },
  { "Nama Penerima": "Siti Aminah",   "Status Warga": "Bukan Warga", "Status Jama'ah": "Bukan Jama'ah", "Status Panitia": "Panitia",      "Status Lainnya": "Dhu'afa", "Penyalur": ""          },
  { "Nama Penerima": "Hasan bin Ali", "Status Warga": "",            "Status Jama'ah": "",               "Status Panitia": "Bukan Panitia","Status Lainnya": "",        "Penyalur": "Pak Lurah" },
];

// ─── Badge helpers ────────────────────────────────────────────────────────────
function StatusBadge({ value, labels }: { value: string | null; labels: [string, string, string] }) {
  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  const [pos, neg] = [labels[0], labels[1]];
  const isPos = !value.startsWith("bukan_");
  return (
    <Badge variant={isPos ? "default" : "secondary"} className="text-xs">
      {isPos ? pos : neg}
    </Badge>
  );
}

// ─── Paging Control ───────────────────────────────────────────────────────────
function PagingControl({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
      <span>Halaman {page} dari {total}</span>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" disabled={page === 1} onClick={() => onChange(1)}>«</Button>
        <Button variant="outline" size="sm" disabled={page === 1} onClick={() => onChange(page - 1)}>‹</Button>
        <Button variant="outline" size="sm" disabled={page === total} onClick={() => onChange(page + 1)}>›</Button>
        <Button variant="outline" size="sm" disabled={page === total} onClick={() => onChange(total)}>»</Button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const MustahiqPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const PAGE_SIZE = 25;
  const [search, setSearch] = useState("");
  const [mainTab, setMainTab] = useState<MainTab>("mustahiq");
  const [pageMustahiq, setPageMustahiq] = useState(1);
  const [pageShohibul, setPageShohibul] = useState(1);
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
      const { data, error } = await supabase.from("mustahiq").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MustahiqRow[];
    },
  });

  const { data: shohibulList = [], isLoading: loadingShohibul } = useQuery({
    queryKey: ["mustahiq_shohibul"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mustahiq").select("*").eq("status_lainnya", "shohibul_qurban").order("created_at", { ascending: true });
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
      const { data, error } = await supabase.from("mustahiq").select("*").or(`nomor_kupon.eq.${input},qr_data.eq.${input}`).single();
      if (error || !data) throw new Error("Kupon tidak ditemukan");
      if (data.status_kupon === "sudah_ambil") throw new Error(`${data.nama} sudah mengambil daging`);
      const { error: updateError } = await supabase.from("mustahiq").update({ status_kupon: "sudah_ambil" }).eq("id", data.id);
      if (updateError) throw updateError;
      return data;
    },
    onSuccess: (data) => { setScanResult(data); setScanState("success"); queryClient.invalidateQueries({ queryKey: ["mustahiq"] }); queryClient.invalidateQueries({ queryKey: ["mustahiq_shohibul"] }); },
    onError: (e: any) => { setScanError(e.message); setScanState("error"); },
  });

  const togglePengambilan = useMutation({
    mutationFn: async (m: MustahiqRow) => {
      const next: StatusPengambilan = m.status_kupon === "sudah_ambil" ? "belum_ambil" : "sudah_ambil";
      const { error } = await supabase.from("mustahiq").update({ status_kupon: next }).eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["mustahiq"] }); queryClient.invalidateQueries({ queryKey: ["mustahiq_shohibul"] }); toast.success("Status pengambilan diperbarui"); },
    onError: (e: any) => toast.error(e.message),
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

  const openEdit = (m: MustahiqRow) => { setSelected(m); setForm({ nama: m.nama, status_warga: m.status_warga, status_jamaah: m.status_jamaah, status_panitia: m.status_panitia, status_lainnya: m.status_lainnya, nama_penyalur: m.nama_penyalur ?? "", keterangan: m.keterangan ?? "" }); setShowEdit(true); };
  const openKupon = (m: MustahiqRow) => { setSelected(m); setShowKupon(true); };
  const handleScanAgain = () => { setScanState("scanning"); setScanResult(null); setScanError(""); setScanKey((k) => k + 1); };
  const handleCloseScan = (open: boolean) => { if (!open) { setScanState("scanning"); setScanResult(null); setScanError(""); } setShowScan(open); };

  // ── QR Scanner ──
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
          if (scanningRef.current) return;
          scanningRef.current = true;
          scanner.stop().catch(() => {});
          verifyKuponMutation.mutate(decodedText);
        },
        () => {}
      ).catch(() => {});
    });
    return () => { if (scanner) { try { scanner.stop().then(() => scanner.clear()).catch(() => {}); } catch { /* ignore */ } } };
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
