import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatRupiah } from "@/lib/qurban-utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";

const statusColors: Record<string, string> = {
  survei: "bg-warning/10 text-warning border-warning/20",
  booking: "bg-info/10 text-info border-info/20",
  lunas: "bg-success/10 text-success border-success/20",
};

const HewanTable = ({
  hewanList,
  kuotaData,
  isAdmin,
  search,
}: {
  hewanList: any[];
  kuotaData: Record<string, number>;
  isAdmin: () => boolean;
  search: string;
}) => {
  const navigate = useNavigate();
  const filtered = hewanList.filter(
    (h) =>
      h.nomor_urut.toLowerCase().includes(search.toLowerCase()) ||
      h.jenis_hewan.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="table-container">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Nomor</TableHead>
            <TableHead>Jenis</TableHead>
            <TableHead>Tipe</TableHead>
            <TableHead>Harga</TableHead>
            <TableHead>Kuota</TableHead>
            <TableHead>Status</TableHead>
            {isAdmin() && <TableHead className="w-16">Aksi</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={isAdmin() ? 8 : 7} className="text-center py-8 text-muted-foreground">
                Belum ada data hewan
              </TableCell>
            </TableRow>
          )}
          {filtered.map((hewan, idx) => {
            const terisi = kuotaData?.[hewan.id] ?? 0;
            const sisa = hewan.kuota - terisi;
            return (
              <TableRow key={hewan.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                <TableCell>
                  <Link to={`/hewan/${hewan.id}`} className="font-medium text-primary hover:underline">
                    {hewan.nomor_urut}
                  </Link>
                </TableCell>
                <TableCell className="capitalize">{hewan.jenis_hewan}</TableCell>
                <TableCell className="capitalize">{hewan.tipe_kepemilikan}</TableCell>
                <TableCell>{formatRupiah(Number(hewan.harga))}</TableCell>
                <TableCell>
                  <Badge
                    variant={sisa <= 0 ? "destructive" : "default"}
                    className={sisa > 0 ? "bg-success/10 text-success border-success/20" : ""}
                  >
                    {terisi}/{hewan.kuota}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusColors[hewan.status] || ""}>
                    {hewan.status}
                  </Badge>
                </TableCell>
                {isAdmin() && (
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/hewan/${hewan.id}`)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

const HewanList = () => {
  const [search, setSearch] = useState("");
  const { isAdmin } = useAuth();

  const { data: hewanList, isLoading } = useQuery({
    queryKey: ["hewan-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hewan_qurban").select("*").order("nomor_urut");
      if (error) throw error;
      return data;
    },
  });

  const { data: kuotaData = {} } = useQuery({
    queryKey: ["shohibul-per-hewan"],
    queryFn: async () => {
      const { data } = await supabase.from("shohibul_qurban").select("hewan_id");
      const counts: Record<string, number> = {};
      data?.forEach((row) => {
        if (row.hewan_id) counts[row.hewan_id] = (counts[row.hewan_id] || 0) + 1;
      });
      return counts;
    },
  });

  const sapiList = hewanList?.filter((h) => h.jenis_hewan === "sapi") ?? [];
  const kambingList = hewanList?.filter((h) => h.jenis_hewan === "kambing") ?? [];

  const jumlahSapi = sapiList.length;
  const jumlahKambing = kambingList.length;

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Hewan Qurban</h1>
          <p className="page-subtitle">Kelola data hewan qurban 1447H</p>
        </div>
        {isAdmin() && (
          <Link to="/hewan/tambah">
            <Button><Plus className="mr-2 h-4 w-4" /> Tambah Hewan</Button>
          </Link>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari hewan..."
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
              <Badge variant="secondary" className="ml-1 text-xs">{jumlahSapi}</Badge>
            </TabsTrigger>
            <TabsTrigger value="kambing" className="gap-2">
              🐐 Kambing
              <Badge variant="secondary" className="ml-1 text-xs">{jumlahKambing}</Badge>
            </TabsTrigger>
            <TabsTrigger value="semua" className="gap-2">
              Semua
              <Badge variant="secondary" className="ml-1 text-xs">{(hewanList?.length ?? 0)}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sapi">
            <HewanTable
              hewanList={sapiList}
              kuotaData={kuotaData}
              isAdmin={isAdmin}
              search={search}
            />
          </TabsContent>
          <TabsContent value="kambing">
            <HewanTable
              hewanList={kambingList}
              kuotaData={kuotaData}
              isAdmin={isAdmin}
              search={search}
            />
          </TabsContent>
          <TabsContent value="semua">
            <HewanTable
              hewanList={hewanList ?? []}
              kuotaData={kuotaData}
              isAdmin={isAdmin}
              search={search}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default HewanList;
