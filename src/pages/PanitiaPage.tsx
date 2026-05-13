import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, MoreVertical, Edit2, Trash2, Phone, FileUp } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import ImportExcelDialog from "@/components/ImportExcelDialog";

type DivisiPanitia = Database["public"]["Enums"]["divisi_panitia"];
type RolePanitia = Database["public"]["Enums"]["role_panitia"];
type UkuranSeragam = Database["public"]["Enums"]["ukuran_seragam"];

const DIVISI_OPTIONS: DivisiPanitia[] = ["ketua", "sekretaris", "bendahara", "koord_sapi", "koord_kambing", "penyembelih_sapi", "penyembelih_kambing", "distribusi", "konsumsi", "syariat", "area_sapi", "area_kambing", "lainnya"];
const ROLE_OPTIONS: RolePanitia[] = ["super_admin", "admin_pendaftaran", "admin_keuangan", "admin_kupon", "admin_hewan", "panitia", "viewer"];
const UKURAN_OPTIONS: UkuranSeragam[] = ["S", "M", "L", "XL", "XXL"];
const VALID_DIVISI = new Set(DIVISI_OPTIONS);
const VALID_ROLES = new Set(ROLE_OPTIONS);
const VALID_UKURAN = new Set(UKURAN_OPTIONS);

const DIVISI_COLORS: Record<string, string> = {
  ketua: "bg-primary/10 text-primary",
  sekretaris: "bg-info/10 text-info",
  bendahara: "bg-warning/10 text-warning",
  distribusi: "bg-success/10 text-success",
};

const PanitiaPage = () => {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole(["super_admin"]);
  const [filterDivisi, setFilterDivisi] = useState("semua");
  const [filterRole, setFilterRole] = useState("semua");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const [formNama, setFormNama] = useState("");
  const [formJabatan, setFormJabatan] = useState("");
  const [formDivisi, setFormDivisi] = useState<DivisiPanitia>("lainnya");
  const [formNoHp, setFormNoHp] = useState("");
  const [formUkuran, setFormUkuran] = useState<UkuranSeragam | "">("");
  const [formRole, setFormRole] = useState<RolePanitia>("panitia");

  const { data: panitiaList, isLoading } = useQuery({
    queryKey: ["panitia-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("panitia").select("*").order("nama");
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => {
    setFormNama(""); setFormJabatan(""); setFormDivisi("lainnya");
    setFormNoHp(""); setFormUkuran(""); setFormRole("panitia");
    setEditingId(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        nama: formNama,
        jabatan: formJabatan || null,
        divisi: formDivisi,
        no_hp: formNoHp || null,
        ukuran_seragam: formUkuran || null,
        role: formRole,
      };
      if (editingId) {
        const { error } = await supabase.from("panitia").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("panitia").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panitia-list"] });
      setDialogOpen(false);
      resetForm();
      toast.success(editingId ? "Data panitia diperbarui" : "Panitia ditambahkan");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("panitia").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panitia-list"] });
      setDeleteId(null);
      toast.success("Panitia dihapus");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const startEdit = (p: any) => {
    setEditingId(p.id);
    setFormNama(p.nama);
    setFormJabatan(p.jabatan ?? "");
    setFormDivisi(p.divisi);
    setFormNoHp(p.no_hp ?? "");
    setFormUkuran(p.ukuran_seragam ?? "");
    setFormRole(p.role);
    setDialogOpen(true);
  };

  const normalizeKey = (row: Record<string, any>, key: string): any => {
    const lowerKey = key.toLowerCase();
    for (const k of Object.keys(row)) {
      if (k.toLowerCase() === lowerKey) return row[k];
    }
    return undefined;
  };

  const handleImportPanitia = async (rows: Record<string, any>[]) => {
    const existingNames = new Set(panitiaList?.map((p) => p.nama.toLowerCase()) ?? []);
    const duplicates: string[] = [];

    const inserts = rows.map((r) => {
      const nama = String(normalizeKey(r, "nama")).trim();
      if (existingNames.has(nama.toLowerCase())) {
        duplicates.push(nama);
      }

      const rawDivisi = String(normalizeKey(r, "divisi") ?? "").toLowerCase().trim();
      const divisi: DivisiPanitia = VALID_DIVISI.has(rawDivisi as DivisiPanitia) ? rawDivisi as DivisiPanitia : "lainnya";

      const rawRole = String(normalizeKey(r, "role") ?? "").toLowerCase().trim();
      const role: RolePanitia = VALID_ROLES.has(rawRole as RolePanitia) ? rawRole as RolePanitia : "panitia";

      const rawUkuran = String(normalizeKey(r, "ukuran_seragam") ?? "").toUpperCase().trim();
      const ukuran_seragam = VALID_UKURAN.has(rawUkuran as UkuranSeragam) ? rawUkuran as UkuranSeragam : null;

      return {
        nama,
        jabatan: normalizeKey(r, "jabatan") ? String(normalizeKey(r, "jabatan")).trim() : null,
        divisi,
        no_hp: normalizeKey(r, "no_hp") ? String(normalizeKey(r, "no_hp")).trim() : null,
        ukuran_seragam,
        role,
        user_id: null,
        tahun: 1447,
      };
    });

    if (duplicates.length > 0) {
      toast.warning(`${duplicates.length} nama sudah ada di database, tetap diimport: ${duplicates.slice(0, 3).join(", ")}${duplicates.length > 3 ? "..." : ""}`);
    }

    const { error } = await supabase.from("panitia").insert(inserts);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["panitia-list"] });
    toast.success(`${inserts.length} panitia berhasil diimport`);
  };

  const filtered = panitiaList?.filter((p) => {
    if (filterDivisi !== "semua" && p.divisi !== filterDivisi) return false;
    if (filterRole !== "semua" && p.role !== filterRole) return false;
    return true;
  });

  const rekapSeragam = UKURAN_OPTIONS.map((ukuran) => ({
    ukuran,
    jumlah: panitiaList?.filter((p) => p.ukuran_seragam === ukuran).length ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Panitia</h1>
          <p className="page-subtitle">Manajemen data panitia qurban 1447H ({panitiaList?.length ?? 0} orang)</p>
        </div>
        <div className="flex gap-2">
          {isSuperAdmin && (
            <>
              <Button variant="outline" onClick={() => setShowImport(true)}>
                <FileUp className="mr-2 h-4 w-4" /> Import Excel
              </Button>
              <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" /> Tambah Panitia</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editingId ? "Edit Panitia" : "Tambah Panitia"}</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Nama *</Label><Input value={formNama} onChange={(e) => setFormNama(e.target.value)} /></div>
                    <div><Label>Jabatan</Label><Input value={formJabatan} onChange={(e) => setFormJabatan(e.target.value)} /></div>
                    <div>
                      <Label>Divisi</Label>
                      <Select value={formDivisi} onValueChange={(v) => setFormDivisi(v as DivisiPanitia)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{DIVISI_OPTIONS.map((d) => <SelectItem key={d} value={d} className="capitalize">{d.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>No. HP</Label><Input value={formNoHp} onChange={(e) => setFormNoHp(e.target.value)} /></div>
                    <div>
                      <Label>Ukuran Seragam</Label>
                      <Select value={formUkuran} onValueChange={(v) => setFormUkuran(v as UkuranSeragam)}>
                        <SelectTrigger><SelectValue placeholder="Pilih ukuran" /></SelectTrigger>
                        <SelectContent>{UKURAN_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Role</Label>
                      <Select value={formRole} onValueChange={(v) => setFormRole(v as RolePanitia)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r} className="capitalize">{r.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !formNama.trim()}>
                      {saveMutation.isPending ? "Menyimpan..." : "Simpan"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterDivisi} onValueChange={setFilterDivisi}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua Divisi</SelectItem>
            {DIVISI_OPTIONS.map((d) => <SelectItem key={d} value={d} className="capitalize">{d.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua Role</SelectItem>
            {ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r} className="capitalize">{r.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Card Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered?.map((p) => (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      {p.foto_url && <AvatarImage src={p.foto_url} />}
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">{p.nama.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{p.nama}</p>
                      <p className="text-sm text-muted-foreground">{p.jabatan ?? "-"}</p>
                    </div>
                  </div>
                  {isSuperAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => startEdit(p)}><Edit2 className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteId(p.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Hapus</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge className={DIVISI_COLORS[p.divisi] ?? "bg-muted text-muted-foreground"} variant="outline">
                    {p.divisi.replace(/_/g, " ")}
                  </Badge>
                  <Badge variant="outline" className="capitalize">{p.role.replace(/_/g, " ")}</Badge>
                  {p.ukuran_seragam && <Badge variant="secondary">{p.ukuran_seragam}</Badge>}
                  {!p.user_id && <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">Belum Login</Badge>}
                </div>
                {p.no_hp && (
                  <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" /> {p.no_hp}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Panitia?</AlertDialogTitle>
            <AlertDialogDescription>Data panitia ini akan dihapus permanen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rekap Seragam */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold mb-3">Rekap Kebutuhan Seragam</h3>
          <div className="flex gap-4 flex-wrap">
            {rekapSeragam.map(({ ukuran, jumlah }) => (
              <div key={ukuran} className="text-center bg-muted/50 rounded-lg px-4 py-2 min-w-[60px]">
                <div className="text-lg font-bold">{jumlah}</div>
                <div className="text-xs text-muted-foreground">{ukuran}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Import Excel Dialog */}
      <ImportExcelDialog
        open={showImport}
        onOpenChange={setShowImport}
        title="Import Panitia dari Excel"
        columns={[
          { key: "nama", label: "Nama", required: true },
          { key: "jabatan", label: "Jabatan" },
          { key: "divisi", label: "Divisi" },
          { key: "no_hp", label: "No. HP" },
          { key: "ukuran_seragam", label: "Ukuran Seragam" },
          { key: "role", label: "Role" },
        ]}
        templateData={[
          { nama: "Ahmad Rizki", jabatan: "Koordinator", divisi: "koord_sapi", no_hp: "081234567890", ukuran_seragam: "L", role: "panitia" },
          { nama: "Siti Fatimah", jabatan: "Bendahara", divisi: "bendahara", no_hp: "082345678901", ukuran_seragam: "M", role: "admin_keuangan" },
          { nama: "Budi Santoso", jabatan: "Anggota", divisi: "distribusi", no_hp: "083456789012", ukuran_seragam: "XL", role: "panitia" },
        ]}
        templateFileName="template-panitia.xlsx"
        validateRow={(r) => {
          const nama = normalizeKey(r, "nama");
          return !!nama && String(nama).trim() !== "";
        }}
        onImport={handleImportPanitia}
      />
    </div>
  );
};

export default PanitiaPage;
