import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Share2 } from "lucide-react";
import { formatTanggal } from "@/lib/qurban-utils";

const AkadPage = () => {
  const { shohibulId } = useParams<{ shohibulId: string }>();
  const [agreed, setAgreed] = useState(false);
  const [success, setSuccess] = useState(false);
  const [akadTime, setAkadTime] = useState<Date | null>(null);
  const [isWakilkan, setIsWakilkan] = useState(false);
  const [namaWakil, setNamaWakil] = useState("");

  const { data: shohibul, isLoading: loadingShohibul } = useQuery({
    queryKey: ["akad-shohibul", shohibulId],
    queryFn: async () => {
      const { data, error } = await supabase.from("shohibul_qurban").select("*, hewan_qurban(*)").eq("id", shohibulId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!shohibulId,
  });

  const { data: requestBagian } = useQuery({
    queryKey: ["akad-request", shohibulId],
    queryFn: async () => {
      const { data, error } = await supabase.from("request_bagian").select("bagian").eq("shohibul_qurban_id", shohibulId!);
      if (error) throw error;
      return data;
    },
    enabled: !!shohibulId,
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("shohibul_qurban")
        .update({
          akad_dilakukan: true,
          akad_timestamp: now,
          akad_diwakilkan: isWakilkan,
          nama_wakil_akad: isWakilkan ? namaWakil.trim() : null,
        })
        .eq("id", shohibulId!);
      if (error) throw error;
      return now;
    },
    onSuccess: (timestamp) => { setAkadTime(new Date(timestamp)); setSuccess(true); },
    onError: (err: any) => toast.error(err.message),
  });

  const shareWhatsApp = () => {
    if (!shohibul || !akadTime) return;
    const hewan = shohibul.hewan_qurban as any;
    const wakilInfo = isWakilkan
      ? `\nQabul diwakilkan oleh: ${namaWakil}`
      : "\nQabul dilakukan langsung";
    const msg = `Assalamu'alaikum, akad qurban telah tercatat.\n\nNama: ${shohibul.nama}\nJenis: ${hewan?.jenis_hewan} (${hewan?.tipe_kepemilikan})\nWaktu: ${formatTanggal(akadTime)}${wakilInfo}\n\nJazakumullahu khairan.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  if (loadingShohibul) return <div className="min-h-screen bg-background flex items-center justify-center p-4"><Skeleton className="h-96 w-full max-w-lg" /></div>;
  if (!shohibul) return <div className="min-h-screen bg-background flex items-center justify-center p-4"><p className="text-muted-foreground">Data shohibul tidak ditemukan.</p></div>;

  if (shohibul.akad_dilakukan && !success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg w-full shadow-lg">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
            <h2 className="text-xl font-bold">Akad Sudah Dilakukan</h2>
            <p className="text-muted-foreground">Akad untuk <strong>{shohibul.nama}</strong> sudah tercatat pada {shohibul.akad_timestamp ? formatTanggal(shohibul.akad_timestamp) : "-"}.</p>
            <p className="text-sm">
              Status qabul:{" "}
              <strong>
                {shohibul.akad_diwakilkan
                  ? `Diwakilkan (${shohibul.nama_wakil_akad})`
                  : "Langsung oleh shohibul"}
              </strong>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hewan = shohibul?.hewan_qurban as any;

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg w-full shadow-lg">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
            <h2 className="text-xl font-bold text-success">Akad Berhasil Tercatat</h2>
            <div className="text-sm space-y-1">
              <p>Nama: <strong>{shohibul.nama}</strong></p>
              <p>Jenis Qurban: <strong className="capitalize">{hewan?.jenis_hewan} ({hewan?.tipe_kepemilikan})</strong></p>
              <p>Waktu Akad: <strong>{akadTime ? formatTanggal(akadTime) : "-"}</strong></p>
              <p>
                Status qabul:{" "}
                <strong>
                  {isWakilkan
                    ? `Diwakilkan (${namaWakil})`
                    : "Langsung oleh shohibul"}
                </strong>
              </p>
            </div>
            <p className="text-muted-foreground text-sm italic">Jazakumullahu khairan, akad Anda telah tercatat. Panitia akan menghubungi Anda.</p>
            <Button variant="outline" className="mt-2" onClick={shareWhatsApp}>
              <Share2 className="mr-2 h-4 w-4" /> Bagikan via WhatsApp
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isKambing = hewan?.jenis_hewan === "kambing";
  const isSapiKolektif = hewan?.jenis_hewan === "sapi" && hewan?.tipe_kepemilikan === "kolektif";
  const requestedParts = requestBagian?.map((r) => r.bagian) ?? [];

  const getTitle = () => {
    if (isKambing) return "📝 Akad Shohibul Qurban Kambing";
    if (isSapiKolektif) return "📝 Akad Shohibul Qurban Sapi (Kolektif 7 Orang)";
    return "📝 Akad Shohibul Qurban Sapi";
  };

  const getPoin4 = () => {
    if (isKambing) {
      const base = "Shohibul Qurban membawa: separuh badan (mulai paha kanan belakang hingga paha kanan depan), hati, jantung, paru-paru, ginjal, limpa, lambung (babat), kepala, empat tulang kaki, dan lainnya.";
      return base + (requestedParts.length > 0 ? ` Termasuk: ${requestedParts.join(", ")}.` : "");
    }
    if (isSapiKolektif) {
      const ri = requestedParts.length > 0 ? `Bagian yang Anda request: ${requestedParts.join(", ")}.` : "Anda belum mengajukan request bagian.";
      return `Shohibul Qurban mendapatkan 1/7 bagian daging bersih. Bagian lainnya (jeroan, kepala, kulit, ekor, kaki, tulang) dibagi sesuai request yang telah diajukan. ${ri} Bagian yang tidak di-request oleh siapapun menjadi hak mustahiq.`;
    }
    const ri = requestedParts.length > 0 ? `Bagian yang Anda request: ${requestedParts.join(", ")}.` : "Semua bagian akan diserahkan ke Anda.";
    return `Shohibul Qurban membawa keseluruhan daging dan bagian hewan kecuali yang secara sukarela disedekahkan. ${ri}`;
  };

  const getPoin5 = () => {
    if (isSapiKolektif) return "Daging sapi yang tersisa setelah pembagian 1/7 per shohibul dibagikan panitia ke daftar mustahiq sebagai hadiah/sedekah.";
    return `Daging ${isKambing ? "kambing" : "sapi"} dan tulang yang tersisa dibagikan oleh panitia ke daftar mustahiq yang ada pada panitia sebagai hadiah/sedekah.`;
  };

  const getIlustrasi = () => {
    if (isKambing) return "Ilustrasi tahun lalu: Setiap mustahiq mendapatkan daging kambing ±8 ons dan ±6 ons tulang. Jumlah tahun ini bisa berbeda tergantung kondisi hewan kurban.";
    return "Ilustrasi: Setiap mustahiq mendapatkan ±1 kg daging sapi. Jumlah bisa berbeda tergantung kondisi hewan dan jumlah mustahiq.";
  };

  const poinList = [
    "Shohibul Qurban adalah pemilik hewan kurban, dan panitia bertindak sebagai wakil dari Shohibul Qurban.",
    "Shohibul Qurban mencari sendiri hewan kurbannya.",
    "Shohibul Qurban mewakilkan kepada panitia untuk mengurus hewan kurban, mulai dari penyembelihan, pengulitan, hingga proses selanjutnya.",
    getPoin4(), getPoin5(),
    "Daftar mustahiq: Fakir miskin, Jamaah Masjid, Warga sekitar masjid, Panitia (yang tidak masuk 3 kategori di atas), Aparat pemerintahan dan tokoh masyarakat terdekat (RT, RW, Lurah, Babinkamtibmas, dll.), Jika ada kelebihan, dibagikan kepada pihak lain yang dinilai layak.",
    "Daging yang dibagikan oleh panitia adalah milik Shohibul Qurban, panitia hanya sebagai wakil dalam penyerahannya.",
    getIlustrasi(),
  ];

  const canSubmit = agreed && (!isWakilkan || namaWakil.trim().length > 0);

  return (
    <div className="min-h-screen bg-background p-4 flex justify-center">
      <Card className="max-w-lg w-full shadow-lg">
        <CardContent className="p-6 sm:p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-xl font-bold">{getTitle()}</h1>
            <Badge variant="outline" className="mt-2 capitalize">{shohibul.nama}</Badge>
          </div>
          <p className="text-sm leading-relaxed">Bismillaah, afwan abu dan ummu. Sebelum pelaksanaan ibadah qurban, kami selaku panitia menyampaikan penawaran akad (ijab) berikut sebagai bentuk kesepahaman antara Shohibul Qurban dan Panitia. Mohon dibaca dengan seksama, kemudian sampaikan persetujuan (qabul) Anda di bagian bawah.</p>
          <ol className="space-y-3">
            {poinList.map((poin, idx) => (
              <li key={idx} className={`text-sm leading-relaxed p-3 rounded-lg ${idx === 3 ? "bg-yellow-50 border border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800" : "bg-muted/30"}`}>
                <span className="font-bold text-primary mr-2">{idx + 1}.</span>{poin}
              </li>
            ))}
          </ol>
          <p className="text-sm leading-relaxed italic text-muted-foreground">Demikian ijab dari kami selaku panitia. Jika Abu/Ummu menyetujui seluruh poin di atas, silakan sampaikan qabul dengan menekan tombol di bawah. Semoga Allah mudahkan kita semua dalam pelaksanaan ibadah qurban tahun ini. Aamiin.</p>
          <div className="border-t pt-4 space-y-4">
            {/* Step 1: Checkbox */}
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} className="mt-0.5" />
              <span className="text-sm">Saya telah membaca dan memahami poin-poin di atas</span>
            </label>

            {/* Step 2: Qabul method (only show after checkbox) */}
            {agreed && (
              <div className="space-y-3 p-4 rounded-lg bg-muted/30 border">
                <Label className="text-sm font-semibold">Cara qabul:</Label>
                <RadioGroup
                  value={isWakilkan ? "wakilkan" : "langsung"}
                  onValueChange={(v) => setIsWakilkan(v === "wakilkan")}
                  className="space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="langsung" id="qabul-langsung" />
                    <Label htmlFor="qabul-langsung" className="text-sm cursor-pointer">Saya menyetujui sendiri (qabul langsung)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="wakilkan" id="qabul-wakilkan" />
                    <Label htmlFor="qabul-wakilkan" className="text-sm cursor-pointer">Saya mewakilkan persetujuan kepada panitia</Label>
                  </div>
                </RadioGroup>

                {isWakilkan && (
                  <div className="space-y-1 mt-2">
                    <Label className="text-sm">Nama yang mewakilkan *</Label>
                    <Input
                      value={namaWakil}
                      onChange={(e) => setNamaWakil(e.target.value)}
                      placeholder="Contoh: Abu Ahmad"
                    />
                  </div>
                )}
              </div>
            )}

            <Button
              className="w-full h-12 text-base bg-primary hover:bg-primary/90"
              disabled={!canSubmit || approveMutation.isPending}
              onClick={() => approveMutation.mutate()}
            >
              {approveMutation.isPending
                ? "Menyimpan..."
                : isWakilkan
                  ? "✓ Konfirmasi — Qabul Diwakilkan"
                  : "✓ Saya Menyetujui Kesepakatan Ini"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AkadPage;
