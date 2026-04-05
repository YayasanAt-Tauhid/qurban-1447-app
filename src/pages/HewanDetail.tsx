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
import { formatRupiah, formatTanggal, hitungIuranPerOrang } from "@/lib/qurban-utils";
import { toast } from "sonner";
import { useState } from "react";
import jsPDF from "jspdf";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";

type BagianHewan = Database["public"]["Enums"]["bagian_hewan"];

const BAGIAN_LIST: { bagian: BagianHewan; label: string; icon: string }[] = [
  { bagian: "jeroan", label: "Jeroan", icon: "🫀" },
  { bagian: "kepala", label: "Kepala", icon: "🐄" },
  { bagian: "kulit", label: "Kulit", icon: "🟫" },
  { bagian: "ekor", label: "Ekor", icon: "🦴" },
  { bagian: "kaki", label: "Kaki", icon: "🦿" },
  { bagian: "tulang", label: "Tulang", icon: "🦴" },
];

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

  const toggleMutation = useMutation({
    mutationFn: async ({ bagian, shohibulId }: { bagian: BagianHewan; shohibulId: string }) => {
      const existing = requestList?.find((r) => r.bagian === bagian && r.shohibul_qurban_id === shohibulId);
      if (existing) {
        const { error } = await supabase.from("request_bagian").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("request_bagian").insert({ bagian, hewan_id: id!, shohibul_qurban_id: shohibulId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request-bagian", id] });
      toast.success("Request bagian diperbarui");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const harga = parseInt(editForm.harga) || 0;
      const isSapiKolektif = hewan?.jenis_hewan === "sapi" && hewan?.tipe_kepemilikan === "kolektif";
      const iuran = isSapiKolektif ? hitungIuranPerOrang(harga) : harga;
      const { error } = await supabase.from("hewan_qurban").update({
        nomor_urut: editForm.nomor_urut,
        ras: editForm.ras || null,
        nama_penjual: editForm.nama_penjual || null,
        hp_penjual: editForm.hp_penjual || null,
        alamat_penjual: editForm.alamat_penjual || null,
        harga,
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
      estimasi_bobot: hewan.estimasi_bobot ? String(hewan.estimasi_bobot) : "",
      uang_muka: String(hewan.uang_muka ?? 0),
      catatan: hewan.catatan || "",
      status: hewan.status,
      tanggal_booking: hewan.tanggal_booking || "",
      nama_petugas_booking: hewan.nama_petugas_booking || "",
    });
    setEditing(true);
  };

  const getRequestsForBagian = (bagian: BagianHewan) => requestList?.filter((r) => r.bagian === bagian) ?? [];

  const getBadge = (bagian: BagianHewan) => {
    const reqs = getRequestsForBagian(bagian);
    if (reqs.length === 0) return <Badge className="bg-warning/10 text-warning border-warning/20">→ Mustahiq</Badge>;
    if (reqs.length === 1) return <Badge className="bg-success/10 text-success border-success/20">Hak {(reqs[0] as any).shohibul_qurban?.nama}</Badge>;
    return <Badge className="bg-info/10 text-info border-info/20">Dibagi {reqs.length} orang</Badge>;
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
    BAGIAN_LIST.forEach(({ bagian, label }) => {
      const reqs = getRequestsForBagian(bagian);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, 14, y);
      doc.setFont("helvetica", "normal");
      if (reqs.length === 0) { doc.text("→ Mustahiq", 50, y); }
      else { doc.text(reqs.map((r) => (r as any).shohibul_qurban?.nama ?? "-").join(", "), 50, y); }
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
              {hewan.jenis_hewan === "sapi" && hewan.tipe_kepemilikan === "kolektif" && editForm.harga && (
                <p className="text-sm text-muted-foreground">Iuran per orang (auto): {formatRupiah(hitungIuranPerOrang(parseInt(editForm.harga) || 0))}</p>
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
        <h2 className="text-lg font-semibold mb-4">Request Bagian Hewan</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {BAGIAN_LIST.map(({ bagian, label, icon }) => {
            const reqs = getRequestsForBagian(bagian);
            return (
              <Card key={bagian} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{icon}</span>
                      <span className="font-semibold">{label}</span>
                    </div>
                    {getBadge(bagian)}
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
                      <p className="text-xs text-muted-foreground mb-1">Toggle request:</p>
                      <div className="flex flex-wrap gap-1">
                        {shohibulList.map((s) => {
                          const hasRequest = reqs.some((r) => r.shohibul_qurban_id === s.id);
                          return (
                            <Button key={s.id} size="sm" variant={hasRequest ? "default" : "outline"} className="text-xs h-7"
                              onClick={() => toggleMutation.mutate({ bagian, shohibulId: s.id })} disabled={toggleMutation.isPending}>
                              {s.nama}
                            </Button>
                          );
                        })}
                      </div>
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