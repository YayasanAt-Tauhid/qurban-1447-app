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
import { Plus, Search, Printer, ScanLine } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { generateNomorKupon } from "@/lib/qurban-utils";
import { QRCodeCanvas } from "qrcode.react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { Database } from "@/integrations/supabase/types";

type KategoriMustahiq = Database["public"]["Enums"]["kategori_mustahiq"];

const KATEGORI_OPTIONS: KategoriMustahiq[] = ["dhuafa", "warga", "jamaah", "shohibul_qurban", "bagian_tidak_direquest", "lainnya"];

const MustahiqPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [formNama, setFormNama] = useState("");
  const [formKategori, setFormKategori] = useState<KategoriMustahiq>("warga");
  const [formKeterangan, setFormKeterangan] = useState("");
  const kuponRef = useRef<HTMLDivElement>(null);

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
      toast.success("Mustahiq berhasil ditambahkan");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const scanMutation = useMutation({
    mutationFn: async (qrData: string) => {
      const { data: found } = await supabase
        .from("mustahiq")
        .select("id, nama, status_kupon")
        .eq("qr_data", qrData)
        .single();
      if (!found) throw new Error("Kupon tidak ditemukan");
      if (found.status_kupon === "sudah_ambil") throw new Error(`${found.nama} sudah mengambil`);
      const { error } = await supabase
        .from("mustahiq")
        .update({ status_kupon: "sudah_ambil" })
        .eq("id", found.id);
      if (error) throw error;
      return found.nama;
    },
    onSuccess: (nama) => {
      queryClient.invalidateQueries({ queryKey: ["mustahiq-list"] });
      toast.success(`${nama} — kupon berhasil di-scan!`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // QR Scanner
  useEffect(() => {
    if (!showScanner) return;
    let scanner: any;
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      scanner = new Html5Qrcode("qr-reader");
      scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded: string) => {
          scanner.stop().then(() => {
            setShowScanner(false);
            scanMutation.mutate(decoded);
          });
        },
        () => {}
      ).catch(() => toast.error("Tidak bisa mengakses kamera"));
    });
    return () => {
      scanner?.stop?.().catch(() => {});
    };
  }, [showScanner]);

  const cetakKupon = async () => {
    if (!mustahiqList || mustahiqList.length === 0) return;
    const doc = new jsPDF();
    const perPage = 4;

    for (let i = 0; i < mustahiqList.length; i += perPage) {
      if (i > 0) doc.addPage();
      const batch = mustahiqList.slice(i, i + perPage);

      for (let j = 0; j < batch.length; j++) {
        const m = batch[j];
        const yOffset = j * 70 + 10;

        doc.setDrawColor(150);
        doc.rect(10, yOffset, 190, 65);

        doc.setFontSize(10);
        doc.text("Masjid At-Tauhid Pangkalpinang", 105, yOffset + 8, { align: "center" });
        doc.setFontSize(8);
        doc.text("Kupon Daging Qurban 1447H", 105, yOffset + 14, { align: "center" });

        doc.setFontSize(14);
        doc.text(m.nomor_kupon ?? "-", 105, yOffset + 25, { align: "center" });

        doc.setFontSize(10);
        doc.text(`Nama: ${m.nama}`, 20, yOffset + 35);
        doc.text(`Kategori: ${m.kategori}`, 20, yOffset + 42);
        doc.text(`Tahun: 1447H`, 20, yOffset + 49);

        // QR placeholder note (actual QR in printed version)
        doc.setFontSize(7);
        doc.text(`QR: ${m.qr_data ?? m.nomor_kupon}`, 140, yOffset + 55);
      }
    }

    doc.save("kupon-mustahiq-1447H.pdf");
    toast.success("PDF kupon berhasil diunduh");
  };

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
          <Button variant="outline" onClick={() => setShowScanner(true)}>
            <ScanLine className="mr-2 h-4 w-4" /> Scan QR
          </Button>
          <Button variant="outline" onClick={cetakKupon}>
            <Printer className="mr-2 h-4 w-4" /> Cetak Kupon
          </Button>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="mr-2 h-4 w-4" /> Tambah
          </Button>
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
        <div className="table-container">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Kupon</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
                    <Badge
                      variant={m.status_kupon === "sudah_ambil" ? "default" : "outline"}
                      className={m.status_kupon === "sudah_ambil" ? "bg-success/10 text-success border-success/20" : ""}
                    >
                      {m.status_kupon === "sudah_ambil" ? "Sudah Ambil" : "Belum Ambil"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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

      {/* QR Scanner Dialog */}
      <Dialog open={showScanner} onOpenChange={setShowScanner}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Scan Kupon QR</DialogTitle>
          </DialogHeader>
          <div id="qr-reader" className="w-full" />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MustahiqPage;
