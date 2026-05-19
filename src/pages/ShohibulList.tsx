import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileUp, CheckCircle2, Circle, Printer } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import ImportExcelDialog from "@/components/ImportExcelDialog";

/* ─── Cetak Daftar Shohibul Sapi — 1 halaman per sapi ─── */
function cetakDaftarSapi(rows: any[]) {
  // Group by hewan
  const grouped: Record<string, { nomorHewan: string; tipe: string; shohibulList: string[] }> = {};
  rows.forEach((s) => {
    const hid = (s.hewan_qurban as any)?.nomor_urut ?? "Tidak diketahui";
    if (!grouped[hid]) {
      grouped[hid] = { nomorHewan: hid, tipe: s.tipe_kepemilikan ?? "", shohibulList: [] };
    }
    grouped[hid].shohibulList.push(s.nama);
  });

  const sapiList = Object.values(grouped).sort((a, b) =>
    a.nomorHewan.localeCompare(b.nomorHewan, undefined, { numeric: true })
  );

  const halamanHtml = sapiList.map((sapi, idx) => {
    const isLast = idx === sapiList.length - 1;
    const badge = sapi.tipe === "kolektif"
      ? `Kolektif — ${sapi.shohibulList.length} Shohibul`
      : `Individu — 1 Shohibul`;
    const namaRows = sapi.shohibulList.map((nama, i) =>
      `<tr style="background:${i % 2 === 0 ? "#fff" : "#f3f3f3"}">
        <td style="border:1px solid #999;padding:8px 12px;text-align:center;font-size:16px;color:#888;width:40px;">${i + 1}.</td>
        <td style="border:1px solid #999;border-left:none;padding:8px 14px;font-size:22px;">${nama}</td>
      </tr>`
    ).join("");
    return `
      <div style="padding:12mm 8mm;min-height:270mm;box-sizing:border-box;${isLast ? "" : "page-break-after:always;"}">
        <div style="border:2px solid #1a4a7a;background:#dbe9f7;padding:10px;text-align:center;margin-bottom:8px;">
          <div style="font-size:30px;font-weight:bold;">${sapi.nomorHewan}</div>
          <div style="font-size:12px;font-weight:bold;color:${sapi.tipe === "kolektif" ? "#1a5c1a" : "#7a4a00"};background:${sapi.tipe === "kolektif" ? "#d4edda" : "#fff3cd"};display:inline-block;padding:2px 12px;border-radius:10px;margin-top:4px;">${badge}</div>
        </div>
        <div style="font-size:12px;font-weight:bold;color:#555;margin-bottom:5px;">Daftar Shohibul Qurban</div>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>${namaRows || `<tr><td colspan="2" style="border:1px solid #ddd;padding:12px;text-align:center;color:#aaa;font-style:italic;">Belum ada shohibul</td></tr>`}</tbody>
        </table>
      </div>`;
  }).join("");

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<html><head><title>Cetak Nama Shohibul Qurban Sapi</title>
    <style>
      @page { size: A4 portrait; margin: 0; }
      body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #000; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style></head><body>${halamanHtml}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 400);
}

/* ─── Cetak Daftar Shohibul Kambing (Portrait) ─── */
function cetakDaftarKambing(rows: any[]) {
  const sorted = [...rows].sort((a, b) => {
    const na = (a.hewan_qurban as any)?.nomor_urut ?? "";
    const nb = (b.hewan_qurban as any)?.nomor_urut ?? "";
    return na.localeCompare(nb, undefined, { numeric: true });
  });
  const rowsHtml = sorted
    .map(
      (s, i) => `<tr>
        <td style="border:1px solid #000;padding:5px 7px;text-align:center;">${i + 1}</td>
        <td style="border:1px solid #000;padding:5px 7px;">${s.nama}</td>
        <td style="border:1px solid #000;padding:5px 7px;text-align:center;">${(s.hewan_qurban as any)?.nomor_urut ?? "-"}</td>
        <td style="border:1px solid #000;padding:5px 7px;">${s.status_penyembelihan === "sendiri" ? "Menyembelih Sendiri (Pinjam Pisau)" : "Diwakilkan Panitia"}</td>
      </tr>`
    )
    .join("");
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<html><head><title>Daftar Shohibul Qurban Kambing</title>
    <style>
      @page { size: A4 portrait; margin: 10mm 8mm; }
      body { font-family: Arial, sans-serif; margin: 0; padding: 0; font-size: 13px; color: #000; }
      h1 { text-align: center; font-size: 19px; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      thead tr { background: #d0d0d0; }
      th { border: 1px solid #000; padding: 6px 8px; text-align: left; font-size: 13px; }
      th:nth-child(1) { width: 34px; text-align: center; }
      th:nth-child(3) { width: 100px; text-align: center; }
      th:nth-child(4) { width: 210px; }
      td:nth-child(3) { text-align: center; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style>
    </head><body>
    <h1>Daftar Nama Shohibul Qurban Kambing</h1>
    <table>
      <thead><tr>
        <th>No.</th>
        <th>Nama Shohibul Qurban Kambing</th>
        <th>Nomor Kambing</th>
        <th>Penyembelih</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 400);
}

/* ─── sub-tabel yang bisa di-reuse per tab ─── */
const ShohibulTable = ({
  rows,
  isAdmin,
  onToggleAkad,
  onToggleStatus,
  onChangePenyembelih,
  showPenyembelih,
}: {
  rows: any[];
  isAdmin: () => boolean;
  onToggleAkad: (id: string, current: boolean) => void;
  onToggleStatus: (id: string, current: string) => void;
  onChangePenyembelih?: (id: string, value: string) => void;
  showPenyembelih?: boolean;
}) => (
  <div className="table-container">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead>Nama</TableHead>
          <TableHead>Hewan</TableHead>
          <TableHead>No. WA</TableHead>
          <TableHead>Tipe</TableHead>
          {showPenyembelih && <TableHead>Penyembelih</TableHead>}
          <TableHead>Akad</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={showPenyembelih ? 8 : 7} className="text-center py-8 text-muted-foreground">
              Belum ada data shohibul
            </TableCell>
          </TableRow>
        )}
        {rows.map((s, idx) => (
          <TableRow key={s.id}>
            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
            <TableCell>
              <Link to={`/shohibul/${s.id}`} className="font-medium text-primary hover:underline">
                {s.nama}
              </Link>
            </TableCell>
            <TableCell>
              {(s.hewan_qurban as any)?.nomor_urut ?? "-"}{" "}
              <Badge variant="outline" className="text-xs capitalize">
                {(s.hewan_qurban as any)?.jenis_hewan}
              </Badge>
            </TableCell>
            <TableCell>
              {s.no_wa ? (
                <a
                  href={`https://wa.me/${s.no_wa.replace(/^0/, "62").replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-sm"
                >
                  {s.no_wa}
                </a>
              ) : "-"}
            </TableCell>
            <TableCell className="capitalize">{s.tipe_kepemilikan}</TableCell>
            {showPenyembelih && (
              <TableCell>
                {isAdmin() ? (
                  <select
                    value={s.status_penyembelihan ?? "diwakilkan"}
                    onChange={(e) => onChangePenyembelih?.(s.id, e.target.value)}
                    className="border rounded px-2 py-1 text-sm bg-background"
                  >
                    <option value="diwakilkan">Diwakilkan Panitia</option>
                    <option value="sendiri">Sendiri (Pinjam Pisau)</option>
                  </select>
                ) : (
                  <span className="text-sm">
                    {s.status_penyembelihan === "sendiri" ? "Sendiri (Pinjam Pisau)" : "Diwakilkan Panitia"}
                  </span>
                )}
              </TableCell>
            )}
            <TableCell>
              <button
                onClick={() => isAdmin() && onToggleAkad(s.id, !!s.akad_dilakukan)}
                className={`flex items-center justify-center transition-colors ${isAdmin() ? "cursor-pointer hover:opacity-70" : "cursor-default"}`}
                title={s.akad_dilakukan ? "Akad sudah dilakukan" : "Akad belum dilakukan"}
              >
                {s.akad_dilakukan
                  ? <CheckCircle2 className="h-5 w-5 text-success" />
                  : <Circle className="h-5 w-5 text-muted-foreground/40" />}
              </button>
            </TableCell>
            <TableCell>
              <button
                onClick={() => isAdmin() && onToggleStatus(s.id, s.status_checklist_panitia ?? "pending")}
                className={`flex items-center justify-center transition-colors ${isAdmin() ? "cursor-pointer hover:opacity-70" : "cursor-default"}`}
                title={s.status_checklist_panitia === "selesai" ? "Selesai" : "Belum selesai"}
              >
                {s.status_checklist_panitia === "selesai"
                  ? <CheckCircle2 className="h-5 w-5 text-success" />
                  : <Circle className="h-5 w-5 text-muted-foreground/40" />}
              </button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

/* ─── Halaman utama ─── */
const ShohibulList = () => {
  const [search, setSearch] = useState("");
  const [showImport, setShowImport] = useState(false);
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["shohibul-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shohibul_qurban")
        .select("*, hewan_qurban(nomor_urut, jenis_hewan)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: hewanList } = useQuery({
    queryKey: ["hewan-list-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hewan_qurban").select("id, nomor_urut");
      if (error) throw error;
      return data;
    },
  });

  const toggleAkadMutation = useMutation({
    mutationFn: async ({ id, current }: { id: string; current: boolean }) => {
      const { error } = await supabase
        .from("shohibul_qurban")
        .update({ akad_dilakukan: !current, akad_timestamp: !current ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shohibul-list"] }),
    onError: (err: any) => toast.error(err.message),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, current }: { id: string; current: string }) => {
      const next = current === "selesai" ? "pending" : "selesai";
      const { error } = await supabase
        .from("shohibul_qurban")
        .update({ status_checklist_panitia: next as any })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shohibul-list"] }),
    onError: (err: any) => toast.error(err.message),
  });

  const penyembelihMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await supabase
        .from("shohibul_qurban")
        .update({ status_penyembelihan: value as any })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shohibul-list"] });
      toast.success("Status penyembelih disimpan");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleImport = async (rows: Record<string, any>[]) => {
    const hewanMap = new Map(hewanList?.map((h) => [h.nomor_urut.toLowerCase(), h.id]) ?? []);
    const inserts = rows.map((r) => {
      const tipe = ["kolektif", "individu"].includes(r.tipe_kepemilikan?.toLowerCase?.().trim())
        ? r.tipe_kepemilikan.toLowerCase().trim() as "kolektif" | "individu"
        : "kolektif" as const;
      const hewanId = r.nomor_urut_hewan
        ? hewanMap.get(String(r.nomor_urut_hewan).toLowerCase().trim()) ?? null
        : null;
      return {
        nama: String(r.nama).trim(),
        no_wa: String(r.no_wa).trim(),
        alamat: r.alamat ? String(r.alamat).trim() : null,
        tipe_kepemilikan: tipe,
        hewan_id: hewanId,
        panitia_pendaftar: r.panitia_pendaftar ? String(r.panitia_pendaftar).trim() : null,
        sumber_pendaftaran: "manual" as const,
        status_checklist_panitia: "pending" as const,
      };
    });
    const { error } = await supabase.from("shohibul_qurban").insert(inserts);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["shohibul-list"] });
    toast.success(`${inserts.length} shohibul berhasil diimport`);
  };

  // Filter berdasarkan search
  const applySearch = (list: any[]) =>
    list.filter((s) => s.nama.toLowerCase().includes(search.toLowerCase()));

  const sapiRows    = applySearch(data?.filter((s) => (s.hewan_qurban as any)?.jenis_hewan === "sapi")    ?? []);
  const kambingRows = applySearch(data?.filter((s) => (s.hewan_qurban as any)?.jenis_hewan === "kambing") ?? []);
  const semuaRows   = applySearch(data ?? []);

  const handleToggleAkad = (id: string, current: boolean) =>
    toggleAkadMutation.mutate({ id, current });
  const handleToggleStatus = (id: string, current: string) =>
    toggleStatusMutation.mutate({ id, current });
  const handleChangePenyembelih = (id: string, value: string) =>
    penyembelihMutation.mutate({ id, value });

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Shohibul Qurban</h1>
          <p className="page-subtitle">Daftar peserta qurban 1447H</p>
        </div>
        {isAdmin() && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <FileUp className="mr-2 h-4 w-4" /> Import Excel
            </Button>
            <Button
              variant="outline"
              onClick={() => cetakDaftarSapi(sapiRows)}
              disabled={sapiRows.length === 0}
              title="Cetak daftar shohibul qurban sapi (landscape)"
            >
              <Printer className="mr-2 h-4 w-4" /> Cetak Daftar Sapi
            </Button>
            <Button
              variant="outline"
              onClick={() => cetakDaftarKambing(kambingRows)}
              disabled={kambingRows.length === 0}
              title="Cetak daftar shohibul qurban kambing (portrait)"
            >
              <Printer className="mr-2 h-4 w-4" /> Cetak Daftar Kambing
            </Button>
            <Link to="/shohibul/daftar">
              <Button><Plus className="mr-2 h-4 w-4" /> Daftarkan</Button>
            </Link>
          </div>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari nama..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : (
        <Tabs defaultValue="sapi">
          <TabsList className="mb-4">
            <TabsTrigger value="sapi" className="gap-2">
              🐄 Sapi
              <Badge variant="secondary" className="ml-1 text-xs">{sapiRows.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="kambing" className="gap-2">
              🐐 Kambing
              <Badge variant="secondary" className="ml-1 text-xs">{kambingRows.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="semua" className="gap-2">
              Semua
              <Badge variant="secondary" className="ml-1 text-xs">{semuaRows.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sapi">
            <ShohibulTable
              rows={sapiRows}
              isAdmin={isAdmin}
              onToggleAkad={handleToggleAkad}
              onToggleStatus={handleToggleStatus}
            />
          </TabsContent>
          <TabsContent value="kambing">
            <ShohibulTable
              rows={kambingRows}
              isAdmin={isAdmin}
              onToggleAkad={handleToggleAkad}
              onToggleStatus={handleToggleStatus}
              onChangePenyembelih={handleChangePenyembelih}
              showPenyembelih
            />
          </TabsContent>
          <TabsContent value="semua">
            <ShohibulTable
              rows={semuaRows}
              isAdmin={isAdmin}
              onToggleAkad={handleToggleAkad}
              onToggleStatus={handleToggleStatus}
            />
          </TabsContent>
        </Tabs>
      )}

      <ImportExcelDialog
        open={showImport}
        onOpenChange={setShowImport}
        onImport={handleImport}
      />
    </div>
  );
};

export default ShohibulList;
