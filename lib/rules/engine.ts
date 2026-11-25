import { RuleFinding, VerificationContext } from "../types";
import { checkR01, checkR02, checkR03 } from "./r01-to-r03-nik";
import { checkR04 } from "./r04-name";
import { checkR05AndR06 } from "./r05-r06-kk-membership";
import { checkR07 } from "./r07-address";
import { checkR08, checkR09, checkR10 } from "./r08-r10-biodata";
import { checkR11 } from "./r11-document-match";
import { checkR12, checkR13 } from "./r12-r13-photo";
import { checkR14 } from "./r14-duplicate";

export interface EngineResult {
  isValid: boolean;
  blockersCount: number;
  warningsCount: number;
  findings: RuleFinding[];
}

/**
 * Mesin Aturan Deterministik VERITAS (Fungsi Murni TypeScript)
 * Tanpa akses database, tanpa jaringan, tanpa LLM.
 * Berjalan cepat (< 1 detik untuk puluhan kasus) dan sepenuhnya terisolasi.
 */
export function runVerificationRules(
  context: VerificationContext,
  referenceDate: Date = new Date()
): EngineResult {
  const findings: RuleFinding[] = [];

  const { ktp, kk, letter_type, applicant_is_under_17_new_ktp, photo_meta, existing_submissions_last_24h } =
    context;

  // R11: Dokumen sesuai jenis surat
  const r11 = checkR11(letter_type, !!ktp, !!kk, applicant_is_under_17_new_ktp);
  if (r11) findings.push(r11);

  // Jika ada KTP, jalankan aturan identitas KTP
  if (ktp) {
    // R01: NIK 16 digit numerik
    const r01 = checkR01(ktp.nik);
    if (r01) {
      findings.push(r01);
    } else {
      // R02: Prefiks wilayah BPS
      const r02 = checkR02(ktp.nik);
      if (r02) findings.push(r02);

      // R03: Validitas tanggal lahir NIK (DDMMYY)
      const r03 = checkR03(ktp.nik, referenceDate);
      if (r03) findings.push(r03);
    }

    // Temukan data pemohon di KK (jika ada)
    const matchingMember = kk?.anggota?.find(
      (m) => m.nik === ktp.nik || m.nama.toUpperCase().trim() === ktp.nama.toUpperCase().trim()
    );

    // R04: Nama KTP ≡ KK setelah normalisasi gelar & bin/binti
    if (matchingMember) {
      const r04 = checkR04(ktp.nama, matchingMember.nama);
      if (r04) findings.push(r04);

      // R08: Tanggal lahir KTP ≡ KK
      const r08 = checkR08(ktp.tanggal_lahir, matchingMember.tanggal_lahir);
      if (r08) findings.push(r08);

      // R10: Status perkawinan KTP ≡ KK
      const r10 = checkR10(ktp.status_perkawinan, matchingMember.status_perkawinan);
      if (r10) findings.push(r10);
    }

    // R05 & R06: Pencocokan NIK dalam daftar anggota KK
    if (kk?.anggota) {
      const r05r06 = checkR05AndR06(ktp.nik, ktp.nama, kk.anggota, applicant_is_under_17_new_ktp);
      findings.push(...r05r06);
    }

    // R07: Wilayah dan RT/RW sepakat
    const r07 = checkR07(
      {
        alamat: ktp.alamat,
        rt: ktp.rt,
        rw: ktp.rw,
        kelurahan: ktp.kelurahan,
        kecamatan: ktp.kecamatan,
      },
      {
        alamat: kk.alamat,
        rt: kk.rt,
        rw: kk.rw,
        kelurahan: kk.kelurahan,
        kecamatan: kk.kecamatan,
        kabupaten: kk.kabupaten,
      },
      letter_type === "domisili"
    );
    findings.push(...r07);

    // R09: Konsistensi gender NIK vs nama/panggilan
    const r09 = checkR09(ktp.nik, ktp.nama, ktp.jenis_kelamin);
    if (r09) findings.push(r09);

    // R14: Deteksi permohonan ganda dalam 24 jam
    const r14 = checkR14(ktp.nik, letter_type, existing_submissions_last_24h, referenceDate);
    if (r14) findings.push(r14);
  } else if (applicant_is_under_17_new_ktp && kk?.anggota?.length) {
    // Alur khusus KTP baru < 17 tahun: validasi NIK pemohon dari anggota KK
    const applicant = kk.anggota[0]; // Pemohon pertama / yang dituju
    if (applicant) {
      const r01 = checkR01(applicant.nik);
      if (r01) {
        findings.push(r01);
      } else {
        const r02 = checkR02(applicant.nik);
        if (r02) findings.push(r02);
        const r03 = checkR03(applicant.nik, referenceDate);
        if (r03) findings.push(r03);
      }
    }
  }

  // R12 & R13: Validasi foto
  if (photo_meta) {
    if (ktp) {
      const r12Ktp = checkR12("ktp", {
        detectedKind: photo_meta.ktp_detected_kind,
        aspectRatio: photo_meta.ktp_ratio,
      });
      if (r12Ktp) findings.push(r12Ktp);

      const r13Ktp = checkR13("ktp", {
        isBlur: photo_meta.is_blur,
        resolutionOk: photo_meta.resolution_ok,
      });
      if (r13Ktp) findings.push(r13Ktp);
    }

    if (kk) {
      const r12Kk = checkR12("kk", {
        detectedKind: photo_meta.kk_detected_kind,
      });
      if (r12Kk) findings.push(r12Kk);
    }
  }

  const blockersCount = findings.filter((f) => f.severity === "blocker").length;
  const warningsCount = findings.filter((f) => f.severity === "warning").length;

  return {
    isValid: blockersCount === 0,
    blockersCount,
    warningsCount,
    findings,
  };
}
