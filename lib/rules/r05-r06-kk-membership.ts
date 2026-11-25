import { KkMember, RuleFinding } from "../types";
import { normalizeName, levenshteinDistance } from "./r04-name";

/**
 * R05 & R06: Keanggotaan dan Pencocokan NIK dalam Kartu Keluarga
 */
export function checkR05AndR06(
  ktpNik: string,
  ktpName: string,
  kkMembers: KkMember[],
  isUnder17NewKtp: boolean = false
): RuleFinding[] {
  const findings: RuleFinding[] = [];

  // Pengecualian KTP Baru < 17 tahun: sah tanpa KTP fisik
  if (isUnder17NewKtp && (!ktpNik || ktpNik.trim() === "")) {
    return findings;
  }

  // 1. Cari apakah NIK KTP ada persis di anggota KK
  const memberByNik = kkMembers.find((m) => m.nik === ktpNik);

  if (memberByNik) {
    // NIK ditemukan di KK! R05 terpenuhi.
    return findings;
  }

  // Jika NIK KTP TIDAK ditemukan di KK:
  // Cek apakah ada anggota KK dengan nama yang mirip/sama (R06)
  const normKtpName = normalizeName(ktpName);
  const memberByName = kkMembers.find((m) => {
    const normMemberName = normalizeName(m.nama);
    return normMemberName === normKtpName || levenshteinDistance(normMemberName, normKtpName) <= 2;
  });

  if (memberByName) {
    // R06: Nama ada di KK tapi NIK beda
    findings.push({
      id: "R06_NAME_EXISTS_NIK_DIFFERENT",
      rule_id: "R06",
      field: "nik",
      severity: "warning",
      ktp_value: ktpNik,
      kk_value: memberByName.nik,
      message: `Nama pemohon ditemukan di KK (${memberByName.nama}), namun NIK di KTP berbeda dengan NIK di KK`,
      resolved: false,
    });
  } else {
    // R05: NIK KTP tidak ada di daftar anggota KK (Blocker)
    findings.push({
      id: "R05_NIK_NOT_IN_KK",
      rule_id: "R05",
      field: "nik",
      severity: "blocker",
      ktp_value: ktpNik,
      kk_value: null,
      message: "NIK pemohon tidak terdaftar dalam daftar anggota Kartu Keluarga terlampir",
      resolved: false,
    });
  }

  return findings;
}
