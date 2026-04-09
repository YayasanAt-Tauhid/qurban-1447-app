import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileUp, CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import ImportExcelDialog from "@/components/ImportExcelDialog";

/* ─── sub-tabel yang bisa di-reuse per tab ─── */
const ShohibulTable = ({
  rows,
  isAdmin,
  onToggleAkad,
  onToggleStatus,
}: {
  rows: any[];
  isAdmin: () => boolean;
  onToggleAkad: (id: string, current: boolean) => void;
  onToggleStatus: (id: string, current: string) => void;
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
          <TableHead>Akad</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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

  const sapiRows   = applySearch(data?.filter((s) => (s.hewan_qurban as any)?.jenis_hewan === "sapi")    ?? []);
  const kambingRows = applySearch(data?.filter((s) => (s.hewan_qurban as any)?.jenis_hewan === "kambing") ?? []);
  const semuaRows  = applySearch(data ?? []);

  const handleToggleAkad = (id: string, current: boolean) =>
    toggleAkadMutation.mutate({ id, current });
  const handleToggleStatus = (id: string, current: string) =>
    toggleStatusMutation.mutate({ id, current });

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Shohibul Qurban</h1>
          <p className="page-subtitle">Daftar peserta qurban 1447H</p>
        </div>
        {isAdmin() && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <FileUp className="mr-2 h-4 w-4" /> Import Excel
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
