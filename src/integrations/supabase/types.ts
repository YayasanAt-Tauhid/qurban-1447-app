export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      catatan_lapangan: {
        Row: {
          catatan: string
          created_at: string
          hewan_id: string | null
          id: string
          waktu: string
        }
        Insert: {
          catatan: string
          created_at?: string
          hewan_id?: string | null
          id?: string
          waktu?: string
        }
        Update: {
          catatan?: string
          created_at?: string
          hewan_id?: string | null
          id?: string
          waktu?: string
        }
        Relationships: [
          {
            foreignKeyName: "catatan_lapangan_hewan_id_fkey"
            columns: ["hewan_id"]
            isOneToOne: false
            referencedRelation: "hewan_dengan_kuota"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catatan_lapangan_hewan_id_fkey"
            columns: ["hewan_id"]
            isOneToOne: false
            referencedRelation: "hewan_qurban"
            referencedColumns: ["id"]
          },
        ]
      }
      hewan_qurban: {
        Row: {
          alamat_penjual: string | null
          catatan: string | null
          created_at: string
          estimasi_bobot: number | null
          foto_url: string | null
          harga: number
          hp_penjual: string | null
          id: string
          iuran_per_orang: number
          jenis_hewan: Database["public"]["Enums"]["jenis_hewan"]
          jenis_kelamin: Database["public"]["Enums"]["jenis_kelamin_hewan"]
          kuota: number
          nama_penjual: string | null
          nama_petugas_booking: string | null
          nomor_urut: string
          ras: string | null
          status: Database["public"]["Enums"]["status_hewan"]
          tahun: number
          tanggal_booking: string | null
          tipe_kepemilikan: Database["public"]["Enums"]["tipe_kepemilikan"]
          uang_muka: number | null
        }
        Insert: {
          alamat_penjual?: string | null
          catatan?: string | null
          created_at?: string
          estimasi_bobot?: number | null
          foto_url?: string | null
          harga?: number
          hp_penjual?: string | null
          id?: string
          iuran_per_orang?: number
          jenis_hewan: Database["public"]["Enums"]["jenis_hewan"]
          jenis_kelamin?: Database["public"]["Enums"]["jenis_kelamin_hewan"]
          kuota?: number
          nama_penjual?: string | null
          nama_petugas_booking?: string | null
          nomor_urut: string
          ras?: string | null
          status?: Database["public"]["Enums"]["status_hewan"]
          tahun?: number
          tanggal_booking?: string | null
          tipe_kepemilikan: Database["public"]["Enums"]["tipe_kepemilikan"]
          uang_muka?: number | null
        }
        Update: {
          alamat_penjual?: string | null
          catatan?: string | null
          created_at?: string
          estimasi_bobot?: number | null
          foto_url?: string | null
          harga?: number
          hp_penjual?: string | null
          id?: string
          iuran_per_orang?: number
          jenis_hewan?: Database["public"]["Enums"]["jenis_hewan"]
          jenis_kelamin?: Database["public"]["Enums"]["jenis_kelamin_hewan"]
          kuota?: number
          nama_penjual?: string | null
          nama_petugas_booking?: string | null
          nomor_urut?: string
          ras?: string | null
          status?: Database["public"]["Enums"]["status_hewan"]
          tahun?: number
          tanggal_booking?: string | null
          tipe_kepemilikan?: Database["public"]["Enums"]["tipe_kepemilikan"]
          uang_muka?: number | null
        }
        Relationships: []
      }
      kas: {
        Row: {
          bukti_url: string | null
          created_at: string
          dibuat_oleh: string | null
          id: string
          jenis: Database["public"]["Enums"]["jenis_kas"]
          jumlah: number
          kategori: string | null
          keterangan: string | null
          metode: Database["public"]["Enums"]["metode_kas"]
          tahun: number
          tanggal: string
        }
        Insert: {
          bukti_url?: string | null
          created_at?: string
          dibuat_oleh?: string | null
          id?: string
          jenis: Database["public"]["Enums"]["jenis_kas"]
          jumlah?: number
          kategori?: string | null
          keterangan?: string | null
          metode?: Database["public"]["Enums"]["metode_kas"]
          tahun?: number
          tanggal?: string
        }
        Update: {
          bukti_url?: string | null
          created_at?: string
          dibuat_oleh?: string | null
          id?: string
          jenis?: Database["public"]["Enums"]["jenis_kas"]
          jumlah?: number
          kategori?: string | null
          keterangan?: string | null
          metode?: Database["public"]["Enums"]["metode_kas"]
          tahun?: number
          tanggal?: string
        }
        Relationships: [
          {
            foreignKeyName: "kas_dibuat_oleh_fkey"
            columns: ["dibuat_oleh"]
            isOneToOne: false
            referencedRelation: "panitia"
            referencedColumns: ["id"]
          },
        ]
      }
      mustahiq: {
        Row: {
          created_at: string
          id: string
          kategori: Database["public"]["Enums"]["kategori_mustahiq"]
          keterangan: string | null
          nama: string
          nama_penyalur: string | null
          nomor_kupon: string | null
          qr_data: string | null
          status_kupon: Database["public"]["Enums"]["status_kupon"]
          tahun: number
        }
        Insert: {
          created_at?: string
          id?: string
          kategori?: Database["public"]["Enums"]["kategori_mustahiq"]
          keterangan?: string | null
          nama: string
          nama_penyalur?: string | null
          nomor_kupon?: string | null
          qr_data?: string | null
          status_kupon?: Database["public"]["Enums"]["status_kupon"]
          tahun?: number
        }
        Update: {
          created_at?: string
          id?: string
          kategori?: Database["public"]["Enums"]["kategori_mustahiq"]
          keterangan?: string | null
          nama?: string
          nama_penyalur?: string | null
          nomor_kupon?: string | null
          qr_data?: string | null
          status_kupon?: Database["public"]["Enums"]["status_kupon"]
          tahun?: number
        }
        Relationships: []
      }
      panitia: {
        Row: {
          created_at: string
          divisi: Database["public"]["Enums"]["divisi_panitia"]
          foto_url: string | null
          id: string
          jabatan: string | null
          nama: string
          no_hp: string | null
          role: Database["public"]["Enums"]["role_panitia"]
          tahun: number
          ukuran_seragam: Database["public"]["Enums"]["ukuran_seragam"] | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          divisi?: Database["public"]["Enums"]["divisi_panitia"]
          foto_url?: string | null
          id?: string
          jabatan?: string | null
          nama: string
          no_hp?: string | null
          role?: Database["public"]["Enums"]["role_panitia"]
          tahun?: number
          ukuran_seragam?: Database["public"]["Enums"]["ukuran_seragam"] | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          divisi?: Database["public"]["Enums"]["divisi_panitia"]
          foto_url?: string | null
          id?: string
          jabatan?: string | null
          nama?: string
          no_hp?: string | null
          role?: Database["public"]["Enums"]["role_panitia"]
          tahun?: number
          ukuran_seragam?: Database["public"]["Enums"]["ukuran_seragam"] | null
          user_id?: string | null
        }
        Relationships: []
      }
      request_bagian: {
        Row: {
          bagian: Database["public"]["Enums"]["bagian_hewan"]
          catatan: string | null
          created_at: string
          hewan_id: string
          id: string
          shohibul_qurban_id: string
        }
        Insert: {
          bagian: Database["public"]["Enums"]["bagian_hewan"]
          catatan?: string | null
          created_at?: string
          hewan_id: string
          id?: string
          shohibul_qurban_id: string
        }
        Update: {
          bagian?: Database["public"]["Enums"]["bagian_hewan"]
          catatan?: string | null
          created_at?: string
          hewan_id?: string
          id?: string
          shohibul_qurban_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_bagian_hewan_id_fkey"
            columns: ["hewan_id"]
            isOneToOne: false
            referencedRelation: "hewan_dengan_kuota"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_bagian_hewan_id_fkey"
            columns: ["hewan_id"]
            isOneToOne: false
            referencedRelation: "hewan_qurban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_bagian_shohibul_qurban_id_fkey"
            columns: ["shohibul_qurban_id"]
            isOneToOne: false
            referencedRelation: "shohibul_qurban"
            referencedColumns: ["id"]
          },
        ]
      }
      shohibul_qurban: {
        Row: {
          akad_dilakukan: boolean | null
          akad_diwakilkan: boolean | null
          akad_timestamp: string | null
          alamat: string | null
          created_at: string
          hewan_id: string | null
          id: string
          nama: string
          nama_wakil_akad: string | null
          no_wa: string | null
          panitia_pendaftar: string | null
          status_checklist_panitia:
            | Database["public"]["Enums"]["status_checklist"]
            | null
          status_penyembelihan:
            | Database["public"]["Enums"]["status_penyembelihan"]
            | null
          sumber_pendaftaran:
            | Database["public"]["Enums"]["sumber_pendaftaran"]
            | null
          tahun: number
          tipe_kepemilikan: Database["public"]["Enums"]["tipe_kepemilikan"]
        }
        Insert: {
          akad_dilakukan?: boolean | null
          akad_diwakilkan?: boolean | null
          akad_timestamp?: string | null
          alamat?: string | null
          created_at?: string
          hewan_id?: string | null
          id?: string
          nama: string
          nama_wakil_akad?: string | null
          no_wa?: string | null
          panitia_pendaftar?: string | null
          status_checklist_panitia?:
            | Database["public"]["Enums"]["status_checklist"]
            | null
          status_penyembelihan?:
            | Database["public"]["Enums"]["status_penyembelihan"]
            | null
          sumber_pendaftaran?:
            | Database["public"]["Enums"]["sumber_pendaftaran"]
            | null
          tahun?: number
          tipe_kepemilikan?: Database["public"]["Enums"]["tipe_kepemilikan"]
        }
        Update: {
          akad_dilakukan?: boolean | null
          akad_diwakilkan?: boolean | null
          akad_timestamp?: string | null
          alamat?: string | null
          created_at?: string
          hewan_id?: string | null
          id?: string
          nama?: string
          nama_wakil_akad?: string | null
          no_wa?: string | null
          panitia_pendaftar?: string | null
          status_checklist_panitia?:
            | Database["public"]["Enums"]["status_checklist"]
            | null
          status_penyembelihan?:
            | Database["public"]["Enums"]["status_penyembelihan"]
            | null
          sumber_pendaftaran?:
            | Database["public"]["Enums"]["sumber_pendaftaran"]
            | null
          tahun?: number
          tipe_kepemilikan?: Database["public"]["Enums"]["tipe_kepemilikan"]
        }
        Relationships: [
          {
            foreignKeyName: "shohibul_qurban_hewan_id_fkey"
            columns: ["hewan_id"]
            isOneToOne: false
            referencedRelation: "hewan_dengan_kuota"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shohibul_qurban_hewan_id_fkey"
            columns: ["hewan_id"]
            isOneToOne: false
            referencedRelation: "hewan_qurban"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      distribusi_bagian: {
        Row: {
          bagian: Database["public"]["Enums"]["bagian_hewan"] | null
          hewan_id: string | null
          jumlah_request: number | null
          list_nama_shohibul: string[] | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_bagian_hewan_id_fkey"
            columns: ["hewan_id"]
            isOneToOne: false
            referencedRelation: "hewan_dengan_kuota"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_bagian_hewan_id_fkey"
            columns: ["hewan_id"]
            isOneToOne: false
            referencedRelation: "hewan_qurban"
            referencedColumns: ["id"]
          },
        ]
      }
      hewan_dengan_kuota: {
        Row: {
          alamat_penjual: string | null
          catatan: string | null
          created_at: string | null
          estimasi_bobot: number | null
          foto_url: string | null
          harga: number | null
          hp_penjual: string | null
          id: string | null
          iuran_per_orang: number | null
          jenis_hewan: Database["public"]["Enums"]["jenis_hewan"] | null
          jenis_kelamin:
            | Database["public"]["Enums"]["jenis_kelamin_hewan"]
            | null
          kuota: number | null
          nama_penjual: string | null
          nama_petugas_booking: string | null
          nomor_urut: string | null
          ras: string | null
          sisa_kuota: number | null
          status: Database["public"]["Enums"]["status_hewan"] | null
          tahun: number | null
          tanggal_booking: string | null
          tipe_kepemilikan:
            | Database["public"]["Enums"]["tipe_kepemilikan"]
            | null
          uang_muka: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["role_panitia"]
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      bagian_hewan: "jeroan" | "kepala" | "kulit" | "ekor" | "kaki" | "tulang"
      divisi_panitia:
        | "ketua"
        | "sekretaris"
        | "bendahara"
        | "koord_sapi"
        | "koord_kambing"
        | "penyembelih_sapi"
        | "penyembelih_kambing"
        | "distribusi"
        | "konsumsi"
        | "syariat"
        | "area_sapi"
        | "area_kambing"
        | "lainnya"
      jenis_hewan: "sapi" | "kambing"
      jenis_kas: "masuk" | "keluar"
      jenis_kelamin_hewan: "jantan" | "betina"
      kategori_mustahiq:
        | "dhuafa"
        | "warga"
        | "jamaah"
        | "shohibul_qurban"
        | "bagian_tidak_direquest"
        | "lainnya"
      metode_kas: "tunai" | "bank"
      role_panitia:
        | "super_admin"
        | "admin_pendaftaran"
        | "admin_keuangan"
        | "admin_kupon"
        | "admin_hewan"
        | "panitia"
        | "viewer"
      status_checklist: "selesai" | "pending" | "tindak_lanjut"
      status_hewan: "survei" | "booking" | "lunas"
      status_kupon: "belum_ambil" | "sudah_ambil"
      status_penyembelihan: "sendiri" | "diwakilkan"
      sumber_pendaftaran: "online" | "manual"
      tipe_kepemilikan: "kolektif" | "individu"
      ukuran_seragam: "S" | "M" | "L" | "XL" | "XXL"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      bagian_hewan: ["jeroan", "kepala", "kulit", "ekor", "kaki", "tulang"],
      divisi_panitia: [
        "ketua",
        "sekretaris",
        "bendahara",
        "koord_sapi",
        "koord_kambing",
        "penyembelih_sapi",
        "penyembelih_kambing",
        "distribusi",
        "konsumsi",
        "syariat",
        "area_sapi",
        "area_kambing",
        "lainnya",
      ],
      jenis_hewan: ["sapi", "kambing"],
      jenis_kas: ["masuk", "keluar"],
      jenis_kelamin_hewan: ["jantan", "betina"],
      kategori_mustahiq: [
        "dhuafa",
        "warga",
        "jamaah",
        "shohibul_qurban",
        "bagian_tidak_direquest",
        "lainnya",
      ],
      metode_kas: ["tunai", "bank"],
      role_panitia: [
        "super_admin",
        "admin_pendaftaran",
        "admin_keuangan",
        "admin_kupon",
        "admin_hewan",
        "panitia",
        "viewer",
      ],
      status_checklist: ["selesai", "pending", "tindak_lanjut"],
      status_hewan: ["survei", "booking", "lunas"],
      status_kupon: ["belum_ambil", "sudah_ambil"],
      status_penyembelihan: ["sendiri", "diwakilkan"],
      sumber_pendaftaran: ["online", "manual"],
      tipe_kepemilikan: ["kolektif", "individu"],
      ukuran_seragam: ["S", "M", "L", "XL", "XXL"],
    },
  },
} as const
