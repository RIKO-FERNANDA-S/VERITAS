import { LetterType, RuleFinding } from "../types";

/**
 * R11: Jenis surat cocok dokumen terlampir
 * KTP baru: pemohon <17 tahun tanpa KTP = sah, bukan blocker.
 * Selain itu, ketiadaan dokumen identitas pokok adalah blocker.
 */
export function checkR11(
  letterType: LetterType,
  hasKtp: boolean,
  hasKk: boolean,
  isUnder17NewKtp: boolean = false
): RuleFinding | null {
  // KK selalu wajib untuk semua jenis surat
  if (!hasKk) {
    return {
      id: "R11_MISSING_KK",
      rule_id: "R11",
      field: "dokumen_kk",
      severity: "blocker",
      message: "Kartu Keluarga (KK) wajib dilampirkan untuk permohonan surat ini",
      resolved: false,
    };
  }

  // Khusus alur KTP baru pemohon < 17 tahun: sah tanpa KTP fisik
  if (letterType === "pengantar_ktp" && isUnder17NewKtp) {
    return null;
  }

  // Untuk permohonan lain, KTP wajib ada
  if (!hasKtp) {
    return {
      id: "R11_MISSING_KTP",
      rule_id: "R11",
      field: "dokumen_ktp",
      severity: "blocker",
      message: "KTP fisik wajib dilampirkan untuk jenis permohonan surat ini",
      resolved: false,
    };
  }

  return null;
}
