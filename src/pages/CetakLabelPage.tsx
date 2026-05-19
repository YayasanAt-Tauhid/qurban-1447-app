import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer } from "lucide-react";

// ── Satu halaman per sapi: header sapi + daftar nama shohibul ──
function HalamanSapi({
  nomorHewan,
  shohibulList,
  isLast,
}: {
  nomorHewan: string;
  shohibulList: string[];
  isLast: boolean;
}) {
  return (
    <div
      className="halaman-sapi"
      style={{
        pageBreakAfter: isLast ? "avoid" : "always",
        breakAfter: isLast ? "avoid" : "page",
        padding: "12mm 8mm",
        minHeight: "270mm",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Nomor Sapi — header besar */}
      <div
        style={{
          width: "100%",
          minHeight: "60px",
          border: "2px solid #1a4a7a",
          backgroundColor: "#dbe9f7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          fontSize: "32px",
          fontWeight: "bold",
          color: "#1a1a1a",
          textAlign: "center",
          boxSizing: "border-box",
          marginBottom: "8px",
        }}
      >
        {nomorHewan}
      </div>

      {/* Label sub-judul */}
      <div
        style={{
          fontFamily: "sans-serif",
          fontSize: "13px",
          fontWeight: "bold",
          color: "#555",
          marginBottom: "6px",
          paddingLeft: "2px",
        }}
      >
        Daftar Shohibul Qurban
      </div>

      {/* Daftar nama shohibul */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
        {shohibulList.map((nama, idx) => (
          <div
            key={idx}
            className="label-item"
            style={{
              width: "100%",
              minHeight: "54px",
              border: "1px solid #999",
              borderTop: idx === 0 ? "1px solid #999" : "none",
              backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f3f3f3",
              display: "flex",
              alignItems: "center",
              fontFamily: "sans-serif",
              fontSize: "22px",
              fontWeight: "normal",
              color: "#1a1a1a",
              boxSizing: "border-box",
              padding: "0 12px",
              wordBreak: "break-word",
              lineHeight: 1.3,
              gap: "12px",
            }}
          >
            <span
              style={{
                fontSize: "16px",
                fontWeight: "bold",
                color: "#888",
                minWidth: "28px",
                textAlign: "right",
              }}
            >
              {idx + 1}.
            </span>
            <span>{nama}</span>
          </div>
        ))}
        {shohibulList.length === 0 && (
          <div
            style={{
              width: "100%",
              minHeight: "54px",
              border: "1px solid #ddd",
              backgroundColor: "#fafafa",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "sans-serif",
              fontSize: "14px",
              color: "#aaa",
              fontStyle: "italic",
            }}
          >
            Belum ada shohibul terdaftar
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tipe data ──
interface SapiGroup {
  hewanId: string;
  nomorHewan: string;
  shohibulList: string[];
}

export default function CetakLabelPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["cetak-label-sapi-per-halaman"],
    queryFn: async () => {
      // Ambil semua hewan sapi beserta shohibulnya
      const { data: hewanData, error: hewanError } = await supabase
        .from("hewan_qurban")
        .select("id, nomor_urut, jenis_hewan")
        .eq("jenis_hewan", "sapi")
        .order("nomor_urut");
      if (hewanError) throw hewanError;

      const { data: shohibulData, error: shohibulError } = await supabase
        .from("shohibul_qurban")
        .select("id, nama, hewan_id")
        .order("created_at", { ascending: true });
      if (shohibulError) throw shohibulError;

      // Group shohibul by hewan_id
      const grouped: SapiGroup[] = (hewanData ?? []).map((h) => ({
        hewanId: h.id,
        nomorHewan: h.nomor_urut,
        shohibulList: (shohibulData ?? [])
          .filter((s) => s.hewan_id === h.id)
          .map((s) => s.nama),
      }));

      return grouped;
    },
  });

  return (
    <>
      <style>{`
        @page {
          size: 210mm 297mm;
          margin: 0;
        }

        @media print {
          body * { visibility: hidden; }
          #cetak-label-sapi-area, #cetak-label-sapi-area * { visibility: visible; }
          #cetak-label-sapi-area {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
          }
          .no-print { display: none !important; }
          .halaman-sapi {
            break-after: page;
            page-break-after: always;
          }
          .halaman-sapi:last-child {
            break-after: avoid;
            page-break-after: avoid;
          }
          .label-item {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="p-6 space-y-6 max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 no-print">
          <div>
            <h1 className="text-2xl font-bold">Cetak Nama Shohibul Qurban Sapi</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Masjid At-Tauhid Pangkalpinang 1447H — 1 halaman per sapi
            </p>
          </div>
          {!isLoading && data && (
            <Badge variant="outline" className="text-green-700 border-green-400 bg-green-50">
              🐄 {data.length} sapi
            </Badge>
          )}
        </div>

        {/* Tombol cetak */}
        <div className="flex no-print">
          <Button onClick={() => window.print()} className="gap-2" disabled={isLoading}>
            <Printer className="h-4 w-4" />
            Cetak
          </Button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <p className="text-destructive text-sm">Gagal memuat data. Silakan refresh halaman.</p>
        )}

        {/* Label Area — 1 sapi per halaman */}
        {!isLoading && !isError && data && (
          <div id="cetak-label-sapi-area">
            {data.map((sapi, idx) => (
              <HalamanSapi
                key={sapi.hewanId}
                nomorHewan={sapi.nomorHewan}
                shohibulList={sapi.shohibulList}
                isLast={idx === data.length - 1}
              />
            ))}
            {data.length === 0 && (
              <p className="text-muted-foreground text-sm">Belum ada hewan sapi terdaftar.</p>
            )}
          </div>
        )}

      </div>
    </>
  );
}
