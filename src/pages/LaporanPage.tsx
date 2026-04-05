import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, Beef, Wallet, Ticket } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { formatRupiah, formatTanggal } from "@/lib/qurban-utils";

const addHeader = (doc: jsPDF) => {
  doc.setFontSize(14);
  doc.text("Masjid At-Tauhid Pangkalpinang", 105, 15, { align: "center" });
  doc.setFontSize(10);
  doc.text("Qurban 1447H", 105, 22, { align: "center" });
  doc.setFontSize(8);
  doc.text(`Tanggal cetak: ${formatTanggal(new Date())}`, 105, 28, { align: "center" });
  doc.line(14, 32, 196, 32);
};

const exportShohibul = async () => {
  const { data } = await supabase.from("shohibul_qurban").select("*, hewan_qurban(nomor_urut, jenis_hewan)").order("created_at");
  if (!data) return toast.error("Gagal mengambil data");
  const doc = new jsPDF();
  addHeader(doc);
  doc.setFontSize(12);
  doc.text("Rekap Shohibul Qurban", 14, 40);

  let y = 50;
  doc.setFontSize(8);
  doc.text("No", 14, y); doc.text("Nama", 24, y); doc.text("Hewan", 90, y); doc.text("Tipe", 120, y); doc.text("Akad", 150, y); doc.text("Status", 170, y);
  y += 6;
  data.forEach((s, i) => {
    if (y > 275) { doc.addPage(); addHeader(doc); y = 40; }
    doc.text(String(i + 1), 14, y);
    doc.text(s.nama, 24, y);
    doc.text((s.hewan_qurban as any)?.nomor_urut ?? "-", 90, y);
    doc.text(s.tipe_kepemilikan, 120, y);
    doc.text(s.akad_dilakukan ? "Sudah" : "Belum", 150, y);
    doc.text(s.status_checklist_panitia ?? "-", 170, y);
    y += 5;
  });
  doc.save("rekap-shohibul-1447H.pdf");
  toast.success("PDF Shohibul berhasil diunduh");
};

const exportRequestBagian = async () => {
  const { data: hewan } = await supabase.from("hewan_qurban").select("*").order("nomor_urut");
  const { data: requests } = await supabase.from("request_bagian").select("*, shohibul_qurban(nama)");
  if (!hewan || !requests) return toast.error("Gagal mengambil data");
  const doc = new jsPDF();
  addHeader(doc);
  doc.setFontSize(12);
  doc.text("Rekap Request Bagian Hewan", 14, 40);

  let y = 50;
  hewan.forEach((h) => {
    if (y > 260) { doc.addPage(); addHeader(doc); y = 40; }
    doc.setFontSize(10);
    doc.text(`${h.nomor_urut} (${h.jenis_hewan})`, 14, y);
    y += 6;
    const bagianList = ["jeroan", "kepala", "kulit", "ekor", "kaki", "tulang"];
    bagianList.forEach((b) => {
      const reqs = requests.filter((r) => r.hewan_id === h.id && r.bagian === b);
      const names = reqs.length > 0 ? reqs.map((r) => (r as any).shohibul_qurban?.nama).join(", ") : "→ Mustahiq";
      doc.setFontSize(8);
      doc.text(`  ${b}: ${names}`, 20, y);
      y += 4;
    });
    y += 4;
  });
  doc.save("rekap-request-bagian-1447H.pdf");
  toast.success("PDF Request Bagian berhasil diunduh");
};

const exportKeuangan = async () => {
  const { data } = await supabase.from("kas").select("*").order("tanggal");
  if (!data) return toast.error("Gagal mengambil data");
  const doc = new jsPDF();
  addHeader(doc);
  doc.setFontSize(12);
  doc.text("Laporan Keuangan Qurban 1447H", 14, 40);

  const masuk = data.filter((k) => k.jenis === "masuk").reduce((a, k) => a + Number(k.jumlah), 0);
  const keluar = data.filter((k) => k.jenis === "keluar").reduce((a, k) => a + Number(k.jumlah), 0);

  doc.setFontSize(10);
  doc.text(`Total Pemasukan: ${formatRupiah(masuk)}`, 14, 50);
  doc.text(`Total Pengeluaran: ${formatRupiah(keluar)}`, 14, 56);
  doc.text(`Saldo: ${formatRupiah(masuk - keluar)}`, 14, 62);

  let y = 74;
  doc.setFontSize(8);
  doc.text("Tgl", 14, y); doc.text("Jenis", 40, y); doc.text("Jumlah", 60, y); doc.text("Kategori", 100, y); doc.text("Keterangan", 130, y);
  y += 6;
  data.forEach((k) => {
    if (y > 275) { doc.addPage(); addHeader(doc); y = 40; }
    doc.text(k.tanggal, 14, y);
    doc.text(k.jenis, 40, y);
    doc.text(formatRupiah(Number(k.jumlah)), 60, y);
    doc.text(k.kategori ?? "-", 100, y);
    doc.text((k.keterangan ?? "-").substring(0, 30), 130, y);
    y += 5;
  });
  doc.save("laporan-keuangan-1447H.pdf");
  toast.success("PDF Keuangan berhasil diunduh");
};

const exportMustahiq = async () => {
  const { data } = await supabase.from("mustahiq").select("*").order("created_at");
  if (!data) return toast.error("Gagal mengambil data");
  const doc = new jsPDF();
  addHeader(doc);
  doc.setFontSize(12);
  doc.text("Daftar Mustahiq Qurban 1447H", 14, 40);

  let y = 50;
  doc.setFontSize(8);
  doc.text("No", 14, y); doc.text("Kupon", 24, y); doc.text("Nama", 65, y); doc.text("Kategori", 120, y); doc.text("Status", 160, y);
  y += 6;
  data.forEach((m, i) => {
    if (y > 275) { doc.addPage(); addHeader(doc); y = 40; }
    doc.text(String(i + 1), 14, y);
    doc.text(m.nomor_kupon ?? "-", 24, y);
    doc.text(m.nama, 65, y);
    doc.text(m.kategori, 120, y);
    doc.text(m.status_kupon === "sudah_ambil" ? "Sudah" : "Belum", 160, y);
    y += 5;
  });
  doc.save("daftar-mustahiq-1447H.pdf");
  toast.success("PDF Mustahiq berhasil diunduh");
};

const reports = [
  { title: "Rekap Shohibul Qurban", desc: "Semua shohibul + status akad + status bayar", icon: Users, action: exportShohibul },
  { title: "Rekap Request Bagian", desc: "Per hewan, list bagian + siapa yang request", icon: Beef, action: exportRequestBagian },
  { title: "Laporan Keuangan", desc: "Summary pemasukan/pengeluaran + rincian kas", icon: Wallet, action: exportKeuangan },
  { title: "Daftar Mustahiq", desc: "Semua mustahiq + status kupon", icon: Ticket, action: exportMustahiq },
];

const LaporanPage = () => {
  const copyPublicLink = () => {
    const url = `${window.location.origin}/publik/laporan`;
    navigator.clipboard.writeText(url);
    toast.success("Link publik disalin!");
  };

  return (
  <div className="space-y-6">
    <div className="page-header">
      <h1 className="page-title">Laporan</h1>
      <p className="page-subtitle">Export laporan PDF untuk kebutuhan panitia</p>
    </div>

    {/* Public link card */}
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Laporan keuangan juga tersedia untuk publik</p>
          <p className="text-xs text-muted-foreground">Bisa diakses tanpa login</p>
        </div>
        <div className="flex gap-2">
          <a href="/publik/laporan" target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline">Lihat versi publik</Button>
          </a>
          <Button size="sm" variant="ghost" onClick={copyPublicLink}>Salin tautan</Button>
        </div>
      </CardContent>
    </Card>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {reports.map((r) => (
        <Card key={r.title} className="hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <r.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="font-semibold">{r.title}</h3>
              <p className="text-sm text-muted-foreground">{r.desc}</p>
              <Button size="sm" onClick={r.action}>
                <FileText className="mr-2 h-4 w-4" /> Export PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
  );
};

export default LaporanPage;
