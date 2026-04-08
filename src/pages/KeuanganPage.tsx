import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatRupiah, formatTanggal, SUMBER_HEWAN_LABEL, type SumberHewan } from "@/lib/qurban-utils";
import { Plus, Search, TrendingUp, TrendingDown, Wallet, CreditCard, FileUp, Banknote, Landmark, Edit2, Trash2, Store } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import ImportExcelDialog from "@/components/ImportExcelDialog";
import { formatRupiah as fmtR } from "@/lib/qurban-utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const KATEGORI_SUGGESTIONS = ["pembelian hewan", "operasional", "konsumsi", "perlengkapan"];

const KeuanganPage = () => {
  const { isAdmin, panitiaId } = useAuth();
  const queryClient = useQueryClient();
  const [showKasImport, setShowKasImport] = useState(false);
  const [filterJenis, setFilterJenis] = useState("semua");
  const [filterMetode, setFilterMetode] = useState("semua");
  const [searchKeterangan, setSearchKeterangan] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [iuranDialogOpen, setIuranDialogOpen] = useState(false);
  const [filterBayar, setFilterBayar] = useState("semua");
  const [filterPenjual, setFilterPenjual] = useState("semua");
  const [penjualDialogOpen, setPenjualDialogOpen] = useState(false);
  const [penjualHewanId, setPenjualHewanId] = useState("");
  const [penjualNama, setPenjualNama] = useState("");
  const [penjualHp, setPenjualHp] = useState("");
  const [penjualHarga, setPenjualHarga] = useState(0);
  const [penjualJumlah, setPenjualJumlah] = useState("");
  const [penjualMetode, setPenjualMetode] = useState<"tunai" | "bank">("tunai");
  const [penjualKeterangan, setPenjualKeterangan] = useState("");

  // Iuran payment form state
  const [payNama, setPayNama] = useState("");
  const [payHewan, setPayHewan] = useState("");
  const [payNominal, setPayNominal] = useState(0);
  const [payJumlah, setPayJumlah] = useState("");
  const [payMetode, setPayMetode] = useState<"tunai" | "bank">("tunai");
  const [payKeterangan, setPayKeterangan] = useState("");
  const [payShohibulId, setPayShohibulId] = useState("");

  // Form state
  const [formTanggal, setFormTanggal] = useState(new Date().toISOString().split("T")[0]);
  const [formJenis, setFormJenis] = useState<"masuk" | "keluar">("masuk");
  const [formMetode, setFormMetode] = useState<"tunai" | "bank">("tunai");
  const [formKategori, setFormKategori] = useState("");
  const [formKeterangan, setFormKeterangan] = useState("");
  const [formJumlah, setFormJumlah] = useState("");

  const { data: kasList, isLoading } = useQuery({
    queryKey: ["kas-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("kas").select("*").order("tanggal", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: shohibulIuran, isLoading: loadingIuran } = useQuery({
    queryKey: ["shohibul-iuran"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shohibul_qurban")
        .select("*, hewan_qurban(nomor_urut, jenis_hewan, tipe_kepemilikan, iuran_per_orang, sumber_hewan, harga, biaya_operasional)")
        .order("nama");
      if (error) throw error;
      return data;
    },
  });

  // Get iuran payments from kas
  const { data: iuranPayments } = useQuery({
    queryKey: ["iuran-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kas")
        .select("*")
        .eq("jenis", "masuk")
        .eq("kategori", "iuran shohibul");
      if (error) throw error;
      return data;
    },
  });

  // Hewan list for Bayar Penjual tab
  const { data: hewanList, isLoading: loadingHewan } = useQuery({
    queryKey: ["hewan-penjual"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hewan_qurban")
        .select("id, nomor_urut, jenis_hewan, sumber_hewan, nama_penjual, hp_penjual, harga")
        .order("nomor_urut");
      if (error) throw error;
      return data;
    },
  });

  // Payments to sellers from kas
  const { data: penjualPayments } = useQuery({
    queryKey: ["penjual-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kas")
        .select("*")
        .eq("jenis", "keluar")
        .eq("kategori", "bayar penjual");
      if (error) throw error;
      return data;
    },
  });

  const getPenjualPaymentTotal = (hewanId: string) => {
    if (!penjualPayments) return 0;
    return penjualPayments
      .filter((p) => p.keterangan?.includes(hewanId))
      .reduce((sum, p) => sum + Number(p.jumlah), 0);
  };

  const getPenjualPaymentStatus = (hewanId: string, harga: number) => {
    const total = getPenjualPaymentTotal(hewanId);
    if (total <= 0) return "belum";
    if (total >= harga) return "lunas";
    return "dp";
  };

  const openPenjualPayDialog = (h: any) => {
    setPenjualHewanId(h.id);
    setPenjualNama(h.nama_penjual ?? "");
    setPenjualHp(h.hp_penjual ?? "");
    setPenjualHarga(Number(h.harga ?? 0));
    setPenjualJumlah("");
    setPenjualMetode("tunai");
    setPenjualKeterangan(`Bayar penjual hewan ${h.nomor_urut} (${h.jenis_hewan}) - ${h.nama_penjual ?? ""}`);
    setPenjualDialogOpen(true);
  };

  const penjualPayMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("kas").insert({
        tanggal: new Date().toISOString().split("T")[0],
        jenis: "keluar" as const,
        metode: penjualMetode,
        kategori: "bayar penjual",
        keterangan: `${penjualKeterangan} [${penjualHewanId}]`,
        jumlah: parseInt(penjualJumlah) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kas-list"] });
      queryClient.invalidateQueries({ queryKey: ["penjual-payments"] });
      setPenjualDialogOpen(false);
      toast.success("Pembayaran penjual berhasil dicatat");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const getPaymentTotal = (shohibulId: string) => {
    if (!iuranPayments) return 0;
    return iuranPayments
      .filter((p) => p.keterangan?.includes(shohibulId))
      .reduce((sum, p) => sum + Number(p.jumlah), 0);
  };

  const getPaymentStatus = (shohibulId: string, iuranPerOrang: number) => {
    const total = getPaymentTotal(shohibulId);
    if (total <= 0) return "belum";
    if (total >= iuranPerOrang) return "lunas";
    return "dp";
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("kas").update({
        tanggal: formTanggal,
        jenis: formJenis,
        metode: formMetode,
        kategori: formKategori || null,
        keterangan: formKeterangan || null,
        jumlah: parseInt(formJumlah) || 0,
      }).eq("id", editId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kas-list"] });
      queryClient.invalidateQueries({ queryKey: ["iuran-payments"] });
      setEditDialogOpen(false);
      setEditId(null);
      resetForm();
      toast.success("Transaksi berhasil diperbarui");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kas-list"] });
      queryClient.invalidateQueries({ queryKey: ["iuran-payments"] });
      toast.success("Transaksi dihapus");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openEditDialog = (k: any) => {
    setEditId(k.id);
    setFormTanggal(k.tanggal);
    setFormJenis(k.jenis);
    setFormMetode(k.metode ?? "tunai");
    setFormKategori(k.kategori ?? "");
    setFormKeterangan(k.keterangan ?? "");
    setFormJumlah(String(k.jumlah));
    setEditDialogOpen(true);
  };

  const insertMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("kas").insert({
        tanggal: formTanggal,
        jenis: formJenis,
        metode: formMetode,
        kategori: formKategori || null,
        keterangan: formKeterangan || null,
        jumlah: parseInt(formJumlah) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kas-list"] });
      setDialogOpen(false);
      resetForm();
      toast.success("Transaksi berhasil ditambahkan");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const paymentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("kas").insert({
        tanggal: new Date().toISOString().split("T")[0],
        jenis: "masuk" as const,
        metode: payMetode,
        kategori: "iuran shohibul",
        keterangan: `${payKeterangan} [${payShohibulId}]`,
        jumlah: parseInt(payJumlah) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kas-list"] });
      queryClient.invalidateQueries({ queryKey: ["iuran-payments"] });
      setIuranDialogOpen(false);
      toast.success("Pembayaran berhasil dicatat");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const resetForm = () => {
    setFormTanggal(new Date().toISOString().split("T")[0]);
    setFormJenis("masuk");
    setFormMetode("tunai");
    setFormKategori("");
    setFormKeterangan("");
    setFormJumlah("");
  };

  const openPayDialog = (s: any) => {
    const h = s.hewan_qurban as any;
    setPayShohibulId(s.id);
    setPayNama(s.nama);
    setPayHewan(`${h?.nomor_urut ?? "-"} (${h?.jenis_hewan})`);
    setPayNominal(Number(h?.iuran_per_orang ?? 0));
    setPayJumlah("");
    setPayMetode("tunai");
    const sumber = h?.sumber_hewan ?? "beli_panitia";
    const isIndividu = h?.tipe_kepemilikan === "individu";
    const rincian = isIndividu
      ? (sumber === "bawa_sendiri"
          ? ` | Bawa sendiri | Operasional: ${formatRupiah(Number(h?.biaya_operasional ?? 0))}`
          : ` | Beli panitia | Hewan: ${formatRupiah(Number(h?.harga ?? 0))} + Operasional: ${formatRupiah(Number(h?.biaya_operasional ?? 0))}`)
      : "";
    setPayKeterangan(`Iuran ${s.nama} - ${h?.nomor_urut ?? ""}${rincian}`);
    setIuranDialogOpen(true);
  };

  const totalMasuk = kasList?.filter((k) => k.jenis === "masuk").reduce((a, k) => a + Number(k.jumlah), 0) ?? 0;
  const totalKeluar = kasList?.filter((k) => k.jenis === "keluar").reduce((a, k) => a + Number(k.jumlah), 0) ?? 0;
  const saldo = totalMasuk - totalKeluar;

  const saldoTunai = kasList?.reduce((a, k) => {
    if (k.metode !== "tunai") return a;
    return k.jenis === "masuk" ? a + Number(k.jumlah) : a - Number(k.jumlah);
  }, 0) ?? 0;
  const saldoBank = kasList?.reduce((a, k) => {
    if (k.metode !== "bank") return a;
    return k.jenis === "masuk" ? a + Number(k.jumlah) : a - Number(k.jumlah);
  }, 0) ?? 0;

  const filtered = kasList?.filter((k) => {
    if (filterJenis !== "semua" && k.jenis !== filterJenis) return false;
    if (filterMetode !== "semua" && k.metode !== filterMetode) return false;
    if (searchKeterangan && !(k.keterangan?.toLowerCase().includes(searchKeterangan.toLowerCase()))) return false;
    return true;
  });

  // Chart data
  const chartData = (() => {
    if (!kasList) return [];
    const categories: Record<string, { masuk: number; keluar: number }> = {};
    kasList.forEach((k) => {
      const cat = k.kategori || "Lainnya";
      if (!categories[cat]) categories[cat] = { masuk: 0, keluar: 0 };
      categories[cat][k.jenis] += Number(k.jumlah);
    });
    return Object.entries(categories).map(([name, vals]) => ({ name, ...vals }));
  })();

  // Iuran summary
  const iuranSummary = (() => {
    if (!shohibulIuran) return { lunas: 0, dp: 0, belum: 0, total: 0 };
    let lunas = 0, dp = 0, belum = 0, total = 0;
    shohibulIuran.forEach((s) => {
      const h = s.hewan_qurban as any;
      const iur = Number(h?.iuran_per_orang ?? 0);
      const status = getPaymentStatus(s.id, iur);
      if (status === "lunas") lunas++;
      else if (status === "dp") dp++;
      else belum++;
      total += getPaymentTotal(s.id);
    });
    return { lunas, dp, belum, total };
  })();

  // Penjual summary
  const penjualSummary = (() => {
    if (!hewanList) return { totalBeliPanitia: 0, lunas: 0, belumLunas: 0, totalNilai: 0 };
    const beliPanitia = hewanList.filter((h) => h.sumber_hewan === "beli_panitia");
    let lunas = 0, belumLunas = 0, totalNilai = 0;
    beliPanitia.forEach((h) => {
      const harga = Number(h.harga ?? 0);
      totalNilai += harga;
      const status = getPenjualPaymentStatus(h.id, harga);
      if (status === "lunas") lunas++;
      else belumLunas++;
    });
    return { totalBeliPanitia: beliPanitia.length, lunas, belumLunas, totalNilai };
  })();

  const filteredHewan = hewanList?.filter((h) => {
    if (h.sumber_hewan !== "beli_panitia") return false;
    if (filterPenjual === "semua") return true;
    const harga = Number(h.harga ?? 0);
    return getPenjualPaymentStatus(h.id, harga) === filterPenjual;
  });

  const filteredIuran = shohibulIuran?.filter((s) => {
    if (filterBayar === "semua") return true;
    const h = s.hewan_qurban as any;
    const iur = Number(h?.iuran_per_orang ?? 0);
    return getPaymentStatus(s.id, iur) === filterBayar;
  });

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Keuangan</h1>
        <p className="page-subtitle">Buku kas & iuran shohibul qurban 1447H</p>
      </div>

      <Tabs defaultValue="buku-kas">
        <TabsList>
          <TabsTrigger value="buku-kas">Buku Kas</TabsTrigger>
          <TabsTrigger value="iuran">Iuran Shohibul</TabsTrigger>
          <TabsTrigger value="bayar-penjual">Bayar Penjual</TabsTrigger>
        </TabsList>

        <TabsContent value="buku-kas" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-success" /></div>
                <div><p className="text-sm text-muted-foreground">Total Pemasukan</p><p className="text-xl font-bold text-success">{formatRupiah(totalMasuk)}</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center"><TrendingDown className="h-5 w-5 text-destructive" /></div>
                <div><p className="text-sm text-muted-foreground">Total Pengeluaran</p><p className="text-xl font-bold text-destructive">{formatRupiah(totalKeluar)}</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center"><Wallet className="h-5 w-5 text-info" /></div>
                <div><p className="text-sm text-muted-foreground">Saldo Total</p><p className="text-xl font-bold text-info">{formatRupiah(saldo)}</p></div>
              </CardContent>
            </Card>
          </div>

          {/* Saldo per Metode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-800">
              <CardContent className="p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center"><Banknote className="h-5 w-5 text-amber-600 dark:text-amber-400" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Tunai</p>
                  <p className={`text-xl font-bold ${saldoTunai >= 0 ? "text-amber-600 dark:text-amber-400" : "text-destructive"}`}>{formatRupiah(saldoTunai)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-800">
              <CardContent className="p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center"><Landmark className="h-5 w-5 text-blue-600 dark:text-blue-400" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Bank</p>
                  <p className={`text-xl font-bold ${saldoBank >= 0 ? "text-blue-600 dark:text-blue-400" : "text-destructive"}`}>{formatRupiah(saldoBank)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters + Add */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={filterJenis} onValueChange={setFilterJenis}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Jenis</SelectItem>
                <SelectItem value="masuk">Masuk</SelectItem>
                <SelectItem value="keluar">Keluar</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterMetode} onValueChange={setFilterMetode}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Metode</SelectItem>
                <SelectItem value="tunai">Tunai</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari keterangan..." className="pl-10 w-[200px]" value={searchKeterangan} onChange={(e) => setSearchKeterangan(e.target.value)} />
            </div>
            {isAdmin() && (
              <>
                <Button variant="outline" onClick={() => setShowKasImport(true)}>
                  <FileUp className="mr-2 h-4 w-4" /> Import Excel
                </Button>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button><Plus className="mr-2 h-4 w-4" /> Tambah Transaksi</Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Tambah Transaksi</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Tanggal</Label><Input type="date" value={formTanggal} onChange={(e) => setFormTanggal(e.target.value)} /></div>
                    <div>
                      <Label>Jenis</Label>
                      <RadioGroup value={formJenis} onValueChange={(v) => setFormJenis(v as any)} className="flex gap-4 mt-1">
                        <div className="flex items-center gap-2"><RadioGroupItem value="masuk" id="j-masuk" /><Label htmlFor="j-masuk">Masuk</Label></div>
                        <div className="flex items-center gap-2"><RadioGroupItem value="keluar" id="j-keluar" /><Label htmlFor="j-keluar">Keluar</Label></div>
                      </RadioGroup>
                    </div>
                    <div>
                      <Label>Metode</Label>
                      <RadioGroup value={formMetode} onValueChange={(v) => setFormMetode(v as any)} className="flex gap-4 mt-1">
                        <div className="flex items-center gap-2"><RadioGroupItem value="tunai" id="m-tunai" /><Label htmlFor="m-tunai">Tunai</Label></div>
                        <div className="flex items-center gap-2"><RadioGroupItem value="bank" id="m-bank" /><Label htmlFor="m-bank">Bank</Label></div>
                      </RadioGroup>
                    </div>
                    <div>
                      <Label>Kategori</Label>
                      <Input value={formKategori} onChange={(e) => setFormKategori(e.target.value)} placeholder="Ketik kategori..." list="kategori-list" />
                      <datalist id="kategori-list">
                        {KATEGORI_SUGGESTIONS.map((k) => <option key={k} value={k} />)}
                      </datalist>
                    </div>
                    <div><Label>Keterangan</Label><Textarea value={formKeterangan} onChange={(e) => setFormKeterangan(e.target.value)} /></div>
                    <div><Label>Jumlah (Rp)</Label><Input type="number" value={formJumlah} onChange={(e) => setFormJumlah(e.target.value)} placeholder="0" /></div>
                    <Button className="w-full" onClick={() => insertMutation.mutate()} disabled={insertMutation.isPending || !formJumlah}>
                      {insertMutation.isPending ? "Menyimpan..." : "Simpan"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              </>
            )}
          </div>

          {/* Table */}
          {isLoading ? <Skeleton className="h-48 w-full" /> : (
            <div className="table-container">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">No</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Metode</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                    {isAdmin() && <TableHead className="w-20">Aksi</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.length === 0 && (
                    <TableRow><TableCell colSpan={isAdmin() ? 8 : 7} className="text-center py-8 text-muted-foreground">Belum ada transaksi</TableCell></TableRow>
                  )}
                  {filtered?.map((k, idx) => (
                    <TableRow key={k.id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{formatTanggal(k.tanggal)}</TableCell>
                      <TableCell>
                        <Badge className={k.jenis === "masuk" ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                          {k.jenis}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">{k.metode}</TableCell>
                      <TableCell>{k.kategori ?? "-"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{k.keterangan ?? "-"}</TableCell>
                      <TableCell className="text-right font-semibold">{formatRupiah(Number(k.jumlah))}</TableCell>
                      {isAdmin() && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditDialog(k)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Hapus Transaksi?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {k.keterangan ?? k.kategori ?? "Transaksi ini"} sebesar {formatRupiah(Number(k.jumlah))} akan dihapus permanen.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMutation.mutate(k.id)} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold mb-4">Pemasukan vs Pengeluaran per Kategori</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`} />
                    <Tooltip formatter={(v: number) => formatRupiah(v)} />
                    <Legend />
                    <Bar dataKey="masuk" fill="hsl(142, 71%, 45%)" name="Masuk" />
                    <Bar dataKey="keluar" fill="hsl(0, 84%, 60%)" name="Keluar" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="iuran" className="space-y-6">
          {loadingIuran ? <Skeleton className="h-48 w-full" /> : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-success">{iuranSummary.lunas}</p>
                    <p className="text-xs text-muted-foreground">Lunas</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-warning">{iuranSummary.dp}</p>
                    <p className="text-xs text-muted-foreground">DP</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-destructive">{iuranSummary.belum}</p>
                    <p className="text-xs text-muted-foreground">Belum Bayar</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-lg font-bold text-primary">{formatRupiah(iuranSummary.total)}</p>
                    <p className="text-xs text-muted-foreground">Total Terkumpul</p>
                  </CardContent>
                </Card>
              </div>

              {/* Filter */}
              <div className="flex gap-2">
                {[
                  { val: "semua", label: "Semua" },
                  { val: "belum", label: "Belum Bayar" },
                  { val: "dp", label: "DP" },
                  { val: "lunas", label: "Lunas" },
                ].map((f) => (
                  <Button
                    key={f.val}
                    size="sm"
                    variant={filterBayar === f.val ? "default" : "outline"}
                    onClick={() => setFilterBayar(f.val)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>

              <div className="table-container">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Hewan</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead>Sumber</TableHead>
                      <TableHead className="text-right">Rincian Iuran</TableHead>
                      <TableHead className="text-right">Terbayar</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIuran?.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Belum ada data</TableCell></TableRow>
                    )}
                    {filteredIuran?.map((s) => {
                      const h = s.hewan_qurban as any;
                      const iur = Number(h?.iuran_per_orang ?? 0);
                      const paid = getPaymentTotal(s.id);
                      const status = getPaymentStatus(s.id, iur);
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.nama}</TableCell>
                          <TableCell>{h?.nomor_urut ?? "-"} ({h?.jenis_hewan})</TableCell>
                          <TableCell className="capitalize">{h?.tipe_kepemilikan}</TableCell>
                          <TableCell>
                            {h?.tipe_kepemilikan === "individu" ? (
                              <Badge variant="outline" className="text-xs">
                                {SUMBER_HEWAN_LABEL[(h?.sumber_hewan as SumberHewan) ?? "beli_panitia"]}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Kolektif</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <p className="font-semibold">{formatRupiah(iur)}</p>
                            {h?.tipe_kepemilikan === "individu" ? (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {h?.sumber_hewan === "bawa_sendiri"
                                  ? `Operasional: ${formatRupiah(Number(h?.biaya_operasional ?? 0))}`
                                  : `Hewan: ${formatRupiah(Number(h?.harga ?? 0))} + Op: ${formatRupiah(Number(h?.biaya_operasional ?? 0))}`
                                }
                              </p>
                            ) : h?.jenis_hewan === "sapi" ? (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Hewan: {formatRupiah(Math.ceil(Number(h?.harga ?? 0) / 7 / 1000) * 1000)} + Op: {formatRupiah(Number(h?.biaya_operasional ?? 0))}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">{formatRupiah(paid)}</TableCell>
                          <TableCell>
                            <Badge className={
                              status === "lunas" ? "bg-success/10 text-success border-success/20" :
                              status === "dp" ? "bg-warning/10 text-warning border-warning/20" :
                              "bg-destructive/10 text-destructive border-destructive/20"
                            }>
                              {status === "lunas" ? "Lunas" : status === "dp" ? "DP" : "Belum Bayar"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" onClick={() => openPayDialog(s)}>
                              <CreditCard className="mr-1 h-3 w-3" /> Bayar
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="bayar-penjual" className="space-y-6">
          {loadingHewan ? <Skeleton className="h-48 w-full" /> : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-primary">{penjualSummary.totalBeliPanitia}</p>
                    <p className="text-xs text-muted-foreground">Beli Panitia</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-success">{penjualSummary.lunas}</p>
                    <p className="text-xs text-muted-foreground">Sudah Lunas</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-destructive">{penjualSummary.belumLunas}</p>
                    <p className="text-xs text-muted-foreground">Belum Lunas</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-lg font-bold text-primary">{formatRupiah(penjualSummary.totalNilai)}</p>
                    <p className="text-xs text-muted-foreground">Total Nilai Hewan</p>
                  </CardContent>
                </Card>
              </div>

              {/* Filter */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { val: "semua", label: "Semua" },
                  { val: "belum", label: "Belum Bayar" },
                  { val: "dp", label: "DP" },
                  { val: "lunas", label: "Lunas" },
                ].map((f) => (
                  <Button
                    key={f.val}
                    size="sm"
                    variant={filterPenjual === f.val ? "default" : "outline"}
                    onClick={() => setFilterPenjual(f.val)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>

              <div className="table-container">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No Urut</TableHead>
                      <TableHead>Jenis</TableHead>
                      <TableHead>Sumber</TableHead>
                      <TableHead>Penjual</TableHead>
                      <TableHead className="text-right">Harga</TableHead>
                      <TableHead className="text-right">Terbayar</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHewan?.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Belum ada data</TableCell></TableRow>
                    )}
                    {filteredHewan?.map((h) => {
                      const isBawaSendiri = h.sumber_hewan === "bawa_sendiri";
                      const harga = Number(h.harga ?? 0);
                      const paid = isBawaSendiri ? 0 : getPenjualPaymentTotal(h.id);
                      const status = isBawaSendiri ? "bawa_sendiri" : getPenjualPaymentStatus(h.id, harga);
                      return (
                        <TableRow key={h.id}>
                          <TableCell className="font-medium">{h.nomor_urut}</TableCell>
                          <TableCell className="capitalize">{h.jenis_hewan}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {isBawaSendiri ? "Bawa Sendiri" : "Beli Panitia"}
                            </Badge>
                          </TableCell>
                          <TableCell>{isBawaSendiri ? <span className="text-muted-foreground">-</span> : (h.nama_penjual || "-")}</TableCell>
                          <TableCell className="text-right font-semibold">{formatRupiah(harga)}</TableCell>
                          <TableCell className="text-right">{isBawaSendiri ? "-" : formatRupiah(paid)}</TableCell>
                          <TableCell>
                            {isBawaSendiri ? (
                              <Badge variant="secondary" className="text-xs">Bawa Sendiri</Badge>
                            ) : (
                              <Badge className={
                                status === "lunas" ? "bg-success/10 text-success border-success/20" :
                                status === "dp" ? "bg-warning/10 text-warning border-warning/20" :
                                "bg-destructive/10 text-destructive border-destructive/20"
                              }>
                                {status === "lunas" ? "Lunas" : status === "dp" ? "DP" : "Belum Bayar"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {isBawaSendiri ? (
                              <Button size="sm" variant="outline" disabled>
                                <Store className="mr-1 h-3 w-3" /> Bayar
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => openPenjualPayDialog(h)}>
                                <Store className="mr-1 h-3 w-3" /> Bayar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Penjual Payment Dialog */}
      <Dialog open={penjualDialogOpen} onOpenChange={setPenjualDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Catat Pembayaran ke Penjual</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nama Penjual</Label><Input value={penjualNama} readOnly className="bg-muted" /></div>
            <div><Label>No HP Penjual</Label><Input value={penjualHp || "-"} readOnly className="bg-muted" /></div>
            <div><Label>Harga Hewan (Total)</Label><Input value={formatRupiah(penjualHarga)} readOnly className="bg-muted font-semibold" /></div>
            <div>
              <Label>Sudah Terbayar</Label>
              <Input value={formatRupiah(getPenjualPaymentTotal(penjualHewanId))} readOnly className="bg-muted" />
            </div>
            <div>
              <Label>Sisa</Label>
              <Input value={formatRupiah(Math.max(0, penjualHarga - getPenjualPaymentTotal(penjualHewanId)))} readOnly className="bg-muted" />
            </div>
            <div><Label>Jumlah Dibayar (Rp)</Label><Input type="number" value={penjualJumlah} onChange={(e) => setPenjualJumlah(e.target.value)} placeholder="0" /></div>
            <div>
              <Label>Metode</Label>
              <RadioGroup value={penjualMetode} onValueChange={(v) => setPenjualMetode(v as any)} className="flex gap-4 mt-1">
                <div className="flex items-center gap-2"><RadioGroupItem value="tunai" id="pj-tunai" /><Label htmlFor="pj-tunai">Tunai</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="bank" id="pj-bank" /><Label htmlFor="pj-bank">Bank</Label></div>
              </RadioGroup>
            </div>
            <div><Label>Keterangan</Label><Textarea value={penjualKeterangan} onChange={(e) => setPenjualKeterangan(e.target.value)} /></div>
            <Button className="w-full" onClick={() => penjualPayMutation.mutate()} disabled={penjualPayMutation.isPending || !penjualJumlah}>
              {penjualPayMutation.isPending ? "Menyimpan..." : "Simpan Pembayaran"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Iuran Payment Dialog */}
      <Dialog open={iuranDialogOpen} onOpenChange={setIuranDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Catat Pembayaran Iuran</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nama Shohibul</Label><Input value={payNama} readOnly className="bg-muted" /></div>
            <div><Label>Hewan</Label><Input value={payHewan} readOnly className="bg-muted" /></div>
            <div><Label>Total yang Harus Dibayar ke Panitia</Label><Input value={formatRupiah(payNominal)} readOnly className="bg-muted font-semibold" /></div>
            <div><Label>Jumlah Dibayar (Rp)</Label><Input type="number" value={payJumlah} onChange={(e) => setPayJumlah(e.target.value)} placeholder="0" /></div>
            <div>
              <Label>Metode</Label>
              <RadioGroup value={payMetode} onValueChange={(v) => setPayMetode(v as any)} className="flex gap-4 mt-1">
                <div className="flex items-center gap-2"><RadioGroupItem value="tunai" id="pay-tunai" /><Label htmlFor="pay-tunai">Tunai</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="bank" id="pay-bank" /><Label htmlFor="pay-bank">Bank</Label></div>
              </RadioGroup>
            </div>
            <div><Label>Keterangan</Label><Textarea value={payKeterangan} onChange={(e) => setPayKeterangan(e.target.value)} /></div>
            <Button className="w-full" onClick={() => paymentMutation.mutate()} disabled={paymentMutation.isPending || !payJumlah}>
              {paymentMutation.isPending ? "Menyimpan..." : "Simpan Pembayaran"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Edit Transaksi Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) { setEditId(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Transaksi</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Tanggal</Label><Input type="date" value={formTanggal} onChange={(e) => setFormTanggal(e.target.value)} /></div>
            <div>
              <Label>Jenis</Label>
              <RadioGroup value={formJenis} onValueChange={(v) => setFormJenis(v as any)} className="flex gap-4 mt-1">
                <div className="flex items-center gap-2"><RadioGroupItem value="masuk" id="ej-masuk" /><Label htmlFor="ej-masuk">Masuk</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="keluar" id="ej-keluar" /><Label htmlFor="ej-keluar">Keluar</Label></div>
              </RadioGroup>
            </div>
            <div>
              <Label>Metode</Label>
              <RadioGroup value={formMetode} onValueChange={(v) => setFormMetode(v as any)} className="flex gap-4 mt-1">
                <div className="flex items-center gap-2"><RadioGroupItem value="tunai" id="em-tunai" /><Label htmlFor="em-tunai">Tunai</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="bank" id="em-bank" /><Label htmlFor="em-bank">Bank</Label></div>
              </RadioGroup>
            </div>
            <div>
              <Label>Kategori</Label>
              <Input value={formKategori} onChange={(e) => setFormKategori(e.target.value)} placeholder="Ketik kategori..." list="kategori-list-edit" />
              <datalist id="kategori-list-edit">
                {KATEGORI_SUGGESTIONS.map((k) => <option key={k} value={k} />)}
              </datalist>
            </div>
            <div><Label>Keterangan</Label><Textarea value={formKeterangan} onChange={(e) => setFormKeterangan(e.target.value)} /></div>
            <div><Label>Jumlah (Rp)</Label><Input type="number" value={formJumlah} onChange={(e) => setFormJumlah(e.target.value)} placeholder="0" /></div>
            <Button className="w-full" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending || !formJumlah}>
              {updateMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Kas Dialog */}
      <ImportExcelDialog
        open={showKasImport}
        onOpenChange={setShowKasImport}
        title="Import Transaksi Kas dari Excel"
        columns={[
          { key: "tanggal", label: "Tanggal", required: true },
          { key: "jenis", label: "Jenis", required: true },
          { key: "jumlah", label: "Jumlah", required: true },
          { key: "metode", label: "Metode" },
          { key: "kategori", label: "Kategori" },
          { key: "keterangan", label: "Keterangan" },
        ]}
        templateData={[
          { tanggal: "2025-06-07", jenis: "masuk", jumlah: 500000, metode: "tunai", kategori: "iuran shohibul", keterangan: "Iuran Ahmad" },
          { tanggal: "2025-06-08", jenis: "keluar", jumlah: 200000, metode: "bank", kategori: "operasional", keterangan: "Beli tali" },
        ]}
        templateFileName="template-kas.xlsx"
        validateRow={(r) => {
          const jenis = String(r.jenis ?? "").toLowerCase().trim();
          if (jenis !== "masuk" && jenis !== "keluar") return false;
          const jumlah = Number(r.jumlah);
          if (!jumlah || jumlah <= 0) return false;
          return !!r.tanggal;
        }}
        summaryRender={(rows) => {
          const masuk = rows.filter(r => String(r.jenis).toLowerCase().trim() === "masuk").reduce((s, r) => s + Number(r.jumlah), 0);
          const keluar = rows.filter(r => String(r.jenis).toLowerCase().trim() === "keluar").reduce((s, r) => s + Number(r.jumlah), 0);
          return (
            <div className="flex gap-4 text-sm">
              <span className="text-success font-medium">Masuk: {formatRupiah(masuk)}</span>
              <span className="text-destructive font-medium">Keluar: {formatRupiah(keluar)}</span>
            </div>
          );
        }}
        onImport={async (rows) => {
          const inserts = rows.map((r) => {
            let tanggal = String(r.tanggal).trim();
            // Try DD/MM/YYYY format
            const ddmmMatch = tanggal.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
            if (ddmmMatch) tanggal = `${ddmmMatch[3]}-${ddmmMatch[2].padStart(2, "0")}-${ddmmMatch[1].padStart(2, "0")}`;
            
            const metode = ["tunai", "bank"].includes(String(r.metode ?? "").toLowerCase().trim())
              ? String(r.metode).toLowerCase().trim() as "tunai" | "bank"
              : "tunai" as const;

            return {
              tanggal,
              jenis: String(r.jenis).toLowerCase().trim() as "masuk" | "keluar",
              jumlah: Math.round(Number(r.jumlah)),
              metode,
              kategori: r.kategori ? String(r.kategori).trim() : null,
              keterangan: r.keterangan ? String(r.keterangan).trim() : null,
              dibuat_oleh: panitiaId,
            };
          });
          const { error } = await supabase.from("kas").insert(inserts);
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ["kas-list"] });
          queryClient.invalidateQueries({ queryKey: ["iuran-payments"] });
          toast.success(`${inserts.length} transaksi berhasil diimport`);
        }}
      />
    </div>
  );
};

export default KeuanganPage;
