import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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

const MustahiqPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showPreview, setShowPreview] = useState<string | null>(null);
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
      setFormNama("");
      setFormKeterangan("");
      setFormPenyalur("");
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
      const { error } = await supabase
        .from("mustahiq")
        .update({ status_kupon: "sudah_ambil" })
        .eq("id", found.id);
      if (error) throw error;
      return { nama: found.nama, nomor_kupon: found.nomor_kupon ?? "", kategori: found.kategori };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["mustahiq-list"], refetchType: "active" });
      setScanResult(result);
      setScanState("success");
    },
    onError: (err: any) => {
      setScanError(err.message);
      setScanState("error");
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === "sudah_ambil" ? "belum_ambil" : "sudah_ambil";
      const { error } = await supabase
        .from("mustahiq")
        .update({ status_kupon: newStatus as any })
        .eq("id", id);
      if (error) throw error;
      return newStatus;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["mustahiq-list"], refetchType: "active" });
      toast.success(newStatus === "sudah_ambil" ? "Ditandai sudah ambil" : "Status dikembalikan ke belum ambil");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const stoppingRef = useRef(false);

  const stopScanner = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    try {
      const inst = scannerRef.current;
      if (inst) {
        scannerRef.current = null;
        try {
          const state = inst.getState?.();
          if (state === 2 /* SCANNING */) {
            await inst.stop();
          }
        } catch (_) {}
        try { inst.clear(); } catch (_) {}
      }
    } finally {
      stoppingRef.current = false;
    }
  }, []);

  const resetScanState = useCallback(() => {
    isScanProcessingRef.current = false;
    setScanState("scanning");
    setScanResult(null);
    setScanError("");
  }, []);

  // QR Scanner
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

          try {
            const state = scanner.getState?.();
            if (state === 2) await scanner.stop();
          } catch {
            isScanProcessingRef.current = false;
            return;
          }

          if (scannerRef.current === scanner) {
            scannerRef.current = null;
          }

          scanMutation.mutate(decoded);
        },
        () => {}
      ).then(() => {
        scannerRef.current = scanner;
      }).catch(() => {
        isScanProcessingRef.current = false;
        toast.error("Tidak bisa mengakses kamera");
      });
    });
    return () => {
      stopScanner();
    };
  }, [showScanner, scanState, scanKey, stopScanner]);

  const handleScanAgain = () => {
    resetScanState();
    setScanKey((k) => k + 1);
  };

  const handleCloseScanDialog = async (open: boolean) => {
    if (!open) {
      await stopScanner();
      resetScanState();
    }
    setShowScanner(open);
  };

  const cetakKupon = async () => {
    if (!mustahiqList || mustahiqList.length === 0) return;

    const doc = new jsPDF({ unit: "mm", format: [210, 330], orientation: "portrait" });
    const pageW = 190;
    const marginX = 10;
    const marginY = 10;
    const gap = 5;
    const pageH = 330;

    let currentY = marginY;
    let firstOnPage = true;

    for (let i = 0; i < mustahiqList.length; i++) {
      const el = document.getElementById(`kupon-${mustahiqList[i].id}`);
      if (!el) continue;

      el.style.display = "block";
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true, width: 420, height: 160 });
      el.style.display = "none";

      const imgData = canvas.toDataURL("image/png");
      const ratio = canvas.height / canvas.width;
      const imgH = pageW * ratio;

      if (!firstOnPage && currentY + imgH > pageH - marginY) {
        doc.addPage([210, 330]);
        currentY = marginY;
        firstOnPage = true;
      }

      doc.addImage(imgData, "PNG", marginX, currentY, pageW, imgH);
      currentY += imgH + gap;
      firstOnPage = false;
    }

    doc.save("kupon-mustahiq-1447H.pdf");
    toast.success(`PDF kupon berhasil diunduh (${mustahiqList.length} kupon)`);
  };

  const unduhSingleKupon = async (mustahiq: typeof mustahiqList extends (infer T)[] | undefined ? T : never) => {
    if (!mustahiq) return;
    const el = document.getElementById(`kupon-${mustahiq.id}`);
    if (!el) return;
    el.style.display = "block";
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", width: 420, height: 160 });
    el.style.display = "none";
    const ratio = canvas.height / canvas.width;
    const w = 95;
    const h = w * ratio;
    const doc = new jsPDF({ unit: "mm", format: [w, h] });
    doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, w, h);
    doc.save(`kupon-${mustahiq.nomor_kupon ?? mustahiq.id}.pdf`);
  };

  const handleImport = async (rows: Record<string, any>[]) => {
    const currentCount = mustahiqList?.length ?? 0;
    const inserts = rows.map((r, i) => {
      const nomor = generateNomorKupon(currentCount + i + 1);
      const kat = VALID_KATEGORI.has(r.kategori?.toLowerCase?.().trim())
        ? r.kategori.toLowerCase().trim() as KategoriMustahiq
        : "lainnya" as KategoriMustahiq;
      return {
        nama: String(r.nama).trim(),
        kategori: kat,
        nama_penyalur: r.nama_penyalur ? String(r.nama_penyalur).trim() : null,
        keterangan: r.keterangan ? String(r.keterangan).trim() : null,
        nomor_kupon: nomor,
        qr_data: nomor,
      };
    });
    const { error } = await supabase.from("mustahiq").insert(inserts);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["mustahiq-list"] });
    toast.success(`${inserts.length} mustahiq berhasil diimport`);
  };

  const previewMustahiq = showPreview ? mustahiqList?.find((m) => m.id === showPreview) : null;

  const filtered = mustahiqList?.filter((m) =>
    m.nama.toLowerCase().includes(search.toLowerCase()) ||
    (m.nomor_kupon ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const sudahAmbil = mustahiqList?.filter((m) => m.status_kupon === "sudah_ambil").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Mustahiq & Kupon</h1>
          <p className="page-subtitle">
            Kelola penerima daging qurban · {sudahAmbil}/{mustahiqList?.length ?? 0} sudah ambil
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {hasRole(["super_admin", "admin_kupon"]) && (
            <Button variant="outline" onClick={() => { setScanKey((k) => k + 1); setShowScanner(true); }}>
              <ScanLine className="mr-2 h-4 w-4" /> Scan QR
            </Button>
          )}
          <Button variant="outline" onClick={cetakKupon}>
            <Printer className="mr-2 h-4 w-4" /> Cetak Semua Kupon (PDF)
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

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cari nama / kupon..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
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
                {filtered?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Belum ada data mustahiq
                    </TableCell>
                  </TableRow>
                )}
                {filtered?.map((m, idx) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{m.nomor_kupon}</TableCell>
                    <TableCell className="font-medium">{m.nama}</TableCell>
                    <TableCell className="capitalize">{m.kategori}</TableCell>
                    <TableCell>
                      {hasRole(["super_admin", "admin_kupon"]) ? (
                        <button
                          onClick={() => toggleStatusMutation.mutate({ id: m.id, currentStatus: m.status_kupon })}
                          disabled={toggleStatusMutation.isPending}
                          title={m.status_kupon === "sudah_ambil" ? "Klik untuk batalkan" : "Klik untuk tandai sudah ambil"}
                          className="cursor-pointer"
                        >
                          <Badge
                            variant={m.status_kupon === "sudah_ambil" ? "default" : "outline"}
                            className={
                              m.status_kupon === "sudah_ambil"
                                ? "bg-success/10 text-success border-success/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-colors"
                                : "hover:bg-success/10 hover:text-success hover:border-success/20 transition-colors"
                            }
                          >
                            {m.status_kupon === "sudah_ambil" ? "Sudah Ambil" : "Belum Ambil"}
                          </Badge>
                        </button>
                      ) : (
                        <Badge
                          variant={m.status_kupon === "sudah_ambil" ? "default" : "outline"}
                          className={m.status_kupon === "sudah_ambil" ? "bg-success/10 text-success border-success/20" : ""}
                        >
                          {m.status_kupon === "sudah_ambil" ? "Sudah Ambil" : "Belum Ambil"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setShowPreview(m.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {hasRole(["super_admin", "admin_kupon"]) && (
            <p className="text-xs text-muted-foreground mt-2">
              💡 Klik status pada tabel untuk toggle manual (jika kupon hilang)
            </p>
          )}
        </>
      )}

      {/* Hidden kupon templates for PDF rendering */}
      <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
        {mustahiqList?.map((m) => (
          <KuponTemplate
            key={m.id}
            id={m.id}
            nomor_kupon={m.nomor_kupon}
            nama={m.nama}
            kategori={m.kategori}
            qr_data={m.qr_data}
          />
        ))}
      </div>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Mustahiq</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama *</Label>
              <Input value={formNama} onChange={(e) => setFormNama(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={formKategori} onValueChange={(v) => setFormKategori(v as KategoriMustahiq)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KATEGORI_OPTIONS.map((k) => (
                    <SelectItem key={k} value={k} className="capitalize">{k.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nama Penyalur</Label>
              <Input value={formPenyalur} onChange={(e) => setFormPenyalur(e.target.value)} placeholder="Opsional" />
            </div>
            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Input value={formKeterangan} onChange={(e) => setFormKeterangan(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Batal</Button>
            <Button onClick={() => addMutation.mutate()} disabled={!formNama || addMutation.isPending}>
              {addMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kupon Preview Dialog */}
      <Dialog open={!!showPreview} onOpenChange={() => setShowPreview(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Preview Kupon</DialogTitle>
          </DialogHeader>
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
                <p className="text-sm capitalize text-muted-foreground">{previewMustahiq.kategori}</p>
              </div>
              <Button className="w-full" variant="outline" onClick={() => unduhSingleKupon(previewMustahiq)}>
                <Download className="mr-2 h-4 w-4" /> Unduh kupon ini
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* QR Scanner Dialog */}
      <Dialog open={showScanner} onOpenChange={handleCloseScanDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Scan Kupon QR</DialogTitle>
          </DialogHeader>

          <div
            id="qr-reader"
            key={scanKey}
            className="w-full"
            style={{ display: scanState === "scanning" ? "block" : "none" }}
          />

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

      {/* Import Excel Dialog */}
      <ImportExcelDialog
        open={showImport}
        onOpenChange={setShowImport}
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
