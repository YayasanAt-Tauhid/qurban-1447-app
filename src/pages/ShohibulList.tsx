import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const ShohibulList = () => {
  const [search, setSearch] = useState("");

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

  const filtered = data?.filter((s) =>
    s.nama.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Shohibul Qurban</h1>
          <p className="page-subtitle">Daftar peserta qurban 1447H</p>
        </div>
        <Link to="/shohibul/daftar">
          <Button><Plus className="mr-2 h-4 w-4" /> Daftarkan</Button>
        </Link>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cari nama..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : (
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
              {filtered?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Belum ada data shohibul
                  </TableCell>
                </TableRow>
              )}
              {filtered?.map((s, idx) => (
                <TableRow key={s.id}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell>
                    <Link to={`/shohibul/${s.id}`} className="font-medium text-primary hover:underline">
                      {s.nama}
                    </Link>
                  </TableCell>
                  <TableCell>{(s.hewan_qurban as any)?.nomor_urut ?? "-"}</TableCell>
                  <TableCell className="capitalize">{s.tipe_kepemilikan}</TableCell>
                  <TableCell>
                    <Badge variant={s.akad_dilakukan ? "default" : "outline"}
                      className={s.akad_dilakukan ? "bg-success/10 text-success border-success/20" : ""}>
                      {s.akad_dilakukan ? "Sudah" : "Belum"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {s.status_checklist_panitia}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default ShohibulList;
