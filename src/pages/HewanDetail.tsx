import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Printer, Beef, Drumstick } from "lucide-react";
import { formatRupiah, formatTanggal } from "@/lib/qurban-utils";
import { toast } from "sonner";
import jsPDF from "jspdf";
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

const HewanDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: hewan, isLoading } = useQuery({
    queryKey: ["hewan-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hewan_qurban")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: shohibulList } = useQuery({
    queryKey: ["shohibul-by-hewan", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shohibul_qurban")
        .select("*")
        .eq("hewan_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: requestList } = useQuery({
    queryKey: ["request-bagian", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_bagian")
        .select("*, shohibul_qurban(nama)")
        .eq("hewan_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ bagian, shohibulId }: { bagian: BagianHewan; shohibulId: string }) => {
      const existing = requestList?.find(
        (r) => r.bagian === bagian && r.shohibul_qurban_id === shohibulId
      );
      if (existing) {
        const { error } = await supabase.from("request_bagian").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("request_bagian").insert({
          bagian,
          hewan_id: id!,
          shohibul_qurban_id: shohibulId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request-bagian", id] });
      toast.success("Request bagian diperbarui");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const getRequestsForBagian = (bagian: BagianHewan) =>
    requestList?.filter((r) => r.bagian === bagian) ?? [];

  const getBadge = (bagian: BagianHewan) => {
    const reqs = getRequestsForBagian(bagian);
    if (reqs.length === 0)
      return <Badge className="bg-warning/10 text-warning border-warning/20">→ Mustahiq</Badge>;
    if (reqs.length === 1)
      return (
        <Badge className="bg-success/10 text-success border-success/20">
          Hak {(reqs[0] as any).shohibul_qurban?.nama}
        </Badge>
      );
    return (
      <Badge className="bg-info/10 text-info border-info/20">
        Dibagi {reqs.length} orang
      </Badge>
    );
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
      if (reqs.length === 0) {
        doc.text("→ Mustahiq", 50, y);
      } else {
        const names = reqs.map((r) => (r as any).shohibul_qurban?.nama ?? "-").join(", ");
        doc.text(names, 50, y);
      }
      y += 8;
    });

    doc.save(`distribusi-${hewan.nomor_urut}.pdf`);
    toast.success("PDF distribusi berhasil diunduh");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!hewan) {
    return <p className="text-muted-foreground">Hewan tidak ditemukan.</p>;
  }

  const statusColors: Record<string, string> = {
    survei: "bg-warning/10 text-warning border-warning/20",
    booking: "bg-info/10 text-info border-info/20",
    lunas: "bg-success/10 text-success border-success/20",
  };

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
              <Badge variant="outline" className={statusColors[hewan.status] || ""}>
                {hewan.status}
              </Badge>
            </p>
          </div>
          <Button onClick={cetakDistribusi}>
            <Printer className="mr-2 h-4 w-4" /> Cetak Lembar Distribusi
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card>
        <CardContent className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><span className="text-muted-foreground">Harga</span><p className="font-semibold">{formatRupiah(Number(hewan.harga))}</p></div>
          <div><span className="text-muted-foreground">Kuota</span><p className="font-semibold">{shohibulList?.length ?? 0}/{hewan.kuota}</p></div>
          <div><span className="text-muted-foreground">Iuran/orang</span><p className="font-semibold">{formatRupiah(Number(hewan.iuran_per_orang))}</p></div>
          <div><span className="text-muted-foreground">Bobot</span><p className="font-semibold">{hewan.estimasi_bobot ? `${hewan.estimasi_bobot} kg` : "-"}</p></div>
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
                        <Badge key={r.id} variant="secondary" className="text-xs">
                          {(r as any).shohibul_qurban?.nama}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Toggle buttons per shohibul */}
                  {shohibulList && shohibulList.length > 0 && (
                    <div className="border-t pt-2 space-y-1">
                      <p className="text-xs text-muted-foreground mb-1">Toggle request:</p>
                      <div className="flex flex-wrap gap-1">
                        {shohibulList.map((s) => {
                          const hasRequest = reqs.some((r) => r.shohibul_qurban_id === s.id);
                          return (
                            <Button
                              key={s.id}
                              size="sm"
                              variant={hasRequest ? "default" : "outline"}
                              className="text-xs h-7"
                              onClick={() => toggleMutation.mutate({ bagian, shohibulId: s.id })}
                              disabled={toggleMutation.isPending}
                            >
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
