-- ============================================================
-- MIGRATION: Sistem Pembagian Bagian Sapi (Pilih → Sengketa → Undian)
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. Perluas enum bagian_hewan dengan bagian detail dari form fisik
ALTER TYPE bagian_hewan ADD VALUE IF NOT EXISTS 'tulang_kaki_1';
ALTER TYPE bagian_hewan ADD VALUE IF NOT EXISTS 'tulang_kaki_2';
ALTER TYPE bagian_hewan ADD VALUE IF NOT EXISTS 'tulang_kaki_3';
ALTER TYPE bagian_hewan ADD VALUE IF NOT EXISTS 'tulang_kaki_4';
ALTER TYPE bagian_hewan ADD VALUE IF NOT EXISTS 'ginjal';
ALTER TYPE bagian_hewan ADD VALUE IF NOT EXISTS 'jantung';
ALTER TYPE bagian_hewan ADD VALUE IF NOT EXISTS 'paru_1';
ALTER TYPE bagian_hewan ADD VALUE IF NOT EXISTS 'paru_2';
ALTER TYPE bagian_hewan ADD VALUE IF NOT EXISTS 'babat_1';
ALTER TYPE bagian_hewan ADD VALUE IF NOT EXISTS 'babat_2';
ALTER TYPE bagian_hewan ADD VALUE IF NOT EXISTS 'babat_3';
ALTER TYPE bagian_hewan ADD VALUE IF NOT EXISTS 'usus_1';
ALTER TYPE bagian_hewan ADD VALUE IF NOT EXISTS 'usus_2';
ALTER TYPE bagian_hewan ADD VALUE IF NOT EXISTS 'lemak_1';
ALTER TYPE bagian_hewan ADD VALUE IF NOT EXISTS 'lemak_2';
ALTER TYPE bagian_hewan ADD VALUE IF NOT EXISTS 'lemak_3';
ALTER TYPE bagian_hewan ADD VALUE IF NOT EXISTS 'hati';
ALTER TYPE bagian_hewan ADD VALUE IF NOT EXISTS 'daging_pipi_1';
ALTER TYPE bagian_hewan ADD VALUE IF NOT EXISTS 'daging_pipi_2';
ALTER TYPE bagian_hewan ADD VALUE IF NOT EXISTS 'limpa';
ALTER TYPE bagian_hewan ADD VALUE IF NOT EXISTS 'lidah';
ALTER TYPE bagian_hewan ADD VALUE IF NOT EXISTS 'kulit_1';
ALTER TYPE bagian_hewan ADD VALUE IF NOT EXISTS 'kulit_2';
ALTER TYPE bagian_hewan ADD VALUE IF NOT EXISTS 'kulit_3';
ALTER TYPE bagian_hewan ADD VALUE IF NOT EXISTS 'rangka_kepala';

-- 2. Tambah enum status_pilih_bagian
CREATE TYPE status_pilih_bagian AS ENUM (
  'aman',       -- hanya 1 orang memilih → langsung dapat
  'sengketa',   -- 2+ orang memilih → perlu musyawarah
  'undian',     -- musyawarah gagal → diundi
  'selesai',    -- sudah ada pemenang (mengalah / undian)
  'kosong'      -- tidak ada yang memilih → ke mustahiq
);

-- 3. Tabel utama: pilihan bagian per shohibul (kolektif)
-- Menggantikan/melengkapi request_bagian untuk sapi kolektif
CREATE TABLE IF NOT EXISTS pilihan_bagian (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hewan_id      uuid NOT NULL REFERENCES hewan_qurban(id) ON DELETE CASCADE,
  shohibul_id   uuid NOT NULL REFERENCES shohibul_qurban(id) ON DELETE CASCADE,
  bagian        bagian_hewan NOT NULL,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (hewan_id, shohibul_id, bagian)
);

-- 4. Tabel status per bagian per hewan
CREATE TABLE IF NOT EXISTS status_bagian (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hewan_id        uuid NOT NULL REFERENCES hewan_qurban(id) ON DELETE CASCADE,
  bagian          bagian_hewan NOT NULL,
  status          status_pilih_bagian DEFAULT 'kosong',
  pemenang_id     uuid REFERENCES shohibul_qurban(id),  -- siapa yang dapat
  catatan_panitia text,
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (hewan_id, bagian)
);

-- 5. Tabel log undian (audit trail — tidak bisa dimanipulasi)
CREATE TABLE IF NOT EXISTS log_undian (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hewan_id      uuid NOT NULL REFERENCES hewan_qurban(id) ON DELETE CASCADE,
  bagian        bagian_hewan NOT NULL,
  peserta       uuid[] NOT NULL,           -- array shohibul_id yang ikut undian
  pemenang_id   uuid NOT NULL REFERENCES shohibul_qurban(id),
  seed          text NOT NULL,             -- seed acak untuk verifikasi transparansi
  dilakukan_oleh uuid REFERENCES shohibul_qurban(id), -- panitia/shohibul yang trigger
  created_at    timestamptz DEFAULT now()
);

-- 6. Enable Realtime untuk tabel yang perlu disaksikan bersama
ALTER PUBLICATION supabase_realtime ADD TABLE pilihan_bagian;
ALTER PUBLICATION supabase_realtime ADD TABLE status_bagian;
ALTER PUBLICATION supabase_realtime ADD TABLE log_undian;

-- 7. RLS (Row Level Security) — aktifkan agar aman
ALTER TABLE pilihan_bagian ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_bagian  ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_undian     ENABLE ROW LEVEL SECURITY;

-- Semua authenticated user bisa baca (untuk real-time saksikan bersama)
CREATE POLICY "pilihan_bagian_read"  ON pilihan_bagian FOR SELECT TO authenticated USING (true);
CREATE POLICY "status_bagian_read"   ON status_bagian  FOR SELECT TO authenticated USING (true);
CREATE POLICY "log_undian_read"      ON log_undian     FOR SELECT TO authenticated USING (true);

-- Hanya authenticated yang bisa insert/update
CREATE POLICY "pilihan_bagian_write" ON pilihan_bagian FOR ALL TO authenticated USING (true);
CREATE POLICY "status_bagian_write"  ON status_bagian  FOR ALL TO authenticated USING (true);
CREATE POLICY "log_undian_write"     ON log_undian     FOR ALL TO authenticated USING (true);