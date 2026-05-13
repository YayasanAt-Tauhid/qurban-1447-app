import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Share2, TrendingUp, TrendingDown, Wallet, Banknote, Landmark } from "lucide-react";
import { formatRupiah, formatTanggal } from "@/lib/qurban-utils";

const LaporanPublik = () => {
  const { data: kasList, isLoading } = useQuery({
    queryKey: ["kas-publik"],
    queryFn: async () => {
      const { data, error } = await supabase.from("kas").select("*").order("tanggal", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

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

  const shareWhatsApp = () => {
    const msg = `📊 Laporan Keuangan Qurban 1447H\nMasjid At-Tauhid Pangkalpinang\n\nPemasukan: ${formatRupiah(totalMasuk)}\nPengeluaran: ${formatRupiah(totalKeluar)}\nSaldo: ${formatRupiah(saldo)}\n\nLihat detail: ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 py-6">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center">
            <span className="text-primary-foreground text-2xl">🕌</span>
          </div>
          <h1 className="text-2xl font-bold">Laporan Keuangan Qurban 1447H</h1>
          <p className="text-muted-foreground">Masjid At-Tauhid Pangkalpinang</p>
          <Button variant="outline" size="sm" onClick={shareWhatsApp} className="mt-2">
            <Share2 className="mr-2 h-4 w-4" /> Bagikan via WhatsApp
          </Button>
        </div>

        {/* Summary */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Pemasukan</p>
                    <p className="text-xl font-bold text-success">{formatRupiah(totalMasuk)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <TrendingDown className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Pengeluaran</p>
                    <p className="text-xl font-bold text-destructive">{formatRupiah(totalKeluar)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-info" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo</p>
                    <p className="text-xl font-bold text-info">{formatRupiah(saldo)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Saldo per Metode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-800">
                <CardContent className="p-5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                    <Banknote className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo Tunai</p>
                    <p className={`text-xl font-bold ${saldoTunai >= 0 ? "text-amber-600 dark:text-amber-400" : "text-destructive"}`}>{formatRupiah(saldoTunai)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-blue-200 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-800">
                <CardContent className="p-5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                    <Landmark className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo Bank</p>
                    <p className={`text-xl font-bold ${saldoBank >= 0 ? "text-blue-600 dark:text-blue-400" : "text-destructive"}`}>{formatRupiah(saldoBank)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Keterangan</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead>Metode</TableHead>
                        <TableHead className="text-right">Jumlah</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kasList?.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Belum ada transaksi</TableCell>
                        </TableRow>
                      )}
                      {kasList?.map((k) => (
                        <TableRow key={k.id}>
                          <TableCell className="whitespace-nowrap">{formatTanggal(k.tanggal)}</TableCell>
                          <TableCell className="max-w-[250px] truncate">{k.keterangan ?? "-"}</TableCell>
                          <TableCell>{k.kategori ?? "-"}</TableCell>
                          <TableCell className="capitalize">{k.metode ?? "-"}</TableCell>
                          <TableCell className={`text-right font-semibold ${k.jenis === "masuk" ? "text-success" : "text-destructive"}`}>
                            {k.jenis === "masuk" ? "+" : "-"}{formatRupiah(Number(k.jumlah))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground py-4 border-t">
          Data diperbarui secara real-time · Masjid At-Tauhid Pangkalpinang
        </div>
      </div>
    </div>
  );
};

export default LaporanPublik;
