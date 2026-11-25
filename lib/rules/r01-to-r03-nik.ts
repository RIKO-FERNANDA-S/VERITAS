import { RuleFinding } from "../types";
import { isValidRegionCode } from "./bps-tables";

export interface NikParseResult {
  isValid: boolean;
  provinceCode?: string;
  regencyCode?: string;
  districtCode?: string;
  birthDate?: Date;
  gender?: "LAKI-LAKI" | "PEREMPUAN";
  sequence?: string;
}

/**
 * R01: NIK 16 digit numerik
 * Validasi struktural saja (NIK tidak memiliki check digit).
 */
export function checkR01(nik: string): RuleFinding | null {
  if (!/^\d{16}$/.test(nik)) {
    return {
      id: "R01_INVALID_LENGTH_OR_FORMAT",
      rule_id: "R01",
      field: "nik",
      severity: "blocker",
      ktp_value: nik,
      message: "NIK harus terdiri dari tepat 16 digit angka",
      resolved: false,
    };
  }
  return null;
}

/**
 * R02: Prefix 2+4 digit ada di tabel wilayah BPS
 */
export function checkR02(nik: string): RuleFinding | null {
  if (!/^\d{16}$/.test(nik)) {
    return null; // R01 sudah menangani format
  }
  const region6 = nik.substring(0, 6);
  if (!isValidRegionCode(region6)) {
    return {
      id: "R02_UNKNOWN_REGION_PREFIX",
      rule_id: "R02",
      field: "nik",
      severity: "blocker",
      ktp_value: nik,
      message: `Kode wilayah NIK (${region6}) tidak terdaftar dalam referensi BPS`,
      resolved: false,
    };
  }
  return null;
}

/**
 * R03: Digit 7-12 DDMMYY valid; DD > 40 berarti perempuan (DD - 40)
 * Tanggal mustahil (misal 31 Feb) atau tanggal di masa depan harus ditolak (blocker).
 */
export function checkR03(nik: string, referenceDate: Date = new Date()): RuleFinding | null {
  if (!/^\d{16}$/.test(nik)) {
    return null; // R01 menangani format
  }

  const rawDay = parseInt(nik.substring(6, 8), 10);
  const rawMonth = parseInt(nik.substring(8, 10), 10);
  const rawYear = parseInt(nik.substring(10, 12), 10);

  let day = rawDay;
  if (day > 40) {
    day -= 40;
  }

  // Cek batas hari dan bulan dasar
  if (day < 1 || day > 31 || rawMonth < 1 || rawMonth > 12) {
    return {
      id: "R03_INVALID_DATE_VALUES",
      rule_id: "R03",
      field: "nik",
      severity: "blocker",
      ktp_value: nik,
      message: `Tanggal lahir pada NIK tidak valid (${nik.substring(6, 12)})`,
      resolved: false,
    };
  }

  // Tentukan tahun 1900 atau 2000
  // Asumsi: jika rawYear <= tahun sekarang % 100, bisa jadi 20xx
  const currentYear = referenceDate.getFullYear();
  const currentYear2Digits = currentYear % 100;
  let fullYear = 1900 + rawYear;
  if (rawYear <= currentYear2Digits) {
    fullYear = 2000 + rawYear;
  }

  // Cek validitas kalender (misal 31 Februari, kabisat)
  const daysInMonth = new Date(fullYear, rawMonth, 0).getDate();
  if (day > daysInMonth) {
    return {
      id: "R03_IMPOSSIBLE_CALENDAR_DATE",
      rule_id: "R03",
      field: "nik",
      severity: "blocker",
      ktp_value: nik,
      message: `Tanggal lahir pada NIK mustahil menurut kalender (${day}/${rawMonth}/${fullYear})`,
      resolved: false,
    };
  }

  const parsedDate = new Date(fullYear, rawMonth - 1, day);
  // Tanggal tidak boleh di masa depan
  if (parsedDate > referenceDate) {
    return {
      id: "R03_FUTURE_DATE",
      rule_id: "R03",
      field: "nik",
      severity: "blocker",
      ktp_value: nik,
      message: `Tanggal lahir pada NIK berada di masa depan (${day}/${rawMonth}/${fullYear})`,
      resolved: false,
    };
  }

  return null;
}

/**
 * Ekstraksi metadata NIK
 */
export function parseNikMetadata(nik: string): NikParseResult {
  if (!/^\d{16}$/.test(nik)) {
    return { isValid: false };
  }

  const region6 = nik.substring(0, 6);
  if (!isValidRegionCode(region6)) {
    return { isValid: false };
  }

  const rawDay = parseInt(nik.substring(6, 8), 10);
  const rawMonth = parseInt(nik.substring(8, 10), 10);
  const rawYear = parseInt(nik.substring(10, 12), 10);

  const isFemale = rawDay > 40;
  const day = isFemale ? rawDay - 40 : rawDay;

  const currentYear = new Date().getFullYear();
  const currentYear2Digits = currentYear % 100;
  const fullYear = rawYear <= currentYear2Digits ? 2000 + rawYear : 1900 + rawYear;

  const daysInMonth = new Date(fullYear, rawMonth, 0).getDate();
  if (day < 1 || day > daysInMonth || rawMonth < 1 || rawMonth > 12) {
    return { isValid: false };
  }

  return {
    isValid: true,
    provinceCode: nik.substring(0, 2),
    regencyCode: nik.substring(2, 4),
    districtCode: nik.substring(4, 6),
    gender: isFemale ? "PEREMPUAN" : "LAKI-LAKI",
    birthDate: new Date(fullYear, rawMonth - 1, day),
    sequence: nik.substring(12, 16),
  };
}
