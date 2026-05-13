import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { formatTanggal } from "@/lib/qurban-utils";

type StatusDistribusi = "menunggu" | "sedang_disembelih" | "selesai";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  menunggu: { label: "Menunggu", color: "bg-warning/10 text-warning border-warning/20" },
  sedang_disembelih: { label: "Sedang Disembelih", color: "bg-info/10 text-info border-info/20" },
  selesai: { label: "Selesai", color: "bg-success/10 text-success border-success/20" },
};

const getNextStatus = (current: string): StatusDistribusi | null => {
  if (current === "menunggu") return "sedang_disembelih";
  if (current === "sedang_disembelih") return "selesai";
  return null;
};

const DistribusiPage = () => {
  const queryClient = useQueryClient();
  const [confirmHewan, setConfirmHewan] = useState<{ id: string; nomor: string; next: StatusDistribusi } | null>(null);
  const [catatan, setCatatan] = useState("");
  const [selectedHewan, setSelectedHewan] = useState<string | null>(null);

  // Auto-refresh every 30s
  const { data: hewanList, isLoading } = useQuery({
    queryKey: ["distribusi-hewan"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hewan_qurban")
        .select("*")
        .order("nomor_urut");
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  const { data: kuponStats } = useQuery({
    queryKey: ["distribusi-kupon"],
    queryFn: async () => {
      const { data } = await supabase.from("mustahiq").select("status_kupon");
      const total = data?.length ?? 0;
      const scanned = data?.filter((m) => m.status_kupon === "sudah_ambil").length ?? 0;
      return { total, scanned };
    },
    refetchInterval: 30000,
  });

  const { data: requestBagian } = useQuery({
    queryKey: ["distribusi-request"],
    queryFn: async () => {
      const { data } = await supabase
        .from("request_bagian")
        .select("*, shohibul_qurban(nama), hewan_qurban(nomor_urut)");
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const { data: catatanList } = useQuery({
    queryKey: ["catatan-lapangan", selectedHewan],
    queryFn: async () => {
      let q = supabase.from("catatan_lapangan").select("*").order("waktu", { ascending: false }).limit(20);
      if (selectedHewan) q = q.eq("hewan_id", selectedHewan);
      const { data } = await q;
      return data ?? [];
    },
    refetchInterval: 30000,
    enabled: true,
  });

  // Use the hewan status field as distribusi status (survei=menunggu, booking=sedang_disembelih, lunas=selesai)
  // Mapping: we use the actual status field values as proxy
  const getDistribusiStatus = (status: string): string => {
    if (status === "lunas") return "selesai";
    if (status === "booking") return "sedang_disembelih";
    return "menunggu";
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: StatusDistribusi }) => {
      // Map back to hewan status
      const statusMap: Record<StatusDistribusi, string> = {
        menunggu: "survei",
        sedang_disembelih: "booking",
        selesai: "lunas",
      };
      const { error } = await supabase
        .from("hewan_qurban")
        .update({ status: statusMap[next] as any })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distribusi-hewan"] });
      setConfirmHewan(null);
      toast.success("Status berhasil diperbarui");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const addCatatanMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("catatan_lapangan").insert({
        hewan_id: selectedHewan,
        catatan,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catatan-lapangan"] });
      setCatatan("");
      toast.success("Catatan disimpan");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const kuponPct = kuponStats ? (kuponStats.total > 0 ? (kuponStats.scanned / kuponStats.total) * 100 : 0) : 0;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Distribusi Hari H</h1>
        <p className="page-subtitle">Monitor penyembelihan & distribusi real-time (auto-refresh 30 detik)</p>
      </div>

      {/* Kupon Progress */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progress Kupon</span>
            <span className="text-sm text-muted-foreground">{kuponStats?.scanned ?? 0} / {kuponStats?.total ?? 0}</span>
          </div>
          <Progress value={kuponPct} className="h-3" />
        </CardContent>
      </Card>

      {/* Hewan Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Status Hewan</h2>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {hewanList?.map((h) => {
              const dStatus = getDistribusiStatus(h.status);
              const statusInfo = STATUS_LABELS[dStatus] ?? STATUS_LABELS.menunggu;
              const next = getNextStatus(dStatus);
              return (
                <Card key={h.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedHewan(h.id)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{h.nomor_urut}</p>
                      <p className="text-xs text-muted-foreground capitalize">{h.jenis_hewan}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={statusInfo.color}>{statusInfo.label}</Badge>
                      {next && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmHewan({ id: h.id, nomor: h.nomor_urut, next });
                          }}
                        >
                          →
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Request Bagian ready for distribution */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Bagian Siap Distribusi</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-60 overflow-y-auto">
          {requestBagian?.length === 0 && <p className="text-sm text-muted-foreground">Belum ada request bagian.</p>}
          {requestBagian?.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded">
              <span className="capitalize">{r.bagian} — {(r as any).hewan_qurban?.nomor_urut}</span>
              <span className="font-medium">{(r as any).shohibul_qurban?.nama}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Catatan Lapangan */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Catatan Lapangan</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Textarea
              placeholder="Tulis catatan..."
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              className="flex-1"
            />
            <Button onClick={() => addCatatanMutation.mutate()} disabled={!catatan || addCatatanMutation.isPending}>
              Simpan
            </Button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {catatanList?.map((c) => (
              <div key={c.id} className="text-sm p-2 bg-muted/30 rounded">
                <p className="text-xs text-muted-foreground">{new Date(c.waktu).toLocaleString("id-ID")}</p>
                <p>{c.catatan}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <AlertDialog open={!!confirmHewan} onOpenChange={() => setConfirmHewan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Status</AlertDialogTitle>
            <AlertDialogDescription>
              Ubah status <strong>{confirmHewan?.nomor}</strong> menjadi{" "}
              <strong>{confirmHewan?.next ? STATUS_LABELS[confirmHewan.next]?.label : ""}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmHewan && updateStatusMutation.mutate({ id: confirmHewan.id, next: confirmHewan.next })}>
              Ya, Update
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DistribusiPage;
