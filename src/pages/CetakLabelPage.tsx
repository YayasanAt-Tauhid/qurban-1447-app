import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

function LabelItem({
  nomorHewan,
  nama,
  jenis,
}: {
  nomorHewan: string;
  nama: string;
  jenis: "sapi" | "kambing";
}) {
  const isSapi = jenis === "sapi";

  return (
    <div className="label-item" style={{ display: "flex", flexDirection: "column", width: "100%", pageBreakInside: "avoid", breakInside: "avoid" }}>
      {/* Baris nomor hewan — ganjil, putih, bold */}
      <div style={{
        width: "100%",
        minHeight: "54px",        // ← FIX: minHeight, bukan height
        border: "1px solid #999",
        backgroundColor: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
        fontSize: isSapi ? "28px" : "26px",
        fontWeight: "bold",
        color: "#1a1a1a",
        textAlign: "center",
        boxSizing: "border-box",
      }}>
        {nomorHewan}
      </div>

      {/* Baris nama shohibul — genap, abu-abu, nama besar */}
      <div style={{
        width: "100%",
        minHeight: "63px",        // ← FIX: minHeight, bukan height
        border: "1px solid #999",
        borderTop: "none",
        backgroundColor: "#f3f3f3",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
        fontSize: "26px",
        fontWeight: "normal",
        color: "#1a1a1a",
        textAlign: "center",
        boxSizing: "border-box",
        padding: "0 8px",
        wordBreak: "break-word",
        lineHeight: 1.2,
      }}>
        {nama}
      </div>
    </div>
  );
}

export default function CetakLabelPage() {
  const [filter, setFilter] = useState<"semua" | "sapi" | "kambing">("semua");
  const [showSapi, setShowSapi] = useState(true);
  const [showKambing, setShowKambing] = useState(true);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["cetak-label-shohibul"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shohibul_qurban")
        .select("id, nama, hewan_qurban(nomor_urut, jenis_hewan)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const sapiList = (data ?? []).filter(
    (s) => (s.hewan_qurban as any)?.jenis_hewan === "sapi"
  );
  const kambingList = (data ?? []).filter(
    (s) => (s.hewan_qurban as any)?.jenis_hewan === "kambing"
  );

  return (
    <>
      <style>{`
        @page {
          size: 210mm 330mm;
          margin: 8mm;
        }

        @media print {
          body * { visibility: hidden; }
          #cetak-label-area, #cetak-label-area * { visibility: visible; }
          #cetak-label-area {
            position: static;
            top: auto;
            left: auto;
            width: 100%;
            padding-bottom: 20mm;
          }
          .no-print { display: none !important; }
          .label-kambing { break-before: page; }
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
            <h1 className="text-2xl font-bold">Cetak Label Shohibul Qurban</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Masjid At-Tauhid Pangkalpinang 1447H
            </p>
          </div>
          {!isLoading && (
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-green-700 border-green-400 bg-green-50">
                🐄 {sapiList.length} sapi
              </Badge>
              <Badge variant="outline" className="text-amber-700 border-amber-400 bg-amber-50">
                🐐 {kambingList.length} kambing
              </Badge>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap no-print">
          <div className="flex rounded-lg border overflow-hidden">
            {(["semua", "sapi", "kambing"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {f === "semua" ? "Semua" : f === "sapi" ? "🐄 Sapi" : "🐐 Kambing"}
              </button>
            ))}
          </div>
          <Button onClick={() => window.print()} className="ml-auto gap-2" disabled={isLoading}>
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

        {/* Label Area */}
        {!isLoading && !isError && (
          <div id="cetak-label-area">

            {/* ── SAPI ── */}
            {(filter === "semua" || filter === "sapi") && (
              <div>
                <div
                  className="flex items-center gap-2 mb-2 cursor-pointer no-print"
                  onClick={() => setShowSapi(!showSapi)}
                >
                  <h2 className="text-base font-semibold text-green-800">
                    🐄 Label Sapi ({sapiList.length})
                  </h2>
                  {showSapi ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
                {(showSapi || filter === "sapi") && (
                  <div style={{ width: "100%" }}>
                    {sapiList.map((s) => (
                      <LabelItem
                        key={s.id}
                        nomorHewan={(s.hewan_qurban as any)?.nomor_urut ?? "-"}
                        nama={s.nama}
                        jenis="sapi"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── KAMBING ── */}
            {(filter === "semua" || filter === "kambing") && (
              <div className={`label-kambing ${filter === "semua" ? "mt-6" : ""}`}>
                <div
                  className="flex items-center gap-2 mb-2 cursor-pointer no-print"
                  onClick={() => setShowKambing(!showKambing)}
                >
                  <h2 className="text-base font-semibold text-amber-800">
                    🐐 Label Kambing ({kambingList.length})
                  </h2>
                  {showKambing ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
                {(showKambing || filter === "kambing") && (
                  <div style={{ width: "100%" }}>
                    {kambingList.map((s) => (
                      <LabelItem
                        key={s.id}
                        nomorHewan={(s.hewan_qurban as any)?.nomor_urut ?? "-"}
                        nama={s.nama}
                        jenis="kambing"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </>
  );
}