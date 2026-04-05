export function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export function formatTanggal(date: string | Date): string {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ─── Sumber hewan ────────────────────────────────────────────────────────────
export type SumberHewan = "beli_panitia" | "bawa_sendiri";

export const SUMBER_HEWAN_LABEL: Record<SumberHewan, string> = {
  beli_panitia: "Beli lewat panitia",
  bawa_sendiri: "Bawa sendiri",
};

// ─── Biaya operasional flat per jenis hewan ──────────────────────────────────
// Berlaku untuk SEMUA individu (baik beli_panitia maupun bawa_sendiri)
export const BIAYA_OPERASIONAL: Record<string, number> = {
  sapi_individu:     1_000_000,
  kambing_individu:    100_000,
  sapi_kolektif:             0, // sudah termasuk dalam pembagian /7
};

export function getBiayaOperasional(
  jenisHewan: "sapi" | "kambing",
  tipeKepemilikan: "kolektif" | "individu"
): number {
  const key = `${jenisHewan}_${tipeKepemilikan}`;
  return BIAYA_OPERASIONAL[key] ?? 0;
}

// ─── Hitung iuran / total yang dibayar ke panitia ────────────────────────────
//
//  Sapi kolektif    → harga ÷ 7 (dibulatkan ke ribuan)
//  Sapi individu    → beli_panitia : harga + 1.000.000
//                     bawa_sendiri : 1.000.000 saja (harga = 0)
//  Kambing individu → beli_panitia : harga + 100.000
//                     bawa_sendiri : 100.000 saja   (harga = 0)
//
export function hitungIuranPerOrang(harga: number): number {
  // Tetap ada untuk kompatibilitas kolektif
  return Math.ceil(harga / 7 / 1000) * 1000;
}

export function hitungTotalPerOrang(
  harga: number,
  jenisHewan: "sapi" | "kambing",
  tipeKepemilikan: "kolektif" | "individu",
  sumberHewan: SumberHewan = "beli_panitia"
): number {
  if (tipeKepemilikan === "kolektif") {
    return hitungIuranPerOrang(harga);
  }
  const operasional = getBiayaOperasional(jenisHewan, tipeKepemilikan);
  if (sumberHewan === "bawa_sendiri") return operasional;
  return harga + operasional;
}

export function generateNomorKupon(index: number): string {
  return `QRB-1447-${String(index).padStart(4, "0")}`;
}
