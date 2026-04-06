import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatRupiah, formatTanggal } from "@/lib/qurban-utils";
import { ArrowLeft, MessageCircle, Edit2, Trash2, X, Save } from "lucide-react";
import { useState } from "react";
import type { Database } from "@/integrations/supabase/types";

import { KATEGORI_BAGIAN } from "@/pages/UndianBagian";

const ShohibulDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ nama: "", alamat: "", no_wa: "", catatan_pendaftaran: "" });
  const [editingBagian, setEditingBagian] = useState(false);
  const [editBagian, setEditBagian] = useState<string[]>([]);

  const { data: shohibul, isLoading } = useQuery({
    queryKey: ["shohibul-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shohibul_qurban")
        .select("*, hewan_qurban(nomor_urut, jenis_hewan, tipe_kepemilikan, iuran_per_orang, harga, biaya_operasional, kuota, sumber_hewan)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: requestList } = useQuery({
    queryKey: ["shohibul-request-bagian", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_bagian")
        .select("*")
        .eq("shohibul_qurban_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch jumlah request per kategori dari semua shohibul pada hewan yang sama
  const hewanId = shohibul?.hewan_id;
  const { data: requestCountMap } = useQuery({
    queryKey: ["request-bagian-count", hewanId],
    enabled: !!hewanId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_bagian")
        .select("bagian")
        .eq("hewan_id", hewanId!);
      if (error) throw error;
      const map: Record<string, number> = {};
      data?.forEach((r) => { map[r.bagian] = (map[r.bagian] || 0) + 1; });
      return map;
    },
  });

  const saveBagianMutation = useMutation({
    mutationFn: async (newBagian: string[]) => {
      // Hapus semua request lama milik shohibul ini
      await supabase.from("request_bagian").delete().eq("shohibul_qurban_id", id!);
      // Insert yang baru
      if (newBagian.length > 0) {
        const inserts = newBagian.map((bagian) => ({
          bagian,
          hewan_id: hewanId!,
          shohibul_qurban_id: id!,
        }));
        const { error } = await supabase.from("request_bagian").insert(inserts);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shohibul-request-bagian", id] });
      queryClient.invalidateQueries({ queryKey: ["request-bagian-count", hewanId] });
      setEditingBagian(false);
      toast.success("Request bagian diperbarui");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const startEditBagian = () => {
    setEditBagian(requestList?.map((r) => r.bagian) ?? []);
    setEditingBagian(true);
  };

  const updateChecklistMutation = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase
        .from("shohibul_qurban")
        .update({ status_checklist_panitia: status as any })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shohibul-detail", id] });
      toast.success("Status checklist diperbarui");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("shohibul_qurban")
        .update({ nama: editData.nama, alamat: editData.alamat, no_wa: editData.no_wa, catatan_pendaftaran: editData.catatan_pendaftaran || null })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shohibul-detail", id] });
      setEditing(false);
      toast.success("Data diperbarui");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("request_bagian").delete().eq("shohibul_qurban_id", id!);
      await supabase.from("pilihan_bagian").delete().eq("shohibul_id", id!);
      await supabase.from("status_bagian").update({ pemenang_id: null }).eq("pemenang_id", id!);
      const { error } = await supabase.from("shohibul_qurban").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shohibul dihapus");
      navigate("/shohibul");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openWhatsApp = () => {
    const noWa = shohibul?.no_wa?.replace(/\D/g, "");
    if (!noWa) {
      toast.error("Nomor WhatsApp tidak tersedia");
      return;
    }
    const normalized = noWa.startsWith("0") ? "62" + noWa.slice(1) : noWa;
    const akadUrl = `${window.location.origin}/akad/${id}`;
    const pesan = encodeURIComponent(`Bismillaah, ${shohibul?.nama}, berikut link akad qurbannya: ${akadUrl}`);
    window.open(`https://wa.me/${normalized}?text=${pesan}`, "_blank");
  };

  const startEdit = () => {
    if (shohibul) {
      setEditData({ nama: shohibul.nama, alamat: shohibul.alamat ?? "", no_wa: shohibul.no_wa ?? "", catatan_pendaftaran: (shohibul as any).catatan_pendaftaran ?? "" });
      setEditing(true);
    }
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!shohibul) {
    return <p className="text-muted-foreground">Shohibul tidak ditemukan.</p>;
  }

  const hewan = shohibul.hewan_qurban as any;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <Button variant="ghost" size="sm" onClick={() => navigate("/shohibul")} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
        </Button>
        <div className="flex items-center justify-between">
          <h1 className="page-title">{shohibul.nama}</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={startEdit}><Edit2 className="mr-1 h-4 w-4" /> Edit</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm"><Trash2 className="mr-1 h-4 w-4" /> Hapus</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Hapus Shohibul?</AlertDialogTitle>
                  <AlertDialogDescription>Data {shohibul.nama} dan request bagiannya akan dihapus permanen.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Edit inline form */}
      {editing && (
        <Card className="border-primary">
          <CardContent className="p-4 space-y-3">
            <div><Label>Nama</Label><Input value={editData.nama} onChange={(e) => setEditData({ ...editData, nama: e.target.value })} /></div>
            <div><Label>Alamat</Label><Input value={editData.alamat} onChange={(e) => setEditData({ ...editData, alamat: e.target.value })} /></div>
            <div><Label>No. WA</Label><Input value={editData.no_wa} onChange={(e) => setEditData({ ...editData, no_wa: e.target.value })} /></div>
            <div>
              <Label>Catatan Pendaftaran</Label>
              <Textarea
                value={editData.catatan_pendaftaran}
                onChange={(e) => setEditData({ ...editData, catatan_pendaftaran: e.target.value })}
                placeholder="Catatan khusus terkait pendaftaran (opsional)"
                rows={3}
                className="resize-none"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}><Save className="mr-1 h-4 w-4" /> Simpan</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}><X className="mr-1 h-4 w-4" /> Batal</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card>
        <CardContent className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div><span className="text-muted-foreground">Nama</span><p className="font-semibold">{shohibul.nama}</p></div>
          <div><span className="text-muted-foreground">Alamat</span><p className="font-semibold">{shohibul.alamat ?? "-"}</p></div>
          <div><span className="text-muted-foreground">No. WA</span><p className="font-semibold">{shohibul.no_wa ?? "-"}</p></div>
          <div><span className="text-muted-foreground">Hewan</span><p className="font-semibold">{hewan?.nomor_urut ?? "-"} ({hewan?.jenis_hewan})</p></div>
          <div><span className="text-muted-foreground">Tipe</span><p className="font-semibold capitalize">{shohibul.tipe_kepemilikan}</p></div>
          <div><span className="text-muted-foreground">Tanggal Daftar</span><p className="font-semibold">{formatTanggal(shohibul.created_at)}</p></div>
          <div><span className="text-muted-foreground">Sumber</span><p className="font-semibold capitalize">{shohibul.sumber_pendaftaran ?? "-"}</p></div>
          {shohibul.panitia_pendaftar && (
            <div><span className="text-muted-foreground">Panitia Pendaftar</span><p className="font-semibold">{shohibul.panitia_pendaftar}</p></div>
          )}
          <div><span className="text-muted-foreground">Iuran</span><p className="font-semibold">{formatRupiah(Number(hewan?.iuran_per_orang ?? 0))}</p></div>
          {(shohibul as any).catatan_pendaftaran && (
            <div className="col-span-2 sm:col-span-3">
              <span className="text-muted-foreground">Catatan Pendaftaran</span>
              <p className="font-semibold whitespace-pre-wrap">{(shohibul as any).catatan_pendaftaran}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Akad Status */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Status Akad</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {shohibul.akad_dilakukan ? (
            <div className="space-y-2">
              <Badge className="bg-success/10 text-success border-success/20">Akad ✓</Badge>
              <p className="text-sm">
                {shohibul.akad_diwakilkan
                  ? `Qabul diwakilkan: ${shohibul.nama_wakil_akad ?? "-"}`
                  : "Qabul langsung"}
              </p>
              {shohibul.akad_timestamp && (
                <p className="text-sm text-muted-foreground">Waktu: {new Date(shohibul.akad_timestamp).toLocaleString("id-ID")}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Badge variant="destructive">Belum Akad</Badge>
              <Button size="sm" variant="outline" onClick={openWhatsApp}>
                <MessageCircle className="mr-2 h-4 w-4" /> Kirim via WhatsApp
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Checklist Panitia */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Checklist Panitia</CardTitle></CardHeader>
        <CardContent>
          <Select value={shohibul.status_checklist_panitia ?? "pending"} onValueChange={(v) => updateChecklistMutation.mutate(v)}>
            <SelectTrigger className="w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="selesai">Selesai</SelectItem>
              <SelectItem value="tindak_lanjut">Butuh Tindak Lanjut</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Request Bagian */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">📋 Survei Awal — Request Bagian</CardTitle>
          {!editingBagian && (
            <Button size="sm" variant="outline" onClick={startEditBagian}>
              <Edit2 className="mr-1 h-4 w-4" /> Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editingBagian ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {KATEGORI_BAGIAN.map(({ id: katId, label, icon, slots }) => {
                  const checked = editBagian.includes(katId);
                  const kuota = slots.length;
                  // Hitung request dari shohibul lain (exclude diri sendiri)
                  const dariSendiri = requestList?.some((r) => r.bagian === katId) ? 1 : 0;
                  const jumlahLain = (requestCountMap?.[katId] ?? 0) - dariSendiri;
                  const penuhTanpaSaya = jumlahLain >= kuota;
                  const disabled = penuhTanpaSaya && !checked;
                  return (
                    <label
                      key={katId}
                      className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                        disabled
                          ? "opacity-50 cursor-not-allowed bg-muted border-muted"
                          : checked
                          ? "border-primary bg-primary/5 cursor-pointer"
                          : "hover:border-primary/50 cursor-pointer"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(v) => {
                          if (v) setEditBagian([...editBagian, katId]);
                          else setEditBagian(editBagian.filter((b) => b !== katId));
                        }}
                      />
                      <span className="text-lg">{icon}</span>
                      <span className={`text-sm font-medium flex-1 ${penuhTanpaSaya ? "line-through text-muted-foreground" : ""}`}>
                        {label}
                      </span>
                      <span className={`text-xs rounded px-1.5 py-0.5 ${penuhTanpaSaya ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                        {jumlahLain}/{kuota}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setEditingBagian(false)}>
                  <X className="mr-1 h-4 w-4" /> Batal
                </Button>
                <Button size="sm" onClick={() => saveBagianMutation.mutate(editBagian)} disabled={saveBagianMutation.isPending}>
                  <Save className="mr-1 h-4 w-4" /> {saveBagianMutation.isPending ? "Menyimpan..." : "Simpan"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {(!requestList || requestList.length === 0) ? (
                <p className="text-sm text-muted-foreground">Tidak ada request bagian.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {KATEGORI_BAGIAN.map(({ id: katId, label, icon, slots }) => {
                    const has = requestList.some((r) => r.bagian === katId);
                    if (!has) return null;
                    const jumlahRequest = requestCountMap?.[katId] ?? 0;
                    const kuota = slots.length;
                    const penuh = jumlahRequest >= kuota;
                    return (
                      <div key={katId} className="p-3 rounded-lg border border-primary bg-primary/5 text-sm flex items-center gap-2">
                        <span className="text-lg">{icon}</span>
                        <div className="flex-1">
                          <p className={`font-medium ${penuh ? "line-through text-muted-foreground" : ""}`}>{label}</p>
                          <p className="text-xs text-muted-foreground">{jumlahRequest}/{kuota} request</p>
                        </div>
                        {penuh
                          ? <Badge className="ml-auto bg-destructive/10 text-destructive border-destructive/20 text-xs">Penuh</Badge>
                          : <Badge className="ml-auto bg-success/10 text-success border-success/20 text-xs">✓</Badge>
                        }
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-3 italic">
                Keputusan final ditentukan panitia melalui musyawarah/undian.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ShohibulDetail;