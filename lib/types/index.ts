import { z } from "zod";

export type RequestStatus = "dikirim" | "diperiksa" | "disetujui" | "surat_siap" | "ditolak";
export type LetterType = "pengantar_ktp" | "sktm" | "domisili";
export type SignatureMode = "otomatis" | "kosong";
export type Severity = "blocker" | "warning";

export interface KtpData {
  nik: string;
  nama: string;
  tempat_lahir: string;
  tanggal_lahir: string; // YYYY-MM-DD
  jenis_kelamin: "LAKI-LAKI" | "PEREMPUAN";
  golongan_darah?: string;
  alamat: string;
  rt: string;
  rw: string;
  kelurahan: string;
  kecamatan: string;
  agama: string;
  status_perkawinan: "BELUM KAWIN" | "KAWIN" | "CERAI HIDUP" | "CERAI MATI";
  pekerjaan: string;
  kewarganegaraan?: string;
  berlaku_hingga?: string;
}

export interface KkMember {
  nik: string;
  nama: string;
  jenis_kelamin: "LAKI-LAKI" | "PEREMPUAN";
  tempat_lahir: string;
  tanggal_lahir: string; // YYYY-MM-DD
  agama: string;
  pendidikan?: string;
  jenis_pekerjaan?: string;
  status_perkawinan: "BELUM KAWIN" | "KAWIN" | "CERAI HIDUP" | "CERAI MATI";
  hubungan_keluarga: string; // KEPALA KELUARGA, SUAMI, ISTERI, ANAK, dll
  kewarganegaraan?: string;
  nama_ayah?: string;
  nama_ibu?: string;
}

export interface KkData {
  nomor_kk: string;
  kepala_keluarga: string;
  alamat: string;
  rt: string;
  rw: string;
  kode_pos?: string;
  kelurahan: string;
  kecamatan: string;
  kabupaten: string;
  provinsi: string;
  anggota: KkMember[];
}

export interface RuleFinding {
  id: string;
  rule_id: string;
  field: string;
  severity: Severity;
  ktp_value?: string | null;
  kk_value?: string | null;
  message: string;
  resolved: boolean;
}

export interface VerificationContext {
  letter_type: LetterType;
  request_text?: string;
  ktp?: KtpData | null;
  kk: KkData;
  applicant_is_under_17_new_ktp?: boolean;
  photo_meta?: {
    ktp_ratio?: number;
    ktp_detected_kind?: string;
    kk_ratio?: number;
    kk_detected_kind?: string;
    is_blur?: boolean;
    resolution_ok?: boolean;
  };
  rt_master?: {
    rt: string;
    rw: string;
    kelurahan: string;
    kecamatan: string;
    kabupaten: string;
  };
  existing_submissions_last_24h?: Array<{
    nik: string;
    letter_type: LetterType;
    created_at: string;
  }>;
}

// Zod schemas for runtime request boundaries
export const CreateRequestSchema = z.object({
  letter_type: z.enum(["pengantar_ktp", "sktm", "domisili"]),
  request_text: z.string().max(500).optional(),
});

export const ApproveRequestSchema = z.object({
  signature_mode: z.enum(["otomatis", "kosong"]).default("otomatis"),
});

export const RejectRequestSchema = z.object({
  reason: z.string().min(3, "Alasan penolakan wajib diisi (minimal 3 karakter)").max(500),
});

export const PatchFieldSchema = z.object({
  source: z.enum(["ktp", "kk"]),
  field: z.string().min(1),
  new_value: z.string(),
  override_choice: z.enum(["use_ktp", "use_kk", "custom"]).optional(),
});
