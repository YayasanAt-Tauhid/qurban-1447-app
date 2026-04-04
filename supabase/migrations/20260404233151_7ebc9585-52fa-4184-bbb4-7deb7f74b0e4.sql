
-- Create enums
CREATE TYPE public.jenis_hewan AS ENUM ('sapi', 'kambing');
CREATE TYPE public.tipe_kepemilikan AS ENUM ('kolektif', 'individu');
CREATE TYPE public.jenis_kelamin_hewan AS ENUM ('jantan', 'betina');
CREATE TYPE public.status_hewan AS ENUM ('survei', 'booking', 'lunas');
CREATE TYPE public.status_penyembelihan AS ENUM ('sendiri', 'diwakilkan');
CREATE TYPE public.status_checklist AS ENUM ('selesai', 'pending', 'tindak_lanjut');
CREATE TYPE public.sumber_pendaftaran AS ENUM ('online', 'manual');
CREATE TYPE public.bagian_hewan AS ENUM ('jeroan', 'kepala', 'kulit', 'ekor', 'kaki', 'tulang');
CREATE TYPE public.jenis_kas AS ENUM ('masuk', 'keluar');
CREATE TYPE public.metode_kas AS ENUM ('tunai', 'bank');
CREATE TYPE public.kategori_mustahiq AS ENUM ('dhuafa', 'warga', 'jamaah', 'shohibul_qurban', 'bagian_tidak_direquest', 'lainnya');
CREATE TYPE public.status_kupon AS ENUM ('belum_ambil', 'sudah_ambil');
CREATE TYPE public.divisi_panitia AS ENUM ('ketua', 'sekretaris', 'bendahara', 'koord_sapi', 'koord_kambing', 'penyembelih_sapi', 'penyembelih_kambing', 'distribusi', 'konsumsi', 'syariat', 'area_sapi', 'area_kambing', 'lainnya');
CREATE TYPE public.ukuran_seragam AS ENUM ('S', 'M', 'L', 'XL', 'XXL');
CREATE TYPE public.role_panitia AS ENUM ('super_admin', 'admin_pendaftaran', 'admin_keuangan', 'admin_kupon', 'admin_hewan', 'panitia', 'viewer');

-- Table: hewan_qurban
CREATE TABLE public.hewan_qurban (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tahun INT NOT NULL DEFAULT 1447,
  nomor_urut TEXT NOT NULL,
  jenis_hewan public.jenis_hewan NOT NULL,
  tipe_kepemilikan public.tipe_kepemilikan NOT NULL,
  jenis_kelamin public.jenis_kelamin_hewan NOT NULL DEFAULT 'jantan',
  ras TEXT,
  nama_penjual TEXT,
  hp_penjual TEXT,
  alamat_penjual TEXT,
  harga BIGINT NOT NULL DEFAULT 0,
  estimasi_bobot INT,
  iuran_per_orang BIGINT NOT NULL DEFAULT 0,
  kuota INT NOT NULL DEFAULT 1,
  uang_muka BIGINT DEFAULT 0,
  status public.status_hewan NOT NULL DEFAULT 'survei',
  tanggal_booking DATE,
  nama_petugas_booking TEXT,
  catatan TEXT,
  foto_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hewan_qurban ENABLE ROW LEVEL SECURITY;

-- Table: panitia (contains roles - separate from auth.users)
CREATE TABLE public.panitia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tahun INT NOT NULL DEFAULT 1447,
  nama TEXT NOT NULL,
  jabatan TEXT,
  divisi public.divisi_panitia NOT NULL DEFAULT 'lainnya',
  no_hp TEXT,
  ukuran_seragam public.ukuran_seragam,
  foto_url TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role public.role_panitia NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.panitia ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.role_panitia
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.panitia WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.panitia
    WHERE user_id = _user_id
    AND role IN ('super_admin', 'admin_pendaftaran', 'admin_keuangan', 'admin_kupon', 'admin_hewan')
  )
$$;

-- Table: shohibul_qurban
CREATE TABLE public.shohibul_qurban (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tahun INT NOT NULL DEFAULT 1447,
  nama TEXT NOT NULL,
  alamat TEXT,
  no_wa TEXT,
  hewan_id UUID REFERENCES public.hewan_qurban(id) ON DELETE SET NULL,
  tipe_kepemilikan public.tipe_kepemilikan NOT NULL DEFAULT 'kolektif',
  status_penyembelihan public.status_penyembelihan DEFAULT 'diwakilkan',
  akad_dilakukan BOOLEAN DEFAULT FALSE,
  akad_timestamp TIMESTAMPTZ,
  akad_diwakilkan BOOLEAN DEFAULT FALSE,
  nama_wakil_akad TEXT,
  status_checklist_panitia public.status_checklist DEFAULT 'pending',
  sumber_pendaftaran public.sumber_pendaftaran DEFAULT 'manual',
  panitia_pendaftar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shohibul_qurban ENABLE ROW LEVEL SECURITY;

-- Table: request_bagian
CREATE TABLE public.request_bagian (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shohibul_qurban_id UUID NOT NULL REFERENCES public.shohibul_qurban(id) ON DELETE CASCADE,
  hewan_id UUID NOT NULL REFERENCES public.hewan_qurban(id) ON DELETE CASCADE,
  bagian public.bagian_hewan NOT NULL,
  catatan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.request_bagian ENABLE ROW LEVEL SECURITY;

-- Table: kas
CREATE TABLE public.kas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tahun INT NOT NULL DEFAULT 1447,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  jenis public.jenis_kas NOT NULL,
  metode public.metode_kas NOT NULL DEFAULT 'tunai',
  kategori TEXT,
  keterangan TEXT,
  jumlah BIGINT NOT NULL DEFAULT 0,
  bukti_url TEXT,
  dibuat_oleh UUID REFERENCES public.panitia(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kas ENABLE ROW LEVEL SECURITY;

-- Table: mustahiq
CREATE TABLE public.mustahiq (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tahun INT NOT NULL DEFAULT 1447,
  nomor_kupon TEXT UNIQUE,
  nama TEXT NOT NULL,
  kategori public.kategori_mustahiq NOT NULL DEFAULT 'warga',
  nama_penyalur TEXT,
  status_kupon public.status_kupon NOT NULL DEFAULT 'belum_ambil',
  qr_data TEXT,
  keterangan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mustahiq ENABLE ROW LEVEL SECURITY;

-- View: distribusi_bagian
CREATE OR REPLACE VIEW public.distribusi_bagian AS
SELECT
  rb.hewan_id,
  rb.bagian,
  COUNT(rb.id) AS jumlah_request,
  ARRAY_AGG(sq.nama) AS list_nama_shohibul,
  CASE
    WHEN COUNT(rb.id) = 0 THEN 'ke_mustahiq'
    ELSE 'ke_shohibul'
  END AS status
FROM public.request_bagian rb
JOIN public.shohibul_qurban sq ON sq.id = rb.shohibul_qurban_id
GROUP BY rb.hewan_id, rb.bagian;

-- Computed sisa_kuota view
CREATE OR REPLACE VIEW public.hewan_dengan_kuota AS
SELECT
  h.*,
  h.kuota - COALESCE(cnt.total, 0) AS sisa_kuota
FROM public.hewan_qurban h
LEFT JOIN (
  SELECT hewan_id, COUNT(*) AS total
  FROM public.shohibul_qurban
  GROUP BY hewan_id
) cnt ON cnt.hewan_id = h.id;

-- RLS Policies

-- hewan_qurban: authenticated can read, admins can write
CREATE POLICY "Authenticated users can view hewan" ON public.hewan_qurban
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert hewan" ON public.hewan_qurban
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update hewan" ON public.hewan_qurban
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete hewan" ON public.hewan_qurban
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- shohibul_qurban
CREATE POLICY "Authenticated can view shohibul" ON public.shohibul_qurban
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert shohibul" ON public.shohibul_qurban
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update shohibul" ON public.shohibul_qurban
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete shohibul" ON public.shohibul_qurban
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- request_bagian
CREATE POLICY "Authenticated can view request_bagian" ON public.request_bagian
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert request_bagian" ON public.request_bagian
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update request_bagian" ON public.request_bagian
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete request_bagian" ON public.request_bagian
  FOR DELETE TO authenticated USING (true);

-- panitia
CREATE POLICY "Authenticated can view panitia" ON public.panitia
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin can insert panitia" ON public.panitia
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Super admin can update panitia" ON public.panitia
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Super admin can delete panitia" ON public.panitia
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- kas
CREATE POLICY "Authenticated can view kas" ON public.kas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert kas" ON public.kas
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update kas" ON public.kas
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete kas" ON public.kas
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- mustahiq
CREATE POLICY "Authenticated can view mustahiq" ON public.mustahiq
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert mustahiq" ON public.mustahiq
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update mustahiq" ON public.mustahiq
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete mustahiq" ON public.mustahiq
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Storage bucket for hewan photos and bukti kas
INSERT INTO storage.buckets (id, name, public) VALUES ('qurban-files', 'qurban-files', true);

CREATE POLICY "Authenticated can upload files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'qurban-files');
CREATE POLICY "Anyone can view files" ON storage.objects
  FOR SELECT USING (bucket_id = 'qurban-files');
CREATE POLICY "Admins can delete files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'qurban-files' AND public.is_admin(auth.uid()));
