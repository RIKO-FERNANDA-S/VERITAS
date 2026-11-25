import { RuleFinding } from "../types";
import { parseNikMetadata } from "./r01-to-r03-nik";

/**
 * Normalisasi format tanggal lahir ke YYYY-MM-DD
 */
export function normalizeDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "";
  const cleaned = dateStr.trim();
  // Tangani format DD-MM-YYYY atau DD/MM/YYYY
  const dmyMatch = cleaned.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }
  // Format standar YYYY-MM-DD
  const ymdMatch = cleaned.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, "0");
    const day = ymdMatch[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return cleaned;
}

/**
 * R08: Tanggal lahir KTP ≡ KK (Blocker jika berbeda)
 */
export function checkR08(ktpBirthDate: string, kdBirthDate: string): RuleFinding | null {
  const normKtpDate = normalizeDate(ktpBirthDate);
  const normKkDate = normalizeDate(kdBirthDate);

  if (!normKtpDate || !normKkDate) return null;

  if (normKtpDate !== normKkDate) {
    return {
      id: "R08_BIRTH_DATE_MISMATCH",
      rule_id: "R08",
      field: "tanggal_lahir",
      severity: "blocker",
      ktp_value: ktpBirthDate,
      kk_value: kdBirthDate,
      message: `Tanggal lahir pada KTP (${normKtpDate}) tidak sama dengan KK (${normKkDate})`,
      resolved: false,
    };
  }

  return null;
}

/**
 * R09: Gender konsisten antara NIK dan nama/panggilan (Hj./Ny. -> Wanita, Tn./H. -> Pria)
 */
export function checkR09(nik: string, ktpName: string, statedGender?: string): RuleFinding | null {
  const parsed = parseNikMetadata(nik);
  if (!parsed.isValid || !parsed.gender) return null;

  const upperName = ktpName.toUpperCase();
  const femaleHonorifics = /(?:^|\s+)(?:HJ|HAJJAH|NY|NYONYA|NN|NONA|IBU)(?:\.|\s+|$)/i;
  const maleHonorifics = /(?:^|\s+)(?:H|HAJI|TN|TUAN|BAPAK)(?:\.|\s+|$)/i;

  let inferredGender: "LAKI-LAKI" | "PEREMPUAN" | null = null;
  if (femaleHonorifics.test(upperName)) {
    inferredGender = "PEREMPUAN";
  } else if (maleHonorifics.test(upperName)) {
    inferredGender = "LAKI-LAKI";
  }

  // Cek konsistensi NIK dengan honorific panggilan
  if (inferredGender && inferredGender !== parsed.gender) {
    return {
      id: "R09_GENDER_CALL_MISMATCH",
      rule_id: "R09",
      field: "jenis_kelamin",
      severity: "warning",
      ktp_value: `${ktpName} (NIK: ${parsed.gender})`,
      kk_value: inferredGender,
      message: `Panggilan pada nama menunjukkan gender ${inferredGender}, tetapi NIK mengindikasikan ${parsed.gender}`,
      resolved: false,
    };
  }

  // Cek juga jika statedGender berbeda dari NIK
  if (statedGender && statedGender.toUpperCase() !== parsed.gender) {
    return {
      id: "R09_GENDER_NIK_MISMATCH",
      rule_id: "R09",
      field: "jenis_kelamin",
      severity: "warning",
      ktp_value: statedGender,
      kk_value: parsed.gender,
      message: `Jenis kelamin tercantum (${statedGender}) tidak konsisten dengan kode jenis kelamin pada NIK (${parsed.gender})`,
      resolved: false,
    };
  }

  return null;
}

/**
 * R10: Status kawin KTP ≡ KK (Warning, mempengaruhi kalimat SKTM)
 */
export function checkR10(ktpMaritalStatus: string, kkMaritalStatus: string): RuleFinding | null {
  const normKtp = (ktpMaritalStatus || "").trim().toUpperCase();
  const normKk = (kkMaritalStatus || "").trim().toUpperCase();

  if (!normKtp || !normKk) return null;

  if (normKtp !== normKk) {
    return {
      id: "R10_MARITAL_STATUS_MISMATCH",
      rule_id: "R10",
      field: "status_perkawinan",
      severity: "warning",
      ktp_value: ktpMaritalStatus,
      kk_value: kkMaritalStatus,
      message: `Status perkawinan pada KTP (${ktpMaritalStatus}) tidak sesuai dengan KK (${kkMaritalStatus})`,
      resolved: false,
    };
  }

  return null;
}
