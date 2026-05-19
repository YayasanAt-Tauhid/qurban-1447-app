import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, Save } from "lucide-react";
import { useState } from "react";

// ── Pilihan penyembelih ──
const PENYEMBELIH_OPTIONS = [
  { value: "panitia", label: "Diwakilkan Panitia" },
  { value: "sendiri", label: "Menyembelih Sendiri (Pinjam Pisau)" },
];

// ── Tipe data ──
interface ShohibulKambing {
  id: string;
  nama: string;
  nomorHewan: string;
  penyembelih?: string; // "panitia" | "sendiri"
}

// ── Komponen label kambing (1 item) ──
function LabelKambing({
  nomorHewan,
  nama,
  penyembelih,
}: {
  nomorHewan: string;
  nama: string;
  penyembelih?: string;
}) {
  const labelPenyembelih =
    penyembelih === "panitia"
      ? "Diwakilkan Panitia"
      : penyembelih === "sendiri"
      ? "Menyembelih Sendiri (Pinjam Pisau)"
      : null;

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
      {/* Nomor hewan */}
      <div
        style={{
          width: "100%",
          minHeight: "44px",
          border: "1px solid #999",
          backgroundColor: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          fontSize: "20px",
          fontWeight: "bold",
          color: "#1a1a1a",
          textAlign: "center",
          boxSizing: "border-box",
        }}
      >
        {nomorHewan}
      </div>

      {/* Nama shohibul */}
      <div
        style={{
          width: "100%",
          minHeight: "50px",
          border: "1px solid #999",
          borderTop: "none",
          backgroundColor: "#f3f3f3",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          fontSize: "18px",
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

      {/* Penyembelih — hanya tampil jika sudah dipilih */}
      {labelPenyembelih && (
        <div
          style={{
            width: "100%",
            minHeight: "32px",
            border: "1px solid #999",
            borderTop: "none",
            backgroundColor:
              penyembelih === "sendiri" ? "#fff8e1" : "#e8f5e9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "sans-serif",
            fontSize: "13px",
            fontWeight: "bold",
            color: penyembelih === "sendiri" ? "#7c5c00" : "#2e6b2e",
            textAlign: "center",
            boxSizing: "border-box",
            padding: "0 6px",
          }}
        >
          {labelPenyembelih}
        </div>
      )}
    </div>
  );
}

export default function CetakLabelDuaPage() {
  // penyembelihMap: { [shohibulId]: "panitia" | "sendiri" }
  const [penyembelihMap, setPenyembelihMap] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

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

  const kambingList: ShohibulKambing[] = (data ?? [])
    .filter((s) => (s.hewan_qurban as any)?.jenis_hewan === "kambing")
    .map((s) => ({
      id: s.id,
      nama: s.nama,
      nomorHewan: (s.hewan_qurban as any)?.nomor_urut ?? "-",
      penyembelih: penyembelihMap[s.id],
    }));

  // Bagi menjadi 2 kolom
  const kiriList = kambingList.filter((_, i) => i % 2 === 0);
  const kananList = kambingList.filter((_, i) => i % 2 === 1);

  const handlePenyembelihChange = (id: string, value: string) => {
    setPenyembelihMap((prev) => ({ ...prev, [id]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    // Simpan ke localStorage supaya tidak hilang saat refresh
    localStorage.setItem("penyembelih-kambing", JSON.stringify(penyembelihMap));
    setSaved(true);
  };

  // Load dari localStorage saat pertama kali
  useState(() => {
    const saved = localStorage.getItem("penyembelih-kambing");
    if (saved) {
      try {
        setPenyembelihMap(JSON.parse(saved));
      } catch {}
    }
  });

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

      <div className="p-6 space-y-6 max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 no-print">
          <div>
            <h1 className="text-2xl font-bold">Cetak Nama Shohibul Qurban Kambing</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Masjid At-Tauhid Pangkalpinang 1447H — 2 kolom
            </p>
          </div>
          {!isLoading && (
            <Badge variant="outline" className="text-amber-700 border-amber-400 bg-amber-50">
              🐐 {kambingList.length} kambing
            </Badge>
          )}
        </div>

        {/* Panel Penyembelih — setting per shohibul */}
        {!isLoading && !isError && kambingList.length > 0 && (
          <div className="no-print border rounded-xl p-4 space-y-3 bg-card shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base">Pilih Penyembelih per Shohibul</h2>
              <Button
                size="sm"
                variant={saved ? "outline" : "default"}
                onClick={handleSave}
                className="gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                {saved ? "Tersimpan ✓" : "Simpan Pilihan"}
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
              {kambingList.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 border rounded-lg p-2 bg-background"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground font-medium truncate">
                      {s.nomorHewan}
                    </div>
                    <div className="text-sm font-medium truncate">{s.nama}</div>
                  </div>
                  <select
                    value={penyembelihMap[s.id] ?? ""}
                    onChange={(e) => handlePenyembelihChange(s.id, e.target.value)}
                    className="text-xs border rounded px-2 py-1 bg-background text-foreground min-w-[180px]"
                  >
                    <option value="">— Pilih penyembelih —</option>
                    {PENYEMBELIH_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Klik <strong>Simpan Pilihan</strong> agar pilihan tidak hilang saat refresh.
              Pilihan akan tampil di label cetakan.
            </p>
          </div>
        )}

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
                  nomorHewan={s.nomorHewan}
                  nama={s.nama}
                  penyembelih={penyembelihMap[s.id]}
                />
              ))}
            </div>

            {/* Garis pemisah (tidak cetak) */}
            <div
              className="no-print"
              style={{ width: "1px", backgroundColor: "#e5e7eb", alignSelf: "stretch" }}
            />

            {/* Kolom Kanan */}
            <div className="label-kolom" style={{ flex: 1 }}>
              {kananList.map((s) => (
                <LabelKambing
                  key={s.id}
                  nomorHewan={s.nomorHewan}
                  nama={s.nama}
                  penyembelih={penyembelihMap[s.id]}
                />
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  );
}
