import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatRupiah } from "@/lib/qurban-utils";
import { ArrowLeft } from "lucide-react";
import { KATEGORI_BAGIAN, getKuotaKategori } from "@/pages/UndianBagian";

interface HewanOption {
  id: string;
  nomor_urut: string;
  jenis_hewan: string;
  tipe_kepemilikan: string;
  harga: number;
  iuran_per_orang: number;
  kuota: number;
  sisa_kuota: number;
}

const ShohibulDaftar = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "ringkasan">("form");

  // Form state
  const [hewanId, setHewanId] = useState("");
  const [nama, setNama] = useState("");
  const [alamat, setAlamat] = useState("");
  const [noWa, setNoWa] = useState("");
  const [catatan, setCatatan] = useState("");
  const [requestBagian, setRequestBagian] = useState<string[]>([]);

  // Fetch hewan with sisa kuota
  const { data: hewanList, isLoading: loadingHewan } = useQuery({
    queryKey: ["hewan-for-registration"],
    queryFn: async () => {
      const { data: hewanData, error: hewanError } = await supabase
        .from("hewan_qurban")
        .select("*")
        .in("status", ["booking", "lunas"])
        .order("nomor_urut");
      if (hewanError) throw hewanError;

      const { data: shohibulData, error: shohibulError } = await supabase
        .from("shohibul_qurban")
        .select("hewan_id");
      if (shohibulError) throw shohibulError;

      const countMap: Record<string, number> = {};
      shohibulData?.forEach((s) => {
        if (s.hewan_id) countMap[s.hewan_id] = (countMap[s.hewan_id] || 0) + 1;
      });

      return hewanData.map((h) => ({
        id: h.id,
        nomor_urut: h.nomor_urut,
        jenis_hewan: h.jenis_hewan,
        tipe_kepemilikan: h.tipe_kepemilikan,
        harga: Number(h.harga),
        iuran_per_orang: Number(h.iuran_per_orang),
        kuota: h.kuota,
        sisa_kuota: h.kuota - (countMap[h.id] || 0),
      })) as HewanOption[];
    },
  });

  const selectedHewan = hewanList?.find((h) => h.id === hewanId);
  const isSapi = selectedHewan?.jenis_hewan === "sapi";

  // Fetch jumlah request per kategori untuk hewan yang dipilih
  const { data: requestCountMap } = useQuery({
    queryKey: ["request-bagian-count", hewanId],
    enabled: !!hewanId && isSapi,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_bagian")
        .select("bagian")
        .eq("hewan_id", hewanId);
      if (error) throw error;
      const map: Record<string, number> = {};
      data?.forEach((r) => {
        map[r.bagian] = (map[r.bagian] || 0) + 1;
      });
      return map;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { data: inserted, error } = await supabase
        .from("shohibul_qurban")
        .insert({
          nama,
          alamat,
          no_wa: noWa,
          hewan_id: hewanId,
          catatan_pendaftaran: catatan.trim() || null,
          tipe_kepemilikan: selectedHewan!.tipe_kepemilikan as "kolektif" | "individu",
          status_penyembelihan: "diwakilkan",
          sumber_pendaftaran: "online",
          panitia_pendaftar: null,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (isSapi && requestBagian.length > 0) {
        // Simpan request_bagian (per kategori)
        const requests = requestBagian.map((bagian) => ({
          bagian,
          hewan_id: hewanId,
          shohibul_qurban_id: inserted.id,
        }));
        const { error: reqError } = await supabase.from("request_bagian").insert(requests);
        if (reqError) throw reqError;

        // Sync ke pilihan_bagian — ambil slot kosong per kategori
        for (const kategoriId of requestBagian) {
          const kategori = KATEGORI_BAGIAN.find(k => k.id === kategoriId);
          if (!kategori) continue;
          const { data: sudahPilih } = await supabase
            .from("pilihan_bagian")
            .select("bagian")
            .eq("hewan_id", hewanId)
            .in("bagian", kategori.slots);
          const slotTerpakai = new Set((sudahPilih ?? []).map((p: any) => p.bagian));
          const slotKosong = kategori.slots.find(s => !slotTerpakai.has(s));
          if (slotKosong) {
            await supabase.from("pilihan_bagian").insert({
              hewan_id: hewanId, shohibul_id: inserted.id, bagian: slotKosong,
            });
          }
        }
      }

      return inserted.id;
    },
    onSuccess: (id) => {
      toast.success("Pendaftaran berhasil!");
      navigate(`/shohibul/${id}`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const canSubmit = () => {
    return !!hewanId && !!nama.trim() && !!alamat.trim() && !!noWa.trim();
  };

  const renderForm = () => (
    <div className="space-y-6">
      {/* Pilih Hewan */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Pilih Hewan Qurban</h2>
        {loadingHewan ? (
          <p className="text-muted-foreground">Memuat data hewan...</p>
        ) : (
          <div className="space-y-2">
            {hewanList?.map((h) => {
              const disabled = h.sisa_kuota <= 0;
              const selected = hewanId === h.id;
              return (
                <div
                  key={h.id}
                  onClick={() => !disabled && setHewanId(h.id)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    disabled
                      ? "opacity-50 cursor-not-allowed bg-muted"
                      : selected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold">{h.nomor_urut}</span>
                      <span className="text-muted-foreground ml-2 capitalize">
                        {h.jenis_hewan} · {h.tipe_kepemilikan}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={h.sisa_kuota > 0 ? "default" : "destructive"}
                        className={
                          h.sisa_kuota > 0
                            ? "bg-success/10 text-success border-success/20"
                            : ""
                        }
                      >
                        Sisa: {h.sisa_kuota}/{h.kuota}
                      </Badge>
                      <span className="font-semibold text-sm">
                        {formatRupiah(h.harga)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {(!hewanList || hewanList.length === 0) && (
              <p className="text-muted-foreground text-center py-8">
                Tidak ada hewan yang tersedia untuk pendaftaran.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Data Diri */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Data Diri</h2>
        <div>
          <Label>Tipe Kepemilikan</Label>
          <Input
            value={selectedHewan?.tipe_kepemilikan ?? ""}
            disabled
            className="capitalize bg-muted"
          />
        </div>
        <div>
          <Label>Nama Lengkap *</Label>
          <Input
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Nama shohibul qurban"
          />
        </div>
        <div>
          <Label>Alamat *</Label>
          <Input
            value={alamat}
            onChange={(e) => setAlamat(e.target.value)}
            placeholder="Alamat lengkap"
          />
        </div>
        <div>
          <Label>No. WhatsApp *</Label>
          <Input
            value={noWa}
            onChange={(e) => setNoWa(e.target.value)}
            placeholder="08xxxxxxxxxx"
          />
        </div>
        <div>
          <Label>Catatan Pendaftaran</Label>
          <Textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Catatan khusus terkait pendaftaran (opsional), misal: titipan, permintaan khusus, dll."
            rows={3}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground mt-1">Opsional — akan disimpan sebagai catatan untuk panitia.</p>
        </div>
      </div>

      {/* Request Bagian — hanya untuk sapi */}
      {isSapi && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Request Bagian Hewan (Opsional)</h2>
          <p className="text-sm text-muted-foreground">
            Pilih bagian yang Anda minati. Angka di kanan = maks shohibul yang bisa dapat bagian ini.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {KATEGORI_BAGIAN.map(({ id, label, icon, slots }) => {
              const checked = requestBagian.includes(id);
              const kuota = slots.length;
              const jumlahRequest = requestCountMap?.[id] ?? 0;
              const penuh = jumlahRequest >= kuota;
              const disabled = penuh && !checked;
              return (
                <label
                  key={id}
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
                      if (v) setRequestBagian([...requestBagian, id]);
                      else setRequestBagian(requestBagian.filter((b) => b !== id));
                    }}
                  />
                  <span className="text-lg">{icon}</span>
                  <span className={`text-sm font-medium flex-1 ${penuh ? "line-through text-muted-foreground" : ""}`}>
                    {label}
                  </span>
                  <span className={`text-xs rounded px-1.5 py-0.5 ${penuh ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                    {jumlahRequest}/{kuota}
                  </span>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground italic">
            ⚠️ Request ini bersifat survei awal. Keputusan final ditentukan panitia melalui undian jika ada perebutan.
          </p>
        </div>
      )}

      {/* Navigasi */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
        </Button>
        <Button onClick={() => setStep("ringkasan")} disabled={!canSubmit()}>
          Lanjut ke Ringkasan
        </Button>
      </div>
    </div>
  );

  const renderRingkasan = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Ringkasan Pendaftaran</h2>
      <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Nama</span>
          <span className="font-medium">{nama}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Alamat</span>
          <span className="font-medium">{alamat}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">No. WA</span>
          <span className="font-medium">{noWa}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Hewan</span>
          <span className="font-medium">
            {selectedHewan?.nomor_urut} ({selectedHewan?.jenis_hewan})
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tipe</span>
          <span className="font-medium capitalize">{selectedHewan?.tipe_kepemilikan}</span>
        </div>
        {isSapi && requestBagian.length > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Request Bagian</span>
            <span className="font-medium">{requestBagian.map(id => KATEGORI_BAGIAN.find(k => k.id === id)?.label ?? id).join(", ")}</span>
          </div>
        )}
        {catatan.trim() && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground shrink-0">Catatan</span>
            <span className="font-medium text-right">{catatan.trim()}</span>
          </div>
        )}
      </div>
      <Card className="border-primary bg-primary/5">
        <CardContent className="p-4 text-center">
          <p className="text-sm text-muted-foreground">Iuran yang harus dibayar</p>
          <p className="text-2xl font-bold text-primary">
            {formatRupiah(selectedHewan?.iuran_per_orang ?? 0)}
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={() => setStep("form")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Edit Data
        </Button>
        <Button
          onClick={() => submitMutation.mutate()}
          disabled={submitMutation.isPending}
        >
          {submitMutation.isPending ? "Menyimpan..." : "Daftarkan Sekarang"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">Pendaftaran Shohibul Qurban</h1>
        <p className="page-subtitle">Isi data lengkap untuk mendaftar qurban 1447H</p>
      </div>

      <Card>
        <CardContent className="p-6">
          {step === "form" ? renderForm() : renderRingkasan()}
        </CardContent>
      </Card>
    </div>
  );
};

export default ShohibulDaftar;