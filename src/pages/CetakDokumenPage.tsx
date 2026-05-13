import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, FileText } from "lucide-react";

/* ─────────────────────────────────────────
   Helper
───────────────────────────────────────── */
function formatHP(hp: string | null) {
  if (!hp) return "-";
  return hp;
}

function labelBagian(bagian: string): string {
  return bagian
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ─────────────────────────────────────────
   Komponen dokumen yang bisa dicetak
───────────────────────────────────────── */
interface DokumenProps {
  hewan: any;
  shohibulList: any[];
  /** request_bagian rows (kolektif) – field: shohibul_qurban_id */
  requestList: any[];
  /** pilihan_bagian rows (individu) – field: shohibul_id */
  pilihanList: any[];
}

const DokumenHewanPrint = ({ hewan, shohibulList, requestList, pilihanList }: DokumenProps) => {
  const isSapi = hewan.jenis_hewan === "sapi";
  const isKolektif = hewan.tipe_kepemilikan === "kolektif";
  // Tampilkan kolom Request Khusus untuk semua sapi (baik individu maupun kolektif)
  const showRequestKhusus = isSapi;

  // Gabungkan data shohibul + request khusus mereka
  const rows = shohibulList.map((s) => {
    let requestKhusus = "";
    if (isKolektif) {
      // kolektif → request_bagian (field: shohibul_qurban_id)
      const req = requestList.filter((r) => r.shohibul_qurban_id === s.id);
      requestKhusus = req.map((r) => labelBagian(r.bagian)).join(", ");
    } else {
      // individu → pilihan_bagian (field: shohibul_id)
      const pil = pilihanList.filter((p) => p.shohibul_id === s.id);
      requestKhusus = pil.map((p) => labelBagian(p.bagian)).join(", ");
    }
    return {
      id: s.id,
      noWa: s.no_wa,
      nama: s.nama,
      requestKhusus,
      keterangan: s.catatan_pendaftaran,
    };
  });

  return (
    <div
      id="dokumen-cetak"
      style={{
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        color: "#000",
        padding: "20px 24px",
        maxWidth: "740px",
        margin: "0 auto",
        background: "#fff",
      }}
    >
      {/* ── Header ── */}
      <div style={{ textAlign: "center", marginBottom: "8px" }}>
        <div style={{ fontSize: "13px", fontWeight: "bold" }}>
          Masjid At-Tauhid Pangkalpinang — Qurban 1447H
        </div>
        <div style={{ fontSize: "16px", fontWeight: "bold", marginTop: "2px" }}>
          Dokumen Hewan Qurban
        </div>
        <div style={{ fontSize: "14px", fontWeight: "bold", color: "#1a4a7a" }}>
          {hewan.jenis_hewan.charAt(0).toUpperCase() + hewan.jenis_hewan.slice(1)}{" "}
          {hewan.nomor_urut}
        </div>
      </div>

      <hr style={{ margin: "6px 0 10px" }} />

      {/* ── Pengantaran ── */}
      {/* <div style={{ marginBottom: "6px" }}>
        <span style={{ fontWeight: "bold" }}>Pengantaran : </span>
        Telah di antar pada hari ................. tanggal .........................
        jam ........ dalam kondisi ..................
        <div style={{ marginTop: "4px", marginLeft: "16px", fontSize: "10px", color: "#555" }}>
          Tanda Tangan Penerima : ___________________________
        </div>
      </div> */}

      {/* ── Penyembelihan ── */}
      <div style={{ marginBottom: "6px" }}>
        <span style={{ fontWeight: "bold" }}>Penyembelihan : </span>
        Telah di sembelih pada hari ................. tanggal .........................
        jam ........ dengan baik dan sesuai syariat.
        <div style={{ marginTop: "4px", marginLeft: "16px", fontSize: "10px", color: "#555" }}>
          Nama Penyembelih : ___________________________
        </div>
      </div>

      {/* ── Penimbangan (Sapi) ── */}
      {isSapi && (
        <div style={{ marginBottom: "8px" }}>
          <span style={{ fontWeight: "bold" }}>Penimbangan : </span>
          Berat Daging ............ kg &nbsp;&nbsp;|&nbsp;&nbsp;
          Bagian Shohibul Qurban ............. kg (1/2 daging tertimbang*)
          <br />
          <span style={{ marginLeft: "16px", fontSize: "10px", color: "#555" }}>
            * pastikan daging terbaik untuk shohibul qurban
          </span>
          {isKolektif && (
            <>
              <div style={{ marginTop: "4px", fontWeight: "bold" }}>
                Paket Standar setiap Shohibul Qurban (untuk kolektif):
              </div>
              <div style={{ marginLeft: "12px", lineHeight: "1.6" }}>
                1. 1/7 dari setengah daging tertimbang .......... kg
                <br />
                2. Tulang rusuk ± 1 kg 
                <br />
                3. 1/7 hati
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Bagian Kambing ── */}
      {!isSapi && (
        <div style={{ marginBottom: "8px" }}>
          <span style={{ fontWeight: "bold" }}>Bagian Shohibul Kurban :</span>
          <div style={{ marginLeft: "12px", lineHeight: "1.6" }}>
            1. Separuh badan (bagian kanan) — dimulai dari paha atas sampai paha bawah
            <br />
            2. Kepala
            <br />
            3. 4 tulang kaki
            <br />
            4. Jeroan merah (hati, jantung, paru, limpa dan lainnya)
            <br />
            5. Jeroan hijau (babat)
          </div>
        </div>
      )}

      {/* ── Tabel Shohibul Qurban ── */}
      <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
        Daftar Shohibul Qurban{showRequestKhusus ? " & Request Khusus" : ""}
      </div>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "10.5px",
          marginBottom: "10px",
        }}
      >
        <thead>
          <tr style={{ background: "#dbe9f7" }}>
            <th style={thStyle}>No</th>
            <th style={thStyle}>Nomor Handphone</th>
            <th style={{ ...thStyle, width: "28%" }}>Nama</th>
            {showRequestKhusus && <th style={thStyle}>Request Khusus</th>}
            <th style={thStyle}>Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={showRequestKhusus ? 5 : 4}
                style={{ textAlign: "center", padding: "8px", color: "#888" }}
              >
                Belum ada shohibul terdaftar
              </td>
            </tr>
          ) : (
            rows.map((r, idx) => (
              <tr key={r.id} style={{ background: idx % 2 === 0 ? "#fff" : "#f5faff" }}>
                <td style={tdCenter}>{idx + 1}</td>
                <td style={tdStyle}>{formatHP(r.noWa)}</td>
                <td style={tdStyle}>{r.nama}</td>
                {showRequestKhusus && <td style={tdStyle}>{r.requestKhusus || "-"}</td>}
                <td style={{ ...tdStyle, whiteSpace: "pre-wrap", wordWrap: "break-word" }}>
                  {r.keterangan ? (
                    r.keterangan.split("\n").map((line, idx) => (
                      <div key={idx}>{line}</div>
                    ))
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* ── Tabel Pembagian (Nama Shohibul + Paraf) ── */}
      <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
        Penyerahan Bagian / Pembagian — Nama Shohibul Kurban &amp; Paraf
      </div>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "10.5px",
          marginBottom: "12px",
        }}
      >
        <thead>
          <tr style={{ background: "#dbe9f7" }}>
            <th style={thStyle}>No</th>
            {!isSapi && <th style={thStyle}>Nomor Handphone</th>}
            <th style={{ ...thStyle, width: "40%" }}>Nama Shohibul Kurban</th>
            <th style={{ ...thStyle, width: "30%" }}>Paraf</th>
          </tr>
        </thead>
        <tbody>
          {shohibulList.length === 0 ? (
            <tr>
              <td
                colSpan={isSapi ? 3 : 4}
                style={{ textAlign: "center", padding: "8px", color: "#888" }}
              >
                Belum ada shohibul terdaftar
              </td>
            </tr>
          ) : (
            shohibulList.map((s, idx) => (
              <tr key={s.id} style={{ background: idx % 2 === 0 ? "#fff" : "#f5faff" }}>
                <td style={tdCenter}>{idx + 1}</td>
                {!isSapi && <td style={tdStyle}>{formatHP(s.no_wa)}</td>}
                <td style={tdStyle}>{s.nama}</td>
                <td style={{ ...tdStyle, minHeight: "24px" }}>&nbsp;</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* ── Footer tanda tangan ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "12px",
          fontSize: "10.5px",
        }}
      >
        <div style={ttdBox}>Tanda Tangan Petugas Pembagian</div>
        <div style={ttdBox}>Tanda Tangan Koordinator</div>
        <div style={ttdBox}>Tanda Tangan Asisten Koordinator</div>
      </div>

      <div style={{ marginTop: "16px", fontSize: "9px", color: "#888", textAlign: "right" }}>
        Dicetak: {new Date().toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   Inline styles
───────────────────────────────────────── */
const thStyle: React.CSSProperties = {
  border: "1px solid #aac6e8",
  padding: "5px 6px",
  textAlign: "left",
  fontWeight: "bold",
};
const tdStyle: React.CSSProperties = {
  border: "1px solid #c8dcef",
  padding: "4px 6px",
  verticalAlign: "top",
};
const tdCenter: React.CSSProperties = {
  ...tdStyle,
  textAlign: "center",
  width: "28px",
};
const ttdBox: React.CSSProperties = {
  border: "1px solid #aaa",
  borderRadius: "4px",
  padding: "8px 12px",
  width: "30%",
  minHeight: "60px",
  textAlign: "center",
  fontSize: "10px",
};

/* ─────────────────────────────────────────
   Halaman utama
───────────────────────────────────────── */
const CetakDokumenPage = () => {
  const [selectedHewanId, setSelectedHewanId] = useState<string>("");
  const printRef = useRef<HTMLDivElement>(null);

  /* Semua hewan */
  const { data: hewanList, isLoading: loadingHewan } = useQuery({
    queryKey: ["hewan-list-cetak-dokumen"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hewan_qurban")
        .select("id, nomor_urut, jenis_hewan, tipe_kepemilikan")
        .order("nomor_urut");
      if (error) throw error;
      return data;
    },
  });

  /* Detail hewan terpilih */
  const { data: hewan, isLoading: loadingDetail } = useQuery({
    queryKey: ["hewan-detail-cetak", selectedHewanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hewan_qurban")
        .select("*")
        .eq("id", selectedHewanId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedHewanId,
  });

  /* Shohibul untuk hewan terpilih */
  const { data: shohibulList = [], isLoading: loadingShohibul } = useQuery({
    queryKey: ["shohibul-cetak-dokumen", selectedHewanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shohibul_qurban")
        .select("id, nama, no_wa, catatan_pendaftaran")
        .eq("hewan_id", selectedHewanId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedHewanId,
  });

  /* Request khusus bagian (KOLEKTIF) — tabel request_bagian */
  const { data: requestList = [], isLoading: loadingRequest } = useQuery({
    queryKey: ["request-cetak-dokumen", selectedHewanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_bagian")
        .select("id, bagian, shohibul_qurban_id, catatan")
        .eq("hewan_id", selectedHewanId);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedHewanId,
  });

  /* Pilihan bagian (INDIVIDU) — tabel pilihan_bagian */
  const { data: pilihanList = [], isLoading: loadingPilihan } = useQuery({
    queryKey: ["pilihan-cetak-dokumen", selectedHewanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pilihan_bagian")
        .select("id, bagian, shohibul_id")
        .eq("hewan_id", selectedHewanId);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedHewanId,
  });

  const handlePrint = () => {
    const printContents = document.getElementById("dokumen-cetak")?.innerHTML;
    if (!printContents) return;

    const w = window.open("", "_blank");
    if (!w) return;

    w.document.write(`
      <html>
        <head>
          <title>Dokumen Hewan Qurban - ${hewan?.nomor_urut ?? ""}</title>
          <style>
            body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>${printContents}</body>
      </html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
      w.close();
    }, 400);
  };

  const isLoadingData = loadingDetail || loadingShohibul || loadingRequest || loadingPilihan;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          Cetak Dokumen Hewan Qurban
        </h1>
        <p className="page-subtitle">
          Pilih nomor hewan qurban untuk menampilkan dan mencetak dokumen
        </p>
      </div>

      {/* ── Selector hewan ── */}
      <div className="bg-card border rounded-xl p-5 space-y-4 max-w-lg shadow-sm">
        <div className="space-y-1.5">
          <Label htmlFor="pilih-hewan" className="font-semibold">
            Nomor Hewan Qurban
          </Label>
          {loadingHewan ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select value={selectedHewanId} onValueChange={setSelectedHewanId}>
              <SelectTrigger id="pilih-hewan">
                <SelectValue placeholder="— Pilih hewan —" />
              </SelectTrigger>
              <SelectContent>
                {hewanList?.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.nomor_urut} &middot;{" "}
                    <span className="capitalize">{h.jenis_hewan}</span> &middot;{" "}
                    <span className="capitalize text-muted-foreground">{h.tipe_kepemilikan}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {selectedHewanId && (
          <Button
            onClick={handlePrint}
            disabled={isLoadingData}
            className="w-full"
          >
            <Printer className="mr-2 h-4 w-4" />
            {isLoadingData ? "Memuat data..." : "Cetak Dokumen"}
          </Button>
        )}
      </div>

      {/* ── Preview Dokumen ── */}
      {selectedHewanId && (
        <div>
          {isLoadingData ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : hewan ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">
                  Preview dokumen &mdash;{" "}
                  <span className="font-medium text-foreground">
                    {hewan.nomor_urut}
                  </span>{" "}
                  &middot; {shohibulList.length} shohibul terdaftar
                </p>
                <Button size="sm" variant="outline" onClick={handlePrint}>
                  <Printer className="mr-1.5 h-3.5 w-3.5" /> Cetak
                </Button>
              </div>

              <div
                ref={printRef}
                className="border rounded-xl overflow-hidden shadow-sm bg-white"
                style={{ overflowX: "auto" }}
              >
                <DokumenHewanPrint
                  hewan={hewan}
                  shohibulList={shohibulList}
                  requestList={requestList}
                  pilihanList={pilihanList}
                />
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default CetakDokumenPage;
