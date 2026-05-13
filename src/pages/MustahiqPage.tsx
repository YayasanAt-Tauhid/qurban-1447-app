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
import { Plus, Search, Printer, ScanLine, Eye, FileUp, Download, CheckCircle2, XCircle, FileDown } from "lucide-react";
import * as XLSX from "xlsx";
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

// --- Excel import/export format ---
// Kolom: No | Nama Penerima | Status Warga | Status Jama'ah | Status Panitia | Status Lainnya | Penyalur
// Kategori mapping: warga->Status Warga, jamaah->Status Jama'ah, shohibul_qurban->Status Panitia, dhuafa/lainnya/bagian_tidak_direquest->Status Lainnya

function kategoriToExcelRow(m: any): Record<string, string> {
  return {
    "Nama Penerima": m.nama ?? "",
    "Status Warga": m.kategori === "warga" ? "Warga" : "",
    "Status Jama'ah": m.kategori === "jamaah" ? "Jama'ah" : "",
    "Status Panitia": m.kategori === "shohibul_qurban" ? "Panitia/Shohibul Qurban" : "",
    "Status Lainnya": ["dhuafa", "lainnya", "bagian_tidak_direquest"].includes(m.kategori)
      ? (m.kategori === "dhuafa" ? "Dhu'afa" : m.kategori === "bagian_tidak_direquest" ? "Bagian Tidak Direquest" : "Lainnya")
      : "",
    "Penyalur": m.nama_penyalur ?? "",
  };
}

function excelRowToMustahiq(row: Record<string, any>): { nama: string; kategori: KategoriMustahiq; nama_penyalur: string } | null {
  const nama = String(row["Nama Penerima"] ?? "").trim();
  if (!nama) return null;

  let kategori: KategoriMustahiq = "lainnya";
  if (String(row["Status Warga"] ?? "").trim()) kategori = "warga";
  else if (String(row["Status Jama'ah"] ?? "").trim()) kategori = "jamaah";
  else if (String(row["Status Panitia"] ?? "").trim()) kategori = "shohibul_qurban";
  else if (String(row["Status Lainnya"] ?? "").trim()) {
    const v = String(row["Status Lainnya"]).toLowerCase();
    if (v.includes("dhu") || v.includes("afa")) kategori = "dhuafa";
    else if (v.includes("tidak") || v.includes("direquest")) kategori = "bagian_tidak_direquest";
    else kategori = "lainnya";
  }

  return { nama, kategori, nama_penyalur: String(row["Penyalur"] ?? "").trim() };
}

const IMPORT_COLS = [
  { key: "Nama Penerima", label: "Nama Penerima", required: true },
  { key: "Status Warga", label: "Status Warga" },
  { key: "Status Jama'ah", label: "Status Jama'ah" },
  { key: "Status Panitia", label: "Status Panitia" },
  { key: "Status Lainnya", label: "Status Lainnya (Dhu'afa/dll)" },
  { key: "Penyalur", label: "Penyalur" },
];

const IMPORT_TEMPLATE = [
  { "Nama Penerima": "Ahmad Fauzi", "Status Warga": "Warga", "Status Jama'ah": "", "Status Panitia": "", "Status Lainnya": "", "Penyalur": "Pak RT" },
  { "Nama Penerima": "Siti Aminah", "Status Warga": "", "Status Jama'ah": "Jama'ah", "Status Panitia": "", "Status Lainnya": "", "Penyalur": "" },
  { "Nama Penerima": "Hasan bin Ali", "Status Warga": "", "Status Jama'ah": "", "Status Panitia": "", "Status Lainnya": "Dhu'afa", "Penyalur": "Pak Lurah" },
];

const MustahiqPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<KategoriMustahiq | "semua">("semua");
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showKupon, setShowKupon] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedMustahiq, setSelectedMustahiq] = useState<any>(null);
  const [scanState, setScanState] = useState<ScanState>("scanning");
  const [scanError, setScanError] = useState("");
  const [scanResult, setScanResult] = useState<any>(null);
  const [formData, setFormData] = useState({ nama: "", kategori: "warga" as KategoriMustahiq, nama_penyalur: "", keterangan: "" });
  const kuponRef = useRef<HTMLDivElement>(null);

  const { data: mustahiqList = [], isLoading } = useQuery({
    queryKey: ["mustahiq"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mustahiq").select("*").order("created_at", { ascending: true });
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

  const addMutation = useMutation({
    mutationFn: async (values: typeof formData) => {
      const nomor_kupon = generateNomorKupon(mustahiqList.length + 1);
      const { error } = await supabase.from("mustahiq").insert({ ...values, nomor_kupon });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["mustahiq"] }); toast.success("Mustahiq ditambahkan"); setShowAdd(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: async (values: typeof formData) => {
      const { error } = await supabase.from("mustahiq").update(values).eq("id", selectedMustahiq.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["mustahiq"] }); toast.success("Mustahiq diperbarui"); setShowEdit(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mustahiq").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["mustahiq"] }); toast.success("Mustahiq dihapus"); },
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

  // --- Export Excel ---
  const handleExport = () => {
    const filtered = activeTab === "semua" ? mustahiqList : mustahiqList.filter((m) => m.kategori === activeTab);
    const rows = filtered.map((m, i) => ({ "No": i + 1, ...kategoriToExcelRow(m) }));
    const ws = XLSX.utils.json_to_sheet(rows);
    // Set column widths
    ws["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mustahiq");
    XLSX.writeFile(wb, `mustahiq-${activeTab}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Export berhasil");
  };

  // --- Import handler ---
  const handleImport = async (rows: Record<string, any>[]) => {
    const mapped = rows.map(excelRowToMustahiq).filter(Boolean) as ReturnType<typeof excelRowToMustahiq>[];
    if (!mapped.length) throw new Error("Tidak ada data valid");
    let added = 0;
    for (let i = 0; i < mapped.length; i++) {
      const m = mapped[i]!;
      const nomor_kupon = generateNomorKupon(mustahiqList.length + i + 1);
      const { error } = await supabase.from("mustahiq").insert({ ...m, nomor_kupon });
      if (!error) added++;
    }
    queryClient.invalidateQueries({ queryKey: ["mustahiq"] });
    toast.success(`${added} mustahiq berhasil diimport`);
  };

  // --- Filter & search ---
  const filtered = mustahiqList.filter((m) => {
    const matchTab = activeTab === "semua" || m.kategori === activeTab;
    const matchSearch = !search || m.nama?.toLowerCase().includes(search.toLowerCase()) || m.nomor_kupon?.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const openEdit = (m: any) => {
    setSelectedMustahiq(m);
    setFormData({ nama: m.nama ?? "", kategori: m.kategori ?? "warga", nama_penyalur: m.nama_penyalur ?? "", keterangan: m.keterangan ?? "" });
    setShowEdit(true);
  };

  const openKupon = (m: any) => { setSelectedMustahiq(m); setShowKupon(true); };

  const handleScanAgain = () => { setScanState("scanning"); setScanResult(null); setScanError(""); };
  const handleCloseScanDialog = (open: boolean) => { if (!open) { setScanState("scanning"); setScanResult(null); setScanError(""); } setShowScan(open); };

  const handlePrintKupon = async () => {
    if (!kuponRef.current) return;
    const canvas = await html2canvas(kuponRef.current, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [100, 60] });
    pdf.addImage(imgData, "PNG", 0, 0, 100, 60);
    pdf.save(`kupon-${selectedMustahiq?.nomor_kupon ?? "kupon"}.pdf`);
  };

  const kuponMustahiq = selectedMustahiq ? kuponList.find((k: any) => k.mustahiq_id === selectedMustahiq.id) : null;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Daftar Mustahiq</h1>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}><FileUp className="mr-1 h-4 w-4" />Import</Button>
          <Button variant="outline" size="sm" onClick={handleExport}><FileDown className="mr-1 h-4 w-4" />Export</Button>
          <Button variant="outline" size="sm" onClick={() => setShowScan(true)}><ScanLine className="mr-1 h-4 w-4" />Scan Kupon</Button>
          <Button size="sm" onClick={() => { setFormData({ nama: "", kategori: "warga", nama_penyalur: "", keterangan: "" }); setShowAdd(true); }}>
            <Plus className="mr-1 h-4 w-4" />Tambah
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cari nama / nomor kupon..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Tabs per kategori */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="semua">Semua ({mustahiqList.length})</TabsTrigger>
          {KATEGORI_OPTIONS.map((k) => (
            <TabsTrigger key={k} value={k}>{k.replace(/_/g, " ")} ({mustahiqList.filter((m) => m.kategori === k).length})</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
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
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Belum ada data</TableCell></TableRow>
                  ) : (
                    filtered.map((m, i) => {
                      const ex = kategoriToExcelRow(m);
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="text-xs">{i + 1}</TableCell>
                          <TableCell className="font-medium">{m.nama}</TableCell>
                          <TableCell className="text-xs">{ex["Status Warga"]}</TableCell>
                          <TableCell className="text-xs">{ex["Status Jama'ah"]}</TableCell>
                          <TableCell className="text-xs">{ex["Status Panitia"]}</TableCell>
                          <TableCell className="text-xs">{ex["Status Lainnya"]}</TableCell>
                          <TableCell className="text-xs">{m.nama_penyalur}</TableCell>
                          <TableCell><Badge variant="outline" className="font-mono text-xs">{m.nomor_kupon}</Badge></TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openKupon(m)}><Eye className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Printer className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if (confirm("Hapus mustahiq ini?")) deleteMutation.mutate(m.id); }}><XCircle className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog Tambah */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tambah Mustahiq</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nama</Label><Input value={formData.nama} onChange={(e) => setFormData((p) => ({ ...p, nama: e.target.value }))} /></div>
            <div><Label>Kategori</Label>
              <Select value={formData.kategori} onValueChange={(v) => setFormData((p) => ({ ...p, kategori: v as KategoriMustahiq }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{KATEGORI_OPTIONS.map((k) => <SelectItem key={k} value={k}>{k.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Nama Penyalur</Label><Input value={formData.nama_penyalur} onChange={(e) => setFormData((p) => ({ ...p, nama_penyalur: e.target.value }))} /></div>
            <div><Label>Keterangan</Label><Input value={formData.keterangan} onChange={(e) => setFormData((p) => ({ ...p, keterangan: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Batal</Button>
            <Button onClick={() => addMutation.mutate(formData)} disabled={!formData.nama || addMutation.isPending}>
              {addMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Edit */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Mustahiq</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nama</Label><Input value={formData.nama} onChange={(e) => setFormData((p) => ({ ...p, nama: e.target.value }))} /></div>
            <div><Label>Kategori</Label>
              <Select value={formData.kategori} onValueChange={(v) => setFormData((p) => ({ ...p, kategori: v as KategoriMustahiq }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{KATEGORI_OPTIONS.map((k) => <SelectItem key={k} value={k}>{k.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Nama Penyalur</Label><Input value={formData.nama_penyalur} onChange={(e) => setFormData((p) => ({ ...p, nama_penyalur: e.target.value }))} /></div>
            <div><Label>Keterangan</Label><Input value={formData.keterangan} onChange={(e) => setFormData((p) => ({ ...p, keterangan: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Batal</Button>
            <Button onClick={() => editMutation.mutate(formData)} disabled={!formData.nama || editMutation.isPending}>
              {editMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Kupon */}
      <Dialog open={showKupon} onOpenChange={setShowKupon}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Kupon Mustahiq</DialogTitle></DialogHeader>
          {selectedMustahiq && (
            <div className="flex flex-col items-center gap-3">
              <div ref={kuponRef}>
                <KuponTemplate mustahiq={selectedMustahiq} kupon={kuponMustahiq} />
              </div>
              <Button onClick={handlePrintKupon}><Printer className="mr-2 h-4 w-4" />Cetak Kupon</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Scan Kupon */}
      <Dialog open={showScan} onOpenChange={handleCloseScanDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Scan Kupon</DialogTitle></DialogHeader>
          {scanState === "scanning" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Masukkan nomor kupon untuk verifikasi:</p>
              <Input placeholder="Nomor kupon..." autoFocus onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (v) verifyKuponMutation.mutate(v);
                }
              }} />
              <p className="text-xs text-muted-foreground">Tekan Enter untuk verifikasi</p>
            </div>
          )}
          {scanState === "success" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <p className="font-medium">{scanResult?.mustahiq?.nama}</p>
              <Badge>{scanResult?.mustahiq?.kategori?.replace(/_/g, " ")}</Badge>
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
