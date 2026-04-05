import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatRupiah, formatTanggal } from "@/lib/qurban-utils";
import { ArrowLeft, Copy, Edit2, Trash2, X, Save } from "lucide-react";
import { useState } from "react";
import type { Database } from "@/integrations/supabase/types";

type BagianHewan = Database["public"]["Enums"]["bagian_hewan"];

const BAGIAN_LIST: { bagian: BagianHewan; label: string; icon: string }[] = [
  { bagian: "jeroan", label: "Jeroan", icon: "🫀" },
  { bagian: "kepala", label: "Kepala", icon: "🐄" },
  { bagian: "kulit", label: "Kulit", icon: "🟫" },
  { bagian: "ekor", label: "Ekor", icon: "🦴" },
  { bagian: "kaki", label: "Kaki", icon: "🦿" },
  { bagian: "tulang", label: "Tulang", icon: "🦴" },
];

const ShohibulDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ nama: "", alamat: "", no_wa: "" });

  const { data: shohibul, isLoading } = useQuery({
    queryKey: ["shohibul-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shohibul_qurban")
        .select("*, hewan_qurban(nomor_urut, jenis_hewan, tipe_kepemilikan, iuran_per_orang)")
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
        .update({ nama: editData.nama, alamat: editData.alamat, no_wa: editData.no_wa })
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
      const { error } = await supabase.from("shohibul_qurban").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shohibul dihapus");
      navigate("/shohibul");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const copyAkadLink = () => {
    const url = `${window.location.origin}/akad/${id}`;
    navigator.clipboard.writeText(url);
    toast.success("Link akad disalin ke clipboard!");
  };

  const startEdit = () => {
    if (shohibul) {
      setEditData({ nama: shohibul.nama, alamat: shohibul.alamat ?? "", no_wa: shohibul.no_wa ?? "" });
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
              <Button size="sm" variant="outline" onClick={copyAkadLink}>
                <Copy className="mr-2 h-4 w-4" /> Kirim Link Akad
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
        <CardHeader><CardTitle className="text-lg">Request Bagian Hewan</CardTitle></CardHeader>
        <CardContent>
          {(!requestList || requestList.length === 0) ? (
            <p className="text-sm text-muted-foreground">Tidak ada request bagian.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {BAGIAN_LIST.map(({ bagian, label, icon }) => {
                const has = requestList.some((r) => r.bagian === bagian);
                return (
                  <div key={bagian} className={`p-3 rounded-lg border text-sm ${has ? "border-primary bg-primary/5" : "bg-muted/30 text-muted-foreground"}`}>
                    <span className="mr-1">{icon}</span> {label}
                    {has && <Badge className="ml-2 bg-success/10 text-success border-success/20 text-xs">✓</Badge>}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ShohibulDetail;
