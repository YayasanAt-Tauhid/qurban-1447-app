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
import { useState, useRef } from "react";
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
type StatusLainnya = "dhuafa" | "shohibul_qurban" | null;
type ScanState     = "scanning" | "success" | "error";
type MainTab       = "mustahiq" | "shohibul";

interface MustahiqRow {
  id: string;
  tahun: number;
  nomor_kupon: string | null;
  nama: string;
  status_warga: StatusWarga;
  status_jamaah: StatusJamaah;
  status_panitia: StatusPanitia;
  status_lainnya: StatusLainnya;
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
    "Nama Penerima": m.nama,
    "Status Warga":   m.status_warga   === "warga"        ? "Warga"
                    : m.status_warga   === "bukan_warga"   ? "Bukan Warga" : "",
    "Status Jama'ah": m.status_jamaah  === "jamaah"       ? "Jama'ah"
                    : m.status_jamaah  === "bukan_jamaah"  ? "Bukan Jama'ah" : "",
    "Status Panitia": m.status_panitia === "panitia"      ? "Panitia"
                    : m.status_panitia === "bukan_panitia" ? "Bukan Panitia" : "",
    "Status Lainnya": m.status_lainnya === "dhuafa" ? "Dhu'afa" : m.status_lainnya === "shohibul_qurban" ? "Shohibul Qurban" : "",
    "Penyalur": m.nama_penyalur ?? "",
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
    status_lainnya: sl.includes("shohibul") ? "shohibul_qurban" : sl.includes("dhu") ? "dhuafa" : null,
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
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showKupon, setShowKupon] = useState(false);
  const [showScan, setShowScan] = useState(false);
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
    queryKey: ["shohibul_qurban"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shohibul_qurban").select("*, hewan_qurban(nomor_urut, jenis_hewan)").order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
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
      const nomor_kupon = generateNomorKupon(mustahiqList.length + 1);
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["mustahiq"] }); toast.success("Data diperbarui"); setShowEdit(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mustahiq").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["mustahiq"] }); toast.success("Data dihapus"); },
    onError: (e: any) => toast.error(e.message),
  });

  const verifyKuponMutation = useMutation({
    mutationFn: async (nomor_kupon: string) => {
      const { data, error } = await supabase.from("kupon_qurban").select("*, mustahiq(*)").eq("nomor_kupon", nomor_kupon).single();
      if (error || !data) throw new Error("Kupon tidak ditemukan");
      if (data.status === "digunakan") throw new Error("Kupon sudah digunakan");
      await supabase.from("kupon_qurban").update({ status: "digunakan", digunakan_pada: new Date().toISOString(), digunakan_oleh: user?.id }).eq("id", data.id);
      return data;
    },
    onSuccess: (data) => { setScanResult(data); setScanState("success"); queryClient.invalidateQueries({ queryKey: ["kupon_qurban"] }); },
    onError: (e: any) => { setScanError(e.message); setScanState("error"); },
  });

  // ── Helpers ──
  const filteredMustahiq = mustahiqList.filter((m) =>
    !search || m.nama?.toLowerCase().includes(search.toLowerCase()) || m.nomor_kupon?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredShohibul = shohibulList.filter((m: any) =>
    !search || m.nama?.toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (m: MustahiqRow) => { setSelected(m); setForm({ nama: m.nama, status_warga: m.status_warga, status_jamaah: m.status_jamaah, status_panitia: m.status_panitia, status_lainnya: m.status_lainnya, nama_penyalur: m.nama_penyalur ?? "", keterangan: m.keterangan ?? "" }); setShowEdit(true); };
  const openKupon = (m: MustahiqRow) => { setSelected(m); setShowKupon(true); };
  const handleScanAgain = () => { setScanState("scanning"); setScanResult(null); setScanError(""); };
  const handleCloseScan = (open: boolean) => { if (!open) { setScanState("scanning"); setScanResult(null); setScanError(""); } setShowScan(open); };
  const kuponMustahiq = selected ? kuponList.find((k: any) => k.mustahiq_id === selected.id) : null;

  const handleExport = () => {
    const rows = filteredMustahiq.map((m, i) => rowToExcel(m, i + 1));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 4 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mustahiq");
    XLSX.writeFile(wb, `mustahiq-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Export berhasil");
  };

  const handleImport = async (rows: Record<string, any>[]) => {
    const mapped = rows.map(excelToForm).filter(Boolean);
    if (!mapped.length) throw new Error("Tidak ada data valid");
    let added = 0;
    for (let i = 0; i < mapped.length; i++) {
      const m = mapped[i]!;
      const nomor_kupon = generateNomorKupon(mustahiqList.length + i + 1);
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
        <h1 className="text-2xl font-bold">Mustahiq & Shohibul Qurban</h1>
        <div className="flex gap-2 flex-wrap">
          {mainTab === "mustahiq" && <>
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)}><FileUp className="mr-1 h-4 w-4" />Import</Button>
            <Button variant="outline" size="sm" onClick={handleExport}><FileDown className="mr-1 h-4 w-4" />Export</Button>
          </>}
          <Button variant="outline" size="sm" onClick={() => setShowScan(true)}><ScanLine className="mr-1 h-4 w-4" />Scan Kupon</Button>
          {mainTab === "mustahiq" && (
            <Button size="sm" onClick={() => { setForm(EMPTY_FORM); setShowAdd(true); }}><Plus className="mr-1 h-4 w-4" />Tambah</Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cari nama / nomor kupon..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Main Tabs: Mustahiq | Shohibul Qurban */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as MainTab)}>
        <TabsList>
          <TabsTrigger value="mustahiq">Mustahiq ({mustahiqList.length})</TabsTrigger>
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
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMustahiq.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Belum ada data</TableCell></TableRow>
                  ) : filteredMustahiq.map((m, i) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{i + 1}</TableCell>
                      <TableCell className="font-medium">{m.nama}</TableCell>
                      <TableCell><StatusBadge value={m.status_warga} labels={["Warga", "Bukan Warga", ""]} /></TableCell>
                      <TableCell><StatusBadge value={m.status_jamaah} labels={["Jama'ah", "Bukan Jama'ah", ""]} /></TableCell>
                      <TableCell><StatusBadge value={m.status_panitia} labels={["Panitia", "Bukan Panitia", ""]} /></TableCell>
                      <TableCell>{m.status_lainnya === "dhuafa" ? <Badge variant="outline" className="text-xs">Dhu'afa</Badge> : m.status_lainnya === "shohibul_qurban" ? <Badge variant="outline" className="text-xs">Shohibul Qurban</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-xs">{m.nama_penyalur ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="font-mono text-xs">{m.nomor_kupon ?? "—"}</Badge></TableCell>
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
          )}
        </TabsContent>

        {/* ── Tab Shohibul Qurban ── */}
        <TabsContent value="shohibul" className="mt-4">
          {loadingShohibul ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">No</TableHead>
                    <TableHead>Nama Shohibul Qurban</TableHead>
                    <TableHead>Hewan</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Status Penyembelihan</TableHead>
                    <TableHead>Akad</TableHead>
                    <TableHead>Sumber</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShohibul.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Belum ada data</TableCell></TableRow>
                  ) : filteredShohibul.map((m: any, i: number) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{i + 1}</TableCell>
                      <TableCell className="font-medium">{m.nama}</TableCell>
                      <TableCell className="text-xs">{m.hewan_qurban ? `${m.hewan_qurban.jenis_hewan} #${m.hewan_qurban.nomor_urut}` : "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs capitalize">{m.tipe_kepemilikan}</Badge></TableCell>
                      <TableCell><Badge variant={m.status_penyembelihan === "sendiri" ? "default" : "secondary"} className="text-xs capitalize">{m.status_penyembelihan ?? "—"}</Badge></TableCell>
                      <TableCell>{m.akad_dilakukan ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs capitalize">{m.sumber_pendaftaran ?? "—"}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog Tambah */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Tambah Mustahiq</DialogTitle></DialogHeader>
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
          <DialogHeader><DialogTitle>Edit Mustahiq</DialogTitle></DialogHeader>
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
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Masukkan nomor kupon untuk verifikasi:</p>
              <Input placeholder="Nomor kupon..." autoFocus onKeyDown={(e) => {
                if (e.key === "Enter") { const v = (e.target as HTMLInputElement).value.trim(); if (v) verifyKuponMutation.mutate(v); }
              }} />
              <p className="text-xs text-muted-foreground">Tekan Enter untuk verifikasi</p>
            </div>
          )}
          {scanState === "success" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <p className="font-medium">{scanResult?.mustahiq?.nama}</p>
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
