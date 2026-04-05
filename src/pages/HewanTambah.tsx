import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { hitungIuranPerOrang } from "@/lib/qurban-utils";
import { ArrowLeft } from "lucide-react";

const HewanTambah = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    nomor_urut: "",
    jenis_hewan: "sapi" as "sapi" | "kambing",
    tipe_kepemilikan: "kolektif" as "kolektif" | "individu",
    jenis_kelamin: "jantan" as "jantan" | "betina",
    ras: "",
    nama_penjual: "",
    hp_penjual: "",
    alamat_penjual: "",
    harga: "",
    estimasi_bobot: "",
    uang_muka: "",
    catatan: "",
  });

  const kuota = form.tipe_kepemilikan === "kolektif" && form.jenis_hewan === "sapi" ? 7 : 1;
  const harga = parseInt(form.harga) || 0;
  const iuran = form.tipe_kepemilikan === "kolektif" ? hitungIuranPerOrang(harga) : harga;

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: inserted, error } = await supabase.from("hewan_qurban").insert({
        nomor_urut: form.nomor_urut,
        jenis_hewan: form.jenis_hewan,
        tipe_kepemilikan: form.tipe_kepemilikan,
        jenis_kelamin: form.jenis_kelamin,
        ras: form.ras || null,
        nama_penjual: form.nama_penjual || null,
        hp_penjual: form.hp_penjual || null,
        alamat_penjual: form.alamat_penjual || null,
        harga,
        estimasi_bobot: parseInt(form.estimasi_bobot) || null,
        iuran_per_orang: iuran,
        kuota,
        uang_muka: parseInt(form.uang_muka) || 0,
        catatan: form.catatan || null,
      }).select("id").single();
      if (error) throw error;
      return inserted.id;
    },
    onSuccess: (newId: string) => {
      queryClient.invalidateQueries({ queryKey: ["hewan-list"] });
      toast.success("Hewan berhasil ditambahkan!");
      navigate(`/hewan/${newId}`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const update = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="page-header">
        <Button variant="ghost" size="sm" onClick={() => navigate("/hewan")} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
        </Button>
        <h1 className="page-title">Tambah Hewan Qurban</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Data Hewan</CardTitle></CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nomor Urut *</Label>
                <Input placeholder="Sapi 1" value={form.nomor_urut} onChange={(e) => update("nomor_urut", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Jenis Hewan *</Label>
                <Select value={form.jenis_hewan} onValueChange={(v) => update("jenis_hewan", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sapi">Sapi</SelectItem>
                    <SelectItem value="kambing">Kambing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipe Kepemilikan *</Label>
                <Select value={form.tipe_kepemilikan} onValueChange={(v) => update("tipe_kepemilikan", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kolektif">Kolektif</SelectItem>
                    <SelectItem value="individu">Individu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Jenis Kelamin</Label>
                <Select value={form.jenis_kelamin} onValueChange={(v) => update("jenis_kelamin", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="jantan">Jantan</SelectItem>
                    <SelectItem value="betina">Betina</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ras</Label>
                <Input placeholder="Limosin" value={form.ras} onChange={(e) => update("ras", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Estimasi Bobot (kg)</Label>
                <Input type="number" placeholder="500" value={form.estimasi_bobot} onChange={(e) => update("estimasi_bobot", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Harga (Rp) *</Label>
                <Input type="number" placeholder="35000000" value={form.harga} onChange={(e) => update("harga", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Uang Muka (Rp)</Label>
                <Input type="number" placeholder="5000000" value={form.uang_muka} onChange={(e) => update("uang_muka", e.target.value)} />
              </div>
            </div>

            <div className="bg-muted rounded-lg p-4 space-y-1 text-sm">
              <p>Kuota: <strong>{kuota} orang</strong></p>
              {form.tipe_kepemilikan === "kolektif" && (
                <p>Iuran per orang: <strong>Rp {iuran.toLocaleString("id-ID")}</strong></p>
              )}
            </div>

            <hr />
            <h3 className="font-semibold">Data Penjual</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nama Penjual</Label>
                <Input value={form.nama_penjual} onChange={(e) => update("nama_penjual", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>No. HP Penjual</Label>
                <Input value={form.hp_penjual} onChange={(e) => update("hp_penjual", e.target.value)} />
              </div>
              <div className="col-span-full space-y-2">
                <Label>Alamat Penjual</Label>
                <Input value={form.alamat_penjual} onChange={(e) => update("alamat_penjual", e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea value={form.catatan} onChange={(e) => update("catatan", e.target.value)} />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/hewan")}>
                Batal
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default HewanTambah;
