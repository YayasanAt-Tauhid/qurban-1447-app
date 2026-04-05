import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Printer, Pencil, Trash2 } from "lucide-react";
import { KATEGORI_BAGIAN, getKuotaKategori } from "@/pages/UndianBagian";
import { formatRupiah, formatTanggal, hitungTotalPerOrang, getBiayaOperasional, SUMBER_HEWAN_LABEL, type SumberHewan } from "@/lib/qurban-utils";
import { toast } from "sonner";
import { useState } from "react";
import jsPDF from "jspdf";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";



const HewanDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const { isAdmin } = useAuth();

  const { data: hewan, isLoading } = useQuery({
    queryKey: ["hewan-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("hewan_qurban").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: shohibulList } = useQuery({
    queryKey: ["shohibul-by-hewan", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("shohibul_qurban").select("*").eq("hewan_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: requestList } = useQuery({
    queryKey: ["request-bagian", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("request_bagian").select("*, shohibul_qurban(nama)").eq("hewan_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Individu: kuota per kategori = 1 shohibul, tapi shohibul itu dapat SEMUA slot kategori tsb
  // Kolektif: kuota per kategori = jumlah slots (maks berapa shohibul bisa request)
  const isIndividu = hewan?.tipe_kepemilikan === "individu";

  const toggleMutation = useMutation({
    mutationFn: async ({ bagian, shohibulId }: { bagian: string; shohibulId: string }) => {
      const existing = requestList?.find((r) => r.bagian === bagian && r.shohibul_qurban_id === shohibulId);
      const kategori = KATEGORI_BAGIAN.find(k => k.id === bagian);
      if (existing) {
        // Hapus dari request_bagian
        const { error } = await supabase.from("request_bagian").delete().eq("id", existing.id);
        if (error) throw error;
        // Hapus juga semua pilihan_bagian slot kategori ini milik shohibul ini
        if (kategori) {
          for (const slot of kategori.slots) {
            await supabase.from("pilihan_bagian")
              .delete()
              .eq("hewan_id", id!)
              .eq("shohibul_id", shohibulId)
              .eq("bagian", slot);
          }
        }
      } else {
        // Cek kuota efektif
        const sudahRequest = requestList?.filter(r => r.bagian === bagian).length ?? 0;
        // Individu: 1 shohibul per kategori (tapi dapat semua slot)
        // Kolektif: maks sesuai jumlah slot
        const kuotaEfektif = isIndividu ? 1 : getKuotaKategori(bagian);
        if (sudahRequest >= kuotaEfektif) {
          throw new Error(
            isIndividu
              ? `Bagian ini sudah direquest shohibul lain`
              : `Kuota penuh (maks ${kuotaEfektif} orang untuk bagian ini)`
          );
        }
        // Simpan ke request_bagian
        const { error } = await supabase.from("request_bagian").insert({ bagian, hewan_id: id!, shohibul_qurban_id: shohibulId });
        if (error) throw error;
        // Sync ke pilihan_bagian
        if (kategori) {
          if (isIndividu) {
            // Individu: langsung dapat SEMUA slot dari kategori ini (misal tulang_kaki → 4 slot sekaligus)
            for (const slot of kategori.slots) {
              await supabase.from("pilihan_bagian").insert({
                hewan_id: id!, shohibul_id: shohibulId, bagian: slot,
              });
            }
          } else {
            // Kolektif: ambil slot berikutnya yang belum ada pemiliknya
            const { data: sudahPilih } = await supabase
              .from("pilihan_bagian")
              .select("bagian")
              .eq("hewan_id", id!)
              .in("bagian", kategori.slots);
            const slotTerpakai = new Set((sudahPilih ?? []).map(p => p.bagian));
            const slotKosong = kategori.slots.find(s => !slotTerpakai.has(s));
            if (slotKosong) {
              await supabase.from("pilihan_bagian").insert({
                hewan_id: id!, shohibul_id: shohibulId, bagian: slotKosong,
              });
            }
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request-bagian", id] });
      toast.success("Request bagian diperbarui & disinkron ke undian");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const jenisHewan = hewan?.jenis_hewan ?? "sapi";
      const tipeKepemilikan = hewan?.tipe_kepemilikan ?? "individu";
      const sumberHewan: SumberHewan = (hewan?.sumber_hewan as SumberHewan) ?? "beli_panitia";
      const isBawaSendiri = tipeKepemilikan === "individu" && sumberHewan === "bawa_sendiri";
      const harga = isBawaSendiri ? 0 : (parseInt(editForm.harga) || 0);
      const operasional = getBiayaOperasional(jenisHewan, tipeKepemilikan);
      const iuran = hitungTotalPerOrang(harga, jenisHewan, tipeKepemilikan, sumberHewan);
      const { error } = await supabase.from("hewan_qurban").update({
        nomor_urut: editForm.nomor_urut,
        ras: editForm.ras || null,
        nama_penjual: editForm.nama_penjual || null,
        hp_penjual: editForm.hp_penjual || null,
        alamat_penjual: editForm.alamat_penjual || null,
        harga,
        biaya_operasional: operasional,
        iuran_per_orang: iuran,
        estimasi_bobot: parseInt(editForm.estimasi_bobot) || null,
        uang_muka: parseInt(editForm.uang_muka) || 0,
        catatan: editForm.catatan || null,
        status: editForm.status,
        tanggal_booking: editForm.status !== "survei" ? (editForm.tanggal_booking || null) : null,
        nama_petugas_booking: editForm.status !== "survei" ? (editForm.nama_petugas_booking || null) : null,
      }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hewan-detail", id] });
      setEditing(false);
      toast.success("Data hewan berhasil diperbarui");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (shohibulList && shohibulList.length > 0) {
        throw new Error("Tidak bisa menghapus hewan yang sudah memiliki peserta terdaftar.");
      }
      const { error } = await supabase.from("hewan_qurban").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Hewan berhasil dihapus");
      navigate("/hewan");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const startEdit = () => {
    if (!hewan) return;
    setEditForm({
      nomor_urut: hewan.nomor_urut,
      ras: hewan.ras || "",
      nama_penjual: hewan.nama_penjual || "",
      hp_penjual: hewan.hp_penjual || "",
      alamat_penjual: hewan.alamat_penjual || "",
      harga: String(hewan.harga),
      sumber_hewan: hewan.sumber_hewan || "beli_panitia",
      estimasi_bobot: hewan.estimasi_bobot ? String(hewan.estimasi_bobot) : "",
      uang_muka: String(hewan.uang_muka ?? 0),
      catatan: hewan.catatan || "",
      status: hewan.status,
      tanggal_booking: hewan.tanggal_booking || "",
      nama_petugas_booking: hewan.nama_petugas_booking || "",
    });
    setEditing(true);
  };

  const getRequestsForKategori = (kategoriId: string) => requestList?.filter((r) => r.bagian === kategoriId) ?? [];

  const getBadgeKategori = (kategoriId: string) => {
    const reqs = getRequestsForKategori(kategoriId);
    const kuotaKolektif = getKuotaKategori(kategoriId);
    if (reqs.length === 0) return <Badge variant="outline" className="text-muted-foreground">Belum ada minat</Badge>;
    if (isIndividu) {
      // Individu: cukup tampilkan siapa yang request, dan info dapat semua slot
      const slotCount = KATEGORI_BAGIAN.find(k => k.id === kategoriId)?.slots.length ?? 1;
      return <Badge className="bg-success/10 text-success border-success/20">
        ✓ Diminta {slotCount > 1 ? `(dapat semua ${slotCount})` : ""}
      </Badge>;
    }
    if (reqs.length < kuotaKolektif) return <Badge className="bg-success/10 text-success border-success/20">{reqs.length}/{kuotaKolektif} peminat</Badge>;
    return <Badge className="bg-warning/10 text-warning border-warning/20">Penuh ({kuotaKolektif}/{kuotaKolektif})</Badge>;
  };

  const cetakDistribusi = () => {
    if (!hewan) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Lembar Distribusi Bagian Hewan", 14, 20);
    doc.setFontSize(12);
    doc.text(`Hewan: ${hewan.nomor_urut} (${hewan.jenis_hewan})`, 14, 30);
    doc.text(`Tanggal cetak: ${formatTanggal(new Date())}`, 14, 37);
    doc.text("Masjid At-Tauhid Pangkalpinang — Qurban 1447H", 14, 44);
    let y = 58;
    KATEGORI_BAGIAN.forEach(({ id, label }) => {
      const reqs = getRequestsForKategori(id);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, 14, y);
      doc.setFont("helvetica", "normal");
      if (reqs.length === 0) { doc.text("→ Mustahiq", 60, y); }
      else { doc.text(reqs.map((r) => (r as any).shohibul_qurban?.nama ?? "-").join(", "), 60, y); }
      y += 8;
    });
    doc.save(`distribusi-${hewan.nomor_urut}.pdf`);
    toast.success("PDF distribusi berhasil diunduh");
  };

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div>;
  if (!hewan) return <p className="text-muted-foreground">Hewan tidak ditemukan.</p>;

  const statusColors: Record<string, string> = {
    survei: "bg-warning/10 text-warning border-warning/20",
    booking: "bg-info/10 text-info border-info/20",
    lunas: "bg-success/10 text-success border-success/20",
  };

  const updateField = (key: string, value: string) => setEditForm((p: any) => ({ ...p, [key]: value }));

  return (
    <div className="space-y-6">
      <div className="page-header">
        <Button variant="ghost" size="sm" onClick={() => navigate("/hewan")} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="page-title">{hewan.nomor_urut}</h1>
            <p className="page-subtitle capitalize">
              {hewan.jenis_hewan} · {hewan.tipe_kepemilikan} ·{" "}
              <Badge variant="outline" className={statusColors[hewan.status] || ""}>{hewan.status}</Badge>
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin() && (
              <Button variant="outline" onClick={startEdit} disabled={editing}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Button>
            )}
            {hewan.jenis_hewan === "sapi" && hewan.tipe_kepemilikan === "kolektif" && (
              <Button
                variant="outline"
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={() => navigate(`/hewan/${hewan.id}/undian`)}
              >
                🎯 Pembagian Bagian
              </Button>
            )}
            <Button onClick={cetakDistribusi}>
              <Printer className="mr-2 h-4 w-4" /> Cetak
            </Button>
            {isAdmin() && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hapus Hewan?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {shohibulList && shohibulList.length > 0
                        ? "Tidak bisa menghapus hewan yang sudah memiliki peserta terdaftar."
                        : "Tindakan ini tidak bisa dibatalkan. Hewan akan dihapus permanen."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate()}
                      disabled={!!(shohibulList && shohibulList.length > 0) || deleteMutation.isPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Hapus
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>

      {/* Info Card - Edit or View */}
      <Card>
        <CardContent className="p-5">
          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Nomor Urut</Label><Input value={editForm.nomor_urut} onChange={(e) => updateField("nomor_urut", e.target.value)} /></div>
                <div className="space-y-2"><Label>Ras</Label><Input value={editForm.ras} onChange={(e) => updateField("ras", e.target.value)} /></div>
                <div className="space-y-2"><Label>Harga (Rp)</Label><Input type="number" value={editForm.harga} onChange={(e) => updateField("harga", e.target.value)} /></div>
                <div className="space-y-2"><Label>Estimasi Bobot (kg)</Label><Input type="number" value={editForm.estimasi_bobot} onChange={(e) => updateField("estimasi_bobot", e.target.value)} /></div>
                <div className="space-y-2"><Label>Uang Muka (Rp)</Label><Input type="number" value={editForm.uang_muka} onChange={(e) => updateField("uang_muka", e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={editForm.status} onValueChange={(v) => updateField("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="survei">Survei</SelectItem>
                      <SelectItem value="booking">Booking</SelectItem>
                      <SelectItem value="lunas">Lunas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editForm.status !== "survei" && (
                  <>
                    <div className="space-y-2"><Label>Tanggal Booking</Label><Input type="date" value={editForm.tanggal_booking} onChange={(e) => updateField("tanggal_booking", e.target.value)} /></div>
                    <div className="space-y-2"><Label>Petugas Booking</Label><Input value={editForm.nama_petugas_booking} onChange={(e) => updateField("nama_petugas_booking", e.target.value)} /></div>
                  </>
                )}
                <div className="space-y-2"><Label>Nama Penjual</Label><Input value={editForm.nama_penjual} onChange={(e) => updateField("nama_penjual", e.target.value)} /></div>
                <div className="space-y-2"><Label>HP Penjual</Label><Input value={editForm.hp_penjual} onChange={(e) => updateField("hp_penjual", e.target.value)} /></div>
                <div className="col-span-full space-y-2"><Label>Alamat Penjual</Label><Input value={editForm.alamat_penjual} onChange={(e) => updateField("alamat_penjual", e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>Catatan</Label><Textarea value={editForm.catatan} onChange={(e) => updateField("catatan", e.target.value)} /></div>
              {editForm.harga !== undefined && (
                <p className="text-sm text-muted-foreground">
                  Total per shohibul (auto):{" "}
                  <strong>{formatRupiah(hitungTotalPerOrang(
                    (hewan?.sumber_hewan === "bawa_sendiri" ? 0 : parseInt(editForm.harga) || 0),
                    hewan?.jenis_hewan ?? "sapi",
                    hewan?.tipe_kepemilikan ?? "individu",
                    (hewan?.sumber_hewan as SumberHewan) ?? "beli_panitia"
                  ))}</strong>
                  {getBiayaOperasional(hewan?.jenis_hewan ?? "sapi", hewan?.tipe_kepemilikan ?? "individu") > 0 && (
                    <span className="ml-1">(termasuk operasional Rp {getBiayaOperasional(hewan?.jenis_hewan ?? "sapi", hewan?.tipe_kepemilikan ?? "individu").toLocaleString("id-ID")})</span>
                  )}
                </p>
              )}
              <div className="flex gap-2">
                <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Menyimpan..." : "Simpan"}
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)}>Batal</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div><span className="text-muted-foreground">Harga</span><p className="font-semibold">{formatRupiah(Number(hewan.harga))}</p></div>
              <div><span className="text-muted-foreground">Kuota</span><p className="font-semibold">{shohibulList?.length ?? 0}/{hewan.kuota}</p></div>
              <div><span className="text-muted-foreground">Iuran/orang</span><p className="font-semibold">{formatRupiah(Number(hewan.iuran_per_orang))}</p></div>
              {hewan.tipe_kepemilikan === "individu" && hewan.sumber_hewan && (
                <div><span className="text-muted-foreground">Sumber Hewan</span><p className="font-semibold">{SUMBER_HEWAN_LABEL[hewan.sumber_hewan as SumberHewan] ?? hewan.sumber_hewan}</p></div>
              )}
              {hewan.tipe_kepemilikan === "individu" && (
                <div><span className="text-muted-foreground">Biaya Operasional</span><p className="font-semibold">{formatRupiah(Number(hewan.biaya_operasional ?? 0))}</p></div>
              )}
              <div><span className="text-muted-foreground">Bobot</span><p className="font-semibold">{hewan.estimasi_bobot ? `${hewan.estimasi_bobot} kg` : "-"}</p></div>
              {hewan.ras && <div><span className="text-muted-foreground">Ras</span><p className="font-semibold">{hewan.ras}</p></div>}
              {hewan.nama_penjual && <div><span className="text-muted-foreground">Penjual</span><p className="font-semibold">{hewan.nama_penjual}</p></div>}
              {hewan.tanggal_booking && <div><span className="text-muted-foreground">Tgl Booking</span><p className="font-semibold">{formatTanggal(hewan.tanggal_booking)}</p></div>}
              {hewan.nama_petugas_booking && <div><span className="text-muted-foreground">Petugas</span><p className="font-semibold">{hewan.nama_petugas_booking}</p></div>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shohibul List */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Shohibul Qurban ({shohibulList?.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {shohibulList?.length === 0 && <p className="text-sm text-muted-foreground">Belum ada shohibul terdaftar.</p>}
          {shohibulList?.map((s) => (
            <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <span className="font-medium text-sm">{s.nama}</span>
              <Badge variant={s.akad_dilakukan ? "default" : "outline"} className={s.akad_dilakukan ? "bg-success/10 text-success border-success/20" : ""}>
                {s.akad_dilakukan ? "Akad ✓" : "Belum akad"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Request Bagian Panel */}
      <div>
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <h2 className="text-lg font-semibold">📋 Survei Awal — Request Bagian</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Catat minat awal setiap shohibul. Ini <span className="font-medium">bukan keputusan final</span> — pembagian & undian resmi dilakukan di halaman <span className="font-medium">Pembagian Bagian Sapi</span>.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {KATEGORI_BAGIAN.map(({ id, label, icon, slots }) => {
            const reqs = getRequestsForKategori(id);
            // Individu: penuh jika sudah ada 1 shohibul yang request
            // Kolektif: penuh jika peminat sudah = jumlah slot
            const kuotaEfektif = isIndividu ? 1 : slots.length;
            const penuh = reqs.length >= kuotaEfektif;
            const infoKuota = isIndividu
              ? `1 shohibul (dapat semua ${slots.length})`
              : `Maks ${slots.length} orang`;
            return (
              <Card key={id} className={`hover:shadow-md transition-shadow ${penuh ? "border-warning/50" : ""}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{icon}</span>
                      <div>
                        <span className="font-semibold text-sm">{label}</span>
                        <p className="text-xs text-muted-foreground">{infoKuota}</p>
                      </div>
                    </div>
                    {getBadgeKategori(id)}
                  </div>
                  {reqs.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {reqs.map((r) => (
                        <Badge key={r.id} variant="secondary" className="text-xs">{(r as any).shohibul_qurban?.nama}</Badge>
                      ))}
                    </div>
                  )}
                  {isAdmin() && shohibulList && shohibulList.length > 0 && (
                    <div className="border-t pt-2 space-y-1">
                      <p className="text-xs text-muted-foreground mb-1">Tandai minat (survei awal):</p>
                      <div className="flex flex-wrap gap-1">
                        {shohibulList.map((s) => {
                          const hasRequest = reqs.some((r) => r.shohibul_qurban_id === s.id);
                          const disabled = toggleMutation.isPending || (penuh && !hasRequest);
                          return (
                            <Button key={s.id} size="sm"
                              variant={hasRequest ? "default" : "outline"}
                              className="text-xs h-7"
                              onClick={() => toggleMutation.mutate({ bagian: id, shohibulId: s.id })}
                              disabled={disabled}
                              title={penuh && !hasRequest
                                ? (isIndividu ? `Bagian ini sudah direquest shohibul lain` : `Kuota penuh (maks ${slots.length} orang)`)
                                : ""}
                            >
                              {s.nama}
                            </Button>
                          );
                        })}
                      </div>
                      {penuh && (
                        <p className="text-xs text-warning mt-1">
                          {isIndividu
                            ? `✅ Diminta — shohibul mendapat semua ${slots.length} ${label}`
                            : `⚠️ Kuota penuh — tidak bisa tambah peminat lagi`}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HewanDetail;