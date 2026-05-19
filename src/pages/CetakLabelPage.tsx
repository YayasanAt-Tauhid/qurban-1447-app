import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer } from "lucide-react";

// ── Tipe data ──
interface SapiGroup {
  hewanId: string;
  nomorHewan: string;
  tipeKepemilikan: "kolektif" | "individu";
  shohibulList: { nama: string; statusPenyembelihan: string | null }[];
}

// ── Satu halaman per sapi ──
function HalamanSapi({
  sapi,
  isLast,
}: {
  sapi: SapiGroup;
  isLast: boolean;
}) {
  const isKolektif = sapi.tipeKepemilikan === "kolektif";

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
      {/* ── Nomor Sapi ── */}
      <div
        style={{
          width: "100%",
          minHeight: "64px",
          border: "2px solid #1a4a7a",
          backgroundColor: "#dbe9f7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          fontFamily: "sans-serif",
          textAlign: "center",
          boxSizing: "border-box",
          marginBottom: "6px",
          gap: "2px",
        }}
      >
        <span style={{ fontSize: "30px", fontWeight: "bold", color: "#1a1a1a" }}>
          {sapi.nomorHewan}
        </span>
        <span
          style={{
            fontSize: "11px",
            fontWeight: "bold",
            color: isKolektif ? "#1a5c1a" : "#7a4a00",
            backgroundColor: isKolektif ? "#d4edda" : "#fff3cd",
            padding: "1px 10px",
            borderRadius: "10px",
            border: `1px solid ${isKolektif ? "#8bc34a" : "#f0ad4e"}`,
          }}
        >
          {isKolektif
            ? `Kolektif — ${sapi.shohibulList.length} Shohibul`
            : "Individu — 1 Shohibul"}
        </span>
      </div>

      {/* ── Sub-judul ── */}
      <div
        style={{
          fontFamily: "sans-serif",
          fontSize: "12px",
          fontWeight: "bold",
          color: "#555",
          marginBottom: "5px",
          paddingLeft: "2px",
        }}
      >
        Daftar Shohibul Qurban
      </div>

      {/* ── Daftar nama ── */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {sapi.shohibulList.length === 0 ? (
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
              fontSize: "13px",
              color: "#aaa",
              fontStyle: "italic",
            }}
          >
            Belum ada shohibul terdaftar
          </div>
        ) : (
          sapi.shohibulList.map((s, idx) => {
            const labelStatus =
              s.statusPenyembelihan === "sendiri"
                ? "Menyembelih Sendiri"
                : s.statusPenyembelihan === "diwakilkan"
                ? "Diwakilkan"
                : null;

            return (
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
                  boxSizing: "border-box",
                  padding: "6px 12px",
                  gap: "10px",
                }}
              >
                {/* Nomor urut */}
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#888",
                    minWidth: "26px",
                    textAlign: "right",
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}.
                </span>

                {/* Nama */}
                <span
                  style={{
                    fontSize: "22px",
                    fontWeight: "normal",
                    color: "#1a1a1a",
                    flex: 1,
                    wordBreak: "break-word",
                    lineHeight: 1.3,
                  }}
                >
                  {s.nama}
                </span>

                {/* Badge status penyembelihan (jika ada) */}
                {labelStatus && (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: "bold",
                      padding: "2px 7px",
                      borderRadius: "8px",
                      backgroundColor:
                        s.statusPenyembelihan === "sendiri" ? "#fff3cd" : "#d4edda",
                      color:
                        s.statusPenyembelihan === "sendiri" ? "#7a4a00" : "#1a5c1a",
                      border: `1px solid ${
                        s.statusPenyembelihan === "sendiri" ? "#f0ad4e" : "#8bc34a"
                      }`,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {labelStatus}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function CetakLabelPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["cetak-label-sapi-per-halaman"],
    queryFn: async () => {
      // Ambil semua hewan sapi
      const { data: hewanData, error: hewanError } = await supabase
        .from("hewan_qurban")
        .select("id, nomor_urut, jenis_hewan, tipe_kepemilikan")
        .eq("jenis_hewan", "sapi")
        .order("nomor_urut");
      if (hewanError) throw hewanError;

      // Ambil semua shohibul sapi
      const { data: shohibulData, error: shohibulError } = await supabase
        .from("shohibul_qurban")
        .select("id, nama, hewan_id, status_penyembelihan")
        .order("created_at", { ascending: true });
      if (shohibulError) throw shohibulError;

      // Group per hewan
      const grouped: SapiGroup[] = (hewanData ?? []).map((h) => ({
        hewanId: h.id,
        nomorHewan: h.nomor_urut,
        tipeKepemilikan: h.tipe_kepemilikan as "kolektif" | "individu",
        shohibulList: (shohibulData ?? [])
          .filter((s) => s.hewan_id === h.id)
          .map((s) => ({
            nama: s.nama,
            statusPenyembelihan: s.status_penyembelihan,
          })),
      }));

      return grouped;
    },
  });

  const totalShohibul = data?.reduce((sum, s) => sum + s.shohibulList.length, 0) ?? 0;
  const jumlahKolektif = data?.filter((s) => s.tipeKepemilikan === "kolektif").length ?? 0;
  const jumlahIndividu = data?.filter((s) => s.tipeKepemilikan === "individu").length ?? 0;

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
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline" className="text-green-700 border-green-400 bg-green-50">
                🐄 {data.length} sapi
              </Badge>
              <Badge variant="outline" className="text-blue-700 border-blue-400 bg-blue-50">
                👥 Kolektif: {jumlahKolektif}
              </Badge>
              <Badge variant="outline" className="text-orange-700 border-orange-400 bg-orange-50">
                👤 Individu: {jumlahIndividu}
              </Badge>
              <Badge variant="outline" className="text-purple-700 border-purple-400 bg-purple-50">
                📋 {totalShohibul} shohibul
              </Badge>
            </div>
          )}
        </div>

        {/* Tombol cetak */}
        <div className="flex no-print">
          <Button onClick={() => window.print()} className="gap-2" disabled={isLoading}>
            <Printer className="h-4 w-4" />
            Cetak — {data?.length ?? 0} Halaman
          </Button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <p className="text-destructive text-sm">Gagal memuat data. Silakan refresh halaman.</p>
        )}

        {/* Label Area */}
        {!isLoading && !isError && data && (
          <div id="cetak-label-sapi-area">
            {data.length === 0 ? (
              <p className="text-muted-foreground text-sm">Belum ada hewan sapi terdaftar.</p>
            ) : (
              data.map((sapi, idx) => (
                <HalamanSapi
                  key={sapi.hewanId}
                  sapi={sapi}
                  isLast={idx === data.length - 1}
                />
              ))
            )}
          </div>
        )}

      </div>
    </>
  );
}
