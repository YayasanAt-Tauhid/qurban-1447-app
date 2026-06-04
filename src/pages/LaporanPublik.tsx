import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Share2, Wallet, Banknote, Landmark } from "lucide-react";
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

  const kasAscending = [...(kasList ?? [])].sort((a, b) =>
    a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : (a.created_at ?? "").localeCompare(b.created_at ?? "")
  );

  const computeLedger = (rows: typeof kasAscending) => {
    let running = 0;
    return rows.map((k) => {
      running += k.jenis === "masuk" ? Number(k.jumlah) : -Number(k.jumlah);
      return { ...k, saldoBerjalan: running };
    });
  };

  const kasUmumLedger = computeLedger(kasAscending);
  const kasTunaiLedger = computeLedger(kasAscending.filter((k) => k.metode === "tunai"));
  const kasBankLedger = computeLedger(kasAscending.filter((k) => k.metode === "bank"));

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
          <Skeleton className="h-24 rounded-lg" />
        ) : (
          <>
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

            {/* Buku Kas Tabs */}
            <Tabs defaultValue="kas-umum">
              <TabsList className="w-full">
                <TabsTrigger value="kas-umum" className="flex-1">Buku Kas Umum</TabsTrigger>
                <TabsTrigger value="kas-tunai" className="flex-1">Kas Pembantu Tunai</TabsTrigger>
                <TabsTrigger value="kas-bank" className="flex-1">Kas Pembantu Bank</TabsTrigger>
              </TabsList>

              {/* Buku Kas Umum */}
              <TabsContent value="kas-umum">
                <Card className="mt-3">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table className="ledger-table">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">No</TableHead>
                            <TableHead>Tanggal</TableHead>
                            <TableHead>Uraian</TableHead>
                            <TableHead>Kategori</TableHead>
                            <TableHead>Metode</TableHead>
                            <TableHead className="text-right">Debet</TableHead>
                            <TableHead className="text-right">Kredit</TableHead>
                            <TableHead className="text-right">Saldo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {kasUmumLedger.length === 0 && (
                            <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Belum ada transaksi</TableCell></TableRow>
                          )}
                          {kasUmumLedger.map((k, idx) => (
                            <TableRow key={k.id}>
                              <TableCell>{idx + 1}</TableCell>
                              <TableCell className="whitespace-nowrap">{formatTanggal(k.tanggal)}</TableCell>
                              <TableCell className="min-w-[150px]">{k.keterangan ?? "-"}</TableCell>
                              <TableCell>{k.kategori ?? "-"}</TableCell>
                              <TableCell><Badge variant="outline" className="text-xs capitalize">{k.metode}</Badge></TableCell>
                              <TableCell className="text-right font-semibold text-success">{k.jenis === "masuk" ? formatRupiah(Number(k.jumlah)) : ""}</TableCell>
                              <TableCell className="text-right font-semibold text-destructive">{k.jenis === "keluar" ? formatRupiah(Number(k.jumlah)) : ""}</TableCell>
                              <TableCell className={`text-right font-bold ${k.saldoBerjalan >= 0 ? "text-info" : "text-destructive"}`}>{formatRupiah(k.saldoBerjalan)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Kas Pembantu Tunai */}
              <TabsContent value="kas-tunai">
                <Card className="mt-3">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table className="ledger-table">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">No</TableHead>
                            <TableHead>Tanggal</TableHead>
                            <TableHead>Uraian</TableHead>
                            <TableHead>Kategori</TableHead>
                            <TableHead className="text-right">Debet</TableHead>
                            <TableHead className="text-right">Kredit</TableHead>
                            <TableHead className="text-right">Saldo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {kasTunaiLedger.length === 0 && (
                            <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Belum ada transaksi tunai</TableCell></TableRow>
                          )}
                          {kasTunaiLedger.map((k, idx) => (
                            <TableRow key={k.id}>
                              <TableCell>{idx + 1}</TableCell>
                              <TableCell className="whitespace-nowrap">{formatTanggal(k.tanggal)}</TableCell>
                              <TableCell className="min-w-[150px]">{k.keterangan ?? "-"}</TableCell>
                              <TableCell>{k.kategori ?? "-"}</TableCell>
                              <TableCell className="text-right font-semibold text-success">{k.jenis === "masuk" ? formatRupiah(Number(k.jumlah)) : ""}</TableCell>
                              <TableCell className="text-right font-semibold text-destructive">{k.jenis === "keluar" ? formatRupiah(Number(k.jumlah)) : ""}</TableCell>
                              <TableCell className={`text-right font-bold ${k.saldoBerjalan >= 0 ? "text-amber-600 dark:text-amber-400" : "text-destructive"}`}>{formatRupiah(k.saldoBerjalan)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Kas Pembantu Bank */}
              <TabsContent value="kas-bank">
                <Card className="mt-3">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table className="ledger-table">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">No</TableHead>
                            <TableHead>Tanggal</TableHead>
                            <TableHead>Uraian</TableHead>
                            <TableHead>Kategori</TableHead>
                            <TableHead className="text-right">Debet</TableHead>
                            <TableHead className="text-right">Kredit</TableHead>
                            <TableHead className="text-right">Saldo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {kasBankLedger.length === 0 && (
                            <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Belum ada transaksi bank</TableCell></TableRow>
                          )}
                          {kasBankLedger.map((k, idx) => (
                            <TableRow key={k.id}>
                              <TableCell>{idx + 1}</TableCell>
                              <TableCell className="whitespace-nowrap">{formatTanggal(k.tanggal)}</TableCell>
                              <TableCell className="min-w-[150px]">{k.keterangan ?? "-"}</TableCell>
                              <TableCell>{k.kategori ?? "-"}</TableCell>
                              <TableCell className="text-right font-semibold text-success">{k.jenis === "masuk" ? formatRupiah(Number(k.jumlah)) : ""}</TableCell>
                              <TableCell className="text-right font-semibold text-destructive">{k.jenis === "keluar" ? formatRupiah(Number(k.jumlah)) : ""}</TableCell>
                              <TableCell className={`text-right font-bold ${k.saldoBerjalan >= 0 ? "text-blue-600 dark:text-blue-400" : "text-destructive"}`}>{formatRupiah(k.saldoBerjalan)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
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
