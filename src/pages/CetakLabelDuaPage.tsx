import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer } from "lucide-react";

function LabelKambing({
  nomorHewan,
  nama,
}: {
  nomorHewan: string;
  nama: string;
}) {
  return (
    <div
      className="label-item"
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        pageBreakInside: "avoid",
        breakInside: "avoid",
      }}
    >
      {/* Baris nomor hewan */}
      <div
        style={{
          width: "100%",
          minHeight: "48px",
          border: "1px solid #999",
          backgroundColor: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          fontSize: "22px",
          fontWeight: "bold",
          color: "#1a1a1a",
          textAlign: "center",
          boxSizing: "border-box",
        }}
      >
        {nomorHewan}
      </div>

      {/* Baris nama shohibul */}
      <div
        style={{
          width: "100%",
          minHeight: "54px",
          border: "1px solid #999",
          borderTop: "none",
          backgroundColor: "#f3f3f3",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          fontSize: "20px",
          fontWeight: "normal",
          color: "#1a1a1a",
          textAlign: "center",
          boxSizing: "border-box",
          padding: "0 6px",
          wordBreak: "break-word",
          lineHeight: 1.2,
        }}
      >
        {nama}
      </div>
    </div>
  );
}

export default function CetakLabelDuaPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["cetak-label-dua-kambing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shohibul_qurban")
        .select("id, nama, hewan_qurban(nomor_urut, jenis_hewan)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const kambingList = (data ?? []).filter(
    (s) => (s.hewan_qurban as any)?.jenis_hewan === "kambing"
  );

  // Bagi menjadi 2 kolom: kolom kiri = index genap, kolom kanan = index ganjil
  const kiriList = kambingList.filter((_, i) => i % 2 === 0);
  const kananList = kambingList.filter((_, i) => i % 2 === 1);

  return (
    <>
      <style>{`
        @page {
          size: 210mm 330mm;
          margin: 8mm;
        }

        @media print {
          body * { visibility: hidden; }
          #cetak-label-dua-area, #cetak-label-dua-area * { visibility: visible; }
          #cetak-label-dua-area {
            position: static;
            top: auto;
            left: auto;
            width: 100%;
          }
          .no-print { display: none !important; }
          .label-item {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .label-kolom {
            width: 50% !important;
          }
        }
      `}</style>

      <div className="p-6 space-y-6 max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 no-print">
          <div>
            <h1 className="text-2xl font-bold">Cetak Label Kambing (2 Kolom)</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Masjid At-Tauhid Pangkalpinang 1447H
            </p>
          </div>
          {!isLoading && (
            <Badge variant="outline" className="text-amber-700 border-amber-400 bg-amber-50">
              🐐 {kambingList.length} kambing
            </Badge>
          )}
        </div>

        {/* Tombol cetak */}
        <div className="flex no-print">
          <Button onClick={() => window.print()} className="gap-2" disabled={isLoading}>
            <Printer className="h-4 w-4" />
            Cetak Label
          </Button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-0.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <p className="text-destructive text-sm">Gagal memuat data. Silakan refresh halaman.</p>
        )}

        {/* Label Area — 2 kolom */}
        {!isLoading && !isError && (
          <div
            id="cetak-label-dua-area"
            style={{ display: "flex", gap: "8mm", alignItems: "flex-start" }}
          >
            {/* Kolom Kiri */}
            <div className="label-kolom" style={{ flex: 1 }}>
              {kiriList.map((s) => (
                <LabelKambing
                  key={s.id}
                  nomorHewan={(s.hewan_qurban as any)?.nomor_urut ?? "-"}
                  nama={s.nama}
                />
              ))}
            </div>

            {/* Garis pemisah */}
            <div
              className="no-print"
              style={{ width: "1px", backgroundColor: "#e5e7eb", alignSelf: "stretch" }}
            />

            {/* Kolom Kanan */}
            <div className="label-kolom" style={{ flex: 1 }}>
              {kananList.map((s) => (
                <LabelKambing
                  key={s.id}
                  nomorHewan={(s.hewan_qurban as any)?.nomor_urut ?? "-"}
                  nama={s.nama}
                />
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  );
}
