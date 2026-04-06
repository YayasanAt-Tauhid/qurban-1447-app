


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."bagian_hewan" AS ENUM (
    'jeroan',
    'kepala',
    'kulit',
    'ekor',
    'kaki',
    'tulang',
    'tulang_kaki_1',
    'tulang_kaki_2',
    'tulang_kaki_3',
    'tulang_kaki_4',
    'ginjal',
    'jantung',
    'paru_1',
    'paru_2',
    'babat_1',
    'babat_2',
    'babat_3',
    'usus_1',
    'usus_2',
    'lemak_1',
    'lemak_2',
    'lemak_3',
    'hati',
    'daging_pipi_1',
    'daging_pipi_2',
    'limpa',
    'lidah',
    'kulit_1',
    'kulit_2',
    'kulit_3',
    'rangka_kepala'
);


ALTER TYPE "public"."bagian_hewan" OWNER TO "postgres";


CREATE TYPE "public"."divisi_panitia" AS ENUM (
    'ketua',
    'sekretaris',
    'bendahara',
    'koord_sapi',
    'koord_kambing',
    'penyembelih_sapi',
    'penyembelih_kambing',
    'distribusi',
    'konsumsi',
    'syariat',
    'area_sapi',
    'area_kambing',
    'lainnya'
);


ALTER TYPE "public"."divisi_panitia" OWNER TO "postgres";


CREATE TYPE "public"."jenis_hewan" AS ENUM (
    'sapi',
    'kambing'
);


ALTER TYPE "public"."jenis_hewan" OWNER TO "postgres";


CREATE TYPE "public"."jenis_kas" AS ENUM (
    'masuk',
    'keluar'
);


ALTER TYPE "public"."jenis_kas" OWNER TO "postgres";


CREATE TYPE "public"."jenis_kelamin_hewan" AS ENUM (
    'jantan',
    'betina'
);


ALTER TYPE "public"."jenis_kelamin_hewan" OWNER TO "postgres";


CREATE TYPE "public"."kategori_mustahiq" AS ENUM (
    'dhuafa',
    'warga',
    'jamaah',
    'shohibul_qurban',
    'bagian_tidak_direquest',
    'lainnya'
);


ALTER TYPE "public"."kategori_mustahiq" OWNER TO "postgres";


CREATE TYPE "public"."metode_kas" AS ENUM (
    'tunai',
    'bank'
);


ALTER TYPE "public"."metode_kas" OWNER TO "postgres";


CREATE TYPE "public"."role_panitia" AS ENUM (
    'super_admin',
    'admin_pendaftaran',
    'admin_keuangan',
    'admin_kupon',
    'admin_hewan',
    'panitia',
    'viewer'
);


ALTER TYPE "public"."role_panitia" OWNER TO "postgres";


CREATE TYPE "public"."status_checklist" AS ENUM (
    'selesai',
    'pending',
    'tindak_lanjut'
);


ALTER TYPE "public"."status_checklist" OWNER TO "postgres";


CREATE TYPE "public"."status_hewan" AS ENUM (
    'survei',
    'booking',
    'lunas'
);


ALTER TYPE "public"."status_hewan" OWNER TO "postgres";


CREATE TYPE "public"."status_kupon" AS ENUM (
    'belum_ambil',
    'sudah_ambil'
);


ALTER TYPE "public"."status_kupon" OWNER TO "postgres";


CREATE TYPE "public"."status_penyembelihan" AS ENUM (
    'sendiri',
    'diwakilkan'
);


ALTER TYPE "public"."status_penyembelihan" OWNER TO "postgres";


CREATE TYPE "public"."status_pilih_bagian" AS ENUM (
    'aman',
    'sengketa',
    'undian',
    'selesai',
    'kosong'
);


ALTER TYPE "public"."status_pilih_bagian" OWNER TO "postgres";


CREATE TYPE "public"."sumber_hewan" AS ENUM (
    'beli_panitia',
    'bawa_sendiri'
);


ALTER TYPE "public"."sumber_hewan" OWNER TO "postgres";


CREATE TYPE "public"."sumber_pendaftaran" AS ENUM (
    'online',
    'manual'
);


ALTER TYPE "public"."sumber_pendaftaran" OWNER TO "postgres";


CREATE TYPE "public"."tipe_kepemilikan" AS ENUM (
    'kolektif',
    'individu'
);


ALTER TYPE "public"."tipe_kepemilikan" OWNER TO "postgres";


CREATE TYPE "public"."ukuran_seragam" AS ENUM (
    'S',
    'M',
    'L',
    'XL',
    'XXL'
);


ALTER TYPE "public"."ukuran_seragam" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"("_user_id" "uuid") RETURNS "public"."role_panitia"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM public.panitia WHERE user_id = _user_id LIMIT 1
$$;


ALTER FUNCTION "public"."get_user_role"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.panitia
    WHERE user_id = _user_id
    AND role IN ('super_admin', 'admin_pendaftaran', 'admin_keuangan', 'admin_kupon', 'admin_hewan')
  )
$$;


ALTER FUNCTION "public"."is_admin"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restrict_anon_akad_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- If this is an authenticated user with admin role, allow all updates
  IF auth.role() = 'authenticated' THEN
    RETURN NEW;
  END IF;

  -- For anon users, only allow akad-related fields to change
  NEW.nama := OLD.nama;
  NEW.alamat := OLD.alamat;
  NEW.no_wa := OLD.no_wa;
  NEW.hewan_id := OLD.hewan_id;
  NEW.tipe_kepemilikan := OLD.tipe_kepemilikan;
  NEW.tahun := OLD.tahun;
  NEW.created_at := OLD.created_at;
  NEW.panitia_pendaftar := OLD.panitia_pendaftar;
  NEW.sumber_pendaftaran := OLD.sumber_pendaftaran;
  NEW.status_checklist_panitia := OLD.status_checklist_panitia;
  NEW.status_penyembelihan := OLD.status_penyembelihan;
  NEW.id := OLD.id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."restrict_anon_akad_update"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."catatan_lapangan" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hewan_id" "uuid",
    "catatan" "text" NOT NULL,
    "waktu" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."catatan_lapangan" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."request_bagian" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shohibul_qurban_id" "uuid" NOT NULL,
    "hewan_id" "uuid" NOT NULL,
    "bagian" "text" NOT NULL,
    "catatan" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."request_bagian" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."distribusi_bagian" AS
 SELECT "id",
    "shohibul_qurban_id",
    "hewan_id",
    "bagian",
    "catatan",
    "created_at"
   FROM "public"."request_bagian";


ALTER VIEW "public"."distribusi_bagian" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hewan_qurban" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tahun" integer DEFAULT 1447 NOT NULL,
    "nomor_urut" "text" NOT NULL,
    "jenis_hewan" "public"."jenis_hewan" NOT NULL,
    "tipe_kepemilikan" "public"."tipe_kepemilikan" NOT NULL,
    "jenis_kelamin" "public"."jenis_kelamin_hewan" DEFAULT 'jantan'::"public"."jenis_kelamin_hewan" NOT NULL,
    "ras" "text",
    "nama_penjual" "text",
    "hp_penjual" "text",
    "alamat_penjual" "text",
    "harga" bigint DEFAULT 0 NOT NULL,
    "estimasi_bobot" integer,
    "iuran_per_orang" bigint DEFAULT 0 NOT NULL,
    "kuota" integer DEFAULT 1 NOT NULL,
    "uang_muka" bigint DEFAULT 0,
    "status" "public"."status_hewan" DEFAULT 'survei'::"public"."status_hewan" NOT NULL,
    "tanggal_booking" "date",
    "nama_petugas_booking" "text",
    "catatan" "text",
    "foto_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sumber_hewan" "public"."sumber_hewan",
    "biaya_operasional" bigint DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."hewan_qurban" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shohibul_qurban" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tahun" integer DEFAULT 1447 NOT NULL,
    "nama" "text" NOT NULL,
    "alamat" "text",
    "no_wa" "text",
    "hewan_id" "uuid",
    "tipe_kepemilikan" "public"."tipe_kepemilikan" DEFAULT 'kolektif'::"public"."tipe_kepemilikan" NOT NULL,
    "status_penyembelihan" "public"."status_penyembelihan" DEFAULT 'diwakilkan'::"public"."status_penyembelihan",
    "akad_dilakukan" boolean DEFAULT false,
    "akad_timestamp" timestamp with time zone,
    "akad_diwakilkan" boolean DEFAULT false,
    "nama_wakil_akad" "text",
    "status_checklist_panitia" "public"."status_checklist" DEFAULT 'pending'::"public"."status_checklist",
    "sumber_pendaftaran" "public"."sumber_pendaftaran" DEFAULT 'manual'::"public"."sumber_pendaftaran",
    "panitia_pendaftar" "text",
    "catatan_pendaftaran" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."shohibul_qurban" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."hewan_dengan_kuota" WITH ("security_invoker"='true') AS
 SELECT "h"."id",
    "h"."tahun",
    "h"."nomor_urut",
    "h"."jenis_hewan",
    "h"."tipe_kepemilikan",
    "h"."jenis_kelamin",
    "h"."ras",
    "h"."nama_penjual",
    "h"."hp_penjual",
    "h"."alamat_penjual",
    "h"."harga",
    "h"."estimasi_bobot",
    "h"."iuran_per_orang",
    "h"."kuota",
    "h"."uang_muka",
    "h"."status",
    "h"."tanggal_booking",
    "h"."nama_petugas_booking",
    "h"."catatan",
    "h"."foto_url",
    "h"."created_at",
    ("h"."kuota" - COALESCE("cnt"."total", (0)::bigint)) AS "sisa_kuota"
   FROM ("public"."hewan_qurban" "h"
     LEFT JOIN ( SELECT "shohibul_qurban"."hewan_id",
            "count"(*) AS "total"
           FROM "public"."shohibul_qurban"
          GROUP BY "shohibul_qurban"."hewan_id") "cnt" ON (("cnt"."hewan_id" = "h"."id")));


ALTER VIEW "public"."hewan_dengan_kuota" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tahun" integer DEFAULT 1447 NOT NULL,
    "tanggal" "date" DEFAULT CURRENT_DATE NOT NULL,
    "jenis" "public"."jenis_kas" NOT NULL,
    "metode" "public"."metode_kas" DEFAULT 'tunai'::"public"."metode_kas" NOT NULL,
    "kategori" "text",
    "keterangan" "text",
    "jumlah" bigint DEFAULT 0 NOT NULL,
    "bukti_url" "text",
    "dibuat_oleh" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."kas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."log_undian" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hewan_id" "uuid" NOT NULL,
    "bagian" "public"."bagian_hewan" NOT NULL,
    "peserta" "uuid"[] NOT NULL,
    "pemenang_id" "uuid" NOT NULL,
    "seed" "text" NOT NULL,
    "dilakukan_oleh" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."log_undian" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mustahiq" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tahun" integer DEFAULT 1447 NOT NULL,
    "nomor_kupon" "text",
    "nama" "text" NOT NULL,
    "kategori" "public"."kategori_mustahiq" DEFAULT 'warga'::"public"."kategori_mustahiq" NOT NULL,
    "nama_penyalur" "text",
    "status_kupon" "public"."status_kupon" DEFAULT 'belum_ambil'::"public"."status_kupon" NOT NULL,
    "qr_data" "text",
    "keterangan" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mustahiq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."panitia" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tahun" integer DEFAULT 1447 NOT NULL,
    "nama" "text" NOT NULL,
    "jabatan" "text",
    "divisi" "public"."divisi_panitia" DEFAULT 'lainnya'::"public"."divisi_panitia" NOT NULL,
    "no_hp" "text",
    "ukuran_seragam" "public"."ukuran_seragam",
    "foto_url" "text",
    "user_id" "uuid",
    "role" "public"."role_panitia" DEFAULT 'viewer'::"public"."role_panitia" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."panitia" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pilihan_bagian" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hewan_id" "uuid" NOT NULL,
    "shohibul_id" "uuid" NOT NULL,
    "bagian" "public"."bagian_hewan" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pilihan_bagian" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."status_bagian" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hewan_id" "uuid" NOT NULL,
    "bagian" "public"."bagian_hewan" NOT NULL,
    "status" "public"."status_pilih_bagian" DEFAULT 'kosong'::"public"."status_pilih_bagian",
    "pemenang_id" "uuid",
    "catatan_panitia" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."status_bagian" OWNER TO "postgres";


ALTER TABLE ONLY "public"."catatan_lapangan"
    ADD CONSTRAINT "catatan_lapangan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hewan_qurban"
    ADD CONSTRAINT "hewan_qurban_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kas"
    ADD CONSTRAINT "kas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."log_undian"
    ADD CONSTRAINT "log_undian_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mustahiq"
    ADD CONSTRAINT "mustahiq_nomor_kupon_key" UNIQUE ("nomor_kupon");



ALTER TABLE ONLY "public"."mustahiq"
    ADD CONSTRAINT "mustahiq_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."panitia"
    ADD CONSTRAINT "panitia_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pilihan_bagian"
    ADD CONSTRAINT "pilihan_bagian_hewan_id_shohibul_id_bagian_key" UNIQUE ("hewan_id", "shohibul_id", "bagian");



ALTER TABLE ONLY "public"."pilihan_bagian"
    ADD CONSTRAINT "pilihan_bagian_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."request_bagian"
    ADD CONSTRAINT "request_bagian_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shohibul_qurban"
    ADD CONSTRAINT "shohibul_qurban_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."status_bagian"
    ADD CONSTRAINT "status_bagian_hewan_id_bagian_key" UNIQUE ("hewan_id", "bagian");



ALTER TABLE ONLY "public"."status_bagian"
    ADD CONSTRAINT "status_bagian_pkey" PRIMARY KEY ("id");



CREATE OR REPLACE TRIGGER "restrict_anon_akad_update_trigger" BEFORE UPDATE ON "public"."shohibul_qurban" FOR EACH ROW EXECUTE FUNCTION "public"."restrict_anon_akad_update"();



ALTER TABLE ONLY "public"."catatan_lapangan"
    ADD CONSTRAINT "catatan_lapangan_hewan_id_fkey" FOREIGN KEY ("hewan_id") REFERENCES "public"."hewan_qurban"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kas"
    ADD CONSTRAINT "kas_dibuat_oleh_fkey" FOREIGN KEY ("dibuat_oleh") REFERENCES "public"."panitia"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."log_undian"
    ADD CONSTRAINT "log_undian_dilakukan_oleh_fkey" FOREIGN KEY ("dilakukan_oleh") REFERENCES "public"."shohibul_qurban"("id");



ALTER TABLE ONLY "public"."log_undian"
    ADD CONSTRAINT "log_undian_hewan_id_fkey" FOREIGN KEY ("hewan_id") REFERENCES "public"."hewan_qurban"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."log_undian"
    ADD CONSTRAINT "log_undian_pemenang_id_fkey" FOREIGN KEY ("pemenang_id") REFERENCES "public"."shohibul_qurban"("id");



ALTER TABLE ONLY "public"."panitia"
    ADD CONSTRAINT "panitia_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pilihan_bagian"
    ADD CONSTRAINT "pilihan_bagian_hewan_id_fkey" FOREIGN KEY ("hewan_id") REFERENCES "public"."hewan_qurban"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pilihan_bagian"
    ADD CONSTRAINT "pilihan_bagian_shohibul_id_fkey" FOREIGN KEY ("shohibul_id") REFERENCES "public"."shohibul_qurban"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."request_bagian"
    ADD CONSTRAINT "request_bagian_hewan_id_fkey" FOREIGN KEY ("hewan_id") REFERENCES "public"."hewan_qurban"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."request_bagian"
    ADD CONSTRAINT "request_bagian_shohibul_qurban_id_fkey" FOREIGN KEY ("shohibul_qurban_id") REFERENCES "public"."shohibul_qurban"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shohibul_qurban"
    ADD CONSTRAINT "shohibul_qurban_hewan_id_fkey" FOREIGN KEY ("hewan_id") REFERENCES "public"."hewan_qurban"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."status_bagian"
    ADD CONSTRAINT "status_bagian_hewan_id_fkey" FOREIGN KEY ("hewan_id") REFERENCES "public"."hewan_qurban"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."status_bagian"
    ADD CONSTRAINT "status_bagian_pemenang_id_fkey" FOREIGN KEY ("pemenang_id") REFERENCES "public"."shohibul_qurban"("id");



CREATE POLICY "Admins can delete catatan" ON "public"."catatan_lapangan" FOR DELETE TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can delete hewan" ON "public"."hewan_qurban" FOR DELETE TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can delete kas" ON "public"."kas" FOR DELETE TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can delete mustahiq" ON "public"."mustahiq" FOR DELETE TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can delete request_bagian" ON "public"."request_bagian" FOR DELETE TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can delete shohibul" ON "public"."shohibul_qurban" FOR DELETE TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can insert catatan" ON "public"."catatan_lapangan" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can insert hewan" ON "public"."hewan_qurban" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can insert kas" ON "public"."kas" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can insert mustahiq" ON "public"."mustahiq" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can insert request_bagian" ON "public"."request_bagian" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can insert shohibul" ON "public"."shohibul_qurban" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can update hewan" ON "public"."hewan_qurban" FOR UPDATE TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can update kas" ON "public"."kas" FOR UPDATE TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can update request_bagian" ON "public"."request_bagian" FOR UPDATE TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can update shohibul" ON "public"."shohibul_qurban" FOR UPDATE TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Anon can update akad fields only" ON "public"."shohibul_qurban" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Anon can view hewan" ON "public"."hewan_qurban" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Anon can view hewan for undian publik" ON "public"."hewan_qurban" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Anon can view log_undian for undian publik" ON "public"."log_undian" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Anon can view pilihan_bagian for undian publik" ON "public"."pilihan_bagian" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Anon can view request_bagian" ON "public"."request_bagian" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Anon can view shohibul by id" ON "public"."shohibul_qurban" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Anon can view shohibul for undian publik" ON "public"."shohibul_qurban" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Anon can view status_bagian for undian publik" ON "public"."status_bagian" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Authenticated can view catatan" ON "public"."catatan_lapangan" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated can view kas" ON "public"."kas" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated can view mustahiq" ON "public"."mustahiq" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated can view panitia" ON "public"."panitia" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated can view request_bagian" ON "public"."request_bagian" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated can view shohibul" ON "public"."shohibul_qurban" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view hewan" ON "public"."hewan_qurban" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Hanya admin kupon yang bisa update mustahiq" ON "public"."mustahiq" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."panitia"
  WHERE (("panitia"."user_id" = "auth"."uid"()) AND ("panitia"."role" = ANY (ARRAY['super_admin'::"public"."role_panitia", 'admin_kupon'::"public"."role_panitia"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."panitia"
  WHERE (("panitia"."user_id" = "auth"."uid"()) AND ("panitia"."role" = ANY (ARRAY['super_admin'::"public"."role_panitia", 'admin_kupon'::"public"."role_panitia"]))))));



CREATE POLICY "Public can view kas" ON "public"."kas" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Super admin can delete panitia" ON "public"."panitia" FOR DELETE TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Super admin can insert panitia" ON "public"."panitia" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Super admin can update panitia" ON "public"."panitia" FOR UPDATE TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



ALTER TABLE "public"."catatan_lapangan" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hewan_qurban" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."log_undian" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "log_undian_read" ON "public"."log_undian" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "log_undian_write" ON "public"."log_undian" TO "authenticated" USING (true);



ALTER TABLE "public"."mustahiq" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."panitia" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pilihan_bagian" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pilihan_bagian_read" ON "public"."pilihan_bagian" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "pilihan_bagian_write" ON "public"."pilihan_bagian" TO "authenticated" USING (true);



ALTER TABLE "public"."request_bagian" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shohibul_qurban" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."status_bagian" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "status_bagian_read" ON "public"."status_bagian" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "status_bagian_write" ON "public"."status_bagian" TO "authenticated" USING (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."log_undian";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."pilihan_bagian";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."status_bagian";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."restrict_anon_akad_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."restrict_anon_akad_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."restrict_anon_akad_update"() TO "service_role";


















GRANT ALL ON TABLE "public"."catatan_lapangan" TO "anon";
GRANT ALL ON TABLE "public"."catatan_lapangan" TO "authenticated";
GRANT ALL ON TABLE "public"."catatan_lapangan" TO "service_role";



GRANT ALL ON TABLE "public"."request_bagian" TO "anon";
GRANT ALL ON TABLE "public"."request_bagian" TO "authenticated";
GRANT ALL ON TABLE "public"."request_bagian" TO "service_role";



GRANT ALL ON TABLE "public"."distribusi_bagian" TO "anon";
GRANT ALL ON TABLE "public"."distribusi_bagian" TO "authenticated";
GRANT ALL ON TABLE "public"."distribusi_bagian" TO "service_role";



GRANT ALL ON TABLE "public"."hewan_qurban" TO "anon";
GRANT ALL ON TABLE "public"."hewan_qurban" TO "authenticated";
GRANT ALL ON TABLE "public"."hewan_qurban" TO "service_role";



GRANT ALL ON TABLE "public"."shohibul_qurban" TO "anon";
GRANT ALL ON TABLE "public"."shohibul_qurban" TO "authenticated";
GRANT ALL ON TABLE "public"."shohibul_qurban" TO "service_role";



GRANT ALL ON TABLE "public"."hewan_dengan_kuota" TO "anon";
GRANT ALL ON TABLE "public"."hewan_dengan_kuota" TO "authenticated";
GRANT ALL ON TABLE "public"."hewan_dengan_kuota" TO "service_role";



GRANT ALL ON TABLE "public"."kas" TO "anon";
GRANT ALL ON TABLE "public"."kas" TO "authenticated";
GRANT ALL ON TABLE "public"."kas" TO "service_role";



GRANT ALL ON TABLE "public"."log_undian" TO "anon";
GRANT ALL ON TABLE "public"."log_undian" TO "authenticated";
GRANT ALL ON TABLE "public"."log_undian" TO "service_role";



GRANT ALL ON TABLE "public"."mustahiq" TO "anon";
GRANT ALL ON TABLE "public"."mustahiq" TO "authenticated";
GRANT ALL ON TABLE "public"."mustahiq" TO "service_role";



GRANT ALL ON TABLE "public"."panitia" TO "anon";
GRANT ALL ON TABLE "public"."panitia" TO "authenticated";
GRANT ALL ON TABLE "public"."panitia" TO "service_role";



GRANT ALL ON TABLE "public"."pilihan_bagian" TO "anon";
GRANT ALL ON TABLE "public"."pilihan_bagian" TO "authenticated";
GRANT ALL ON TABLE "public"."pilihan_bagian" TO "service_role";



GRANT ALL ON TABLE "public"."status_bagian" TO "anon";
GRANT ALL ON TABLE "public"."status_bagian" TO "authenticated";
GRANT ALL ON TABLE "public"."status_bagian" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";


  create policy "Admins can delete files"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'qurban-files'::text) AND public.is_admin(auth.uid())));



  create policy "Anyone can view files"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'qurban-files'::text));



  create policy "Authenticated can upload files"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'qurban-files'::text));



