import { describe, it, expect } from "vitest";
import { runVerificationRules } from "../lib/rules/engine";
import { checkR01, checkR02, checkR03, parseNikMetadata } from "../lib/rules/r01-to-r03-nik";
import { checkR04, normalizeName, levenshteinDistance } from "../lib/rules/r04-name";
import { checkR05AndR06 } from "../lib/rules/r05-r06-kk-membership";
import { checkR07, normalizeRtRw } from "../lib/rules/r07-address";
import { checkR08, checkR09, checkR10, normalizeDate } from "../lib/rules/r08-r10-biodata";
import { checkR11 } from "../lib/rules/r11-document-match";
import { checkR12, checkR13 } from "../lib/rules/r12-r13-photo";
import { checkR14 } from "../lib/rules/r14-duplicate";
import { KtpData, KkData, VerificationContext } from "../lib/types";

// Data sintetis dasar yang valid
const SYNTHETIC_KTP: KtpData = {
  nik: "3201010105900001", // Prov 32, Kab 01, Kec 01, Tgl 01 Mei 1990, Laki-laki
  nama: "AHMAD SUBARJO",
  tempat_lahir: "BOGOR",
  tanggal_lahir: "1990-05-01",
  jenis_kelamin: "LAKI-LAKI",
  alamat: "JL MAWAR NO 10",
  rt: "002",
  rw: "003",
  kelurahan: "SUKAMAJU",
  kecamatan: "CIBINONG",
  agama: "ISLAM",
  status_perkawinan: "KAWIN",
  pekerjaan: "KARYAWAN SWASTA",
};

const SYNTHETIC_KK: KkData = {
  nomor_kk: "3201010101010001",
  kepala_keluarga: "SUBARJO",
  alamat: "JL MAWAR NO 10",
  rt: "02",
  rw: "3",
  kelurahan: "SUKAMAJU",
  kecamatan: "CIBINONG",
  kabupaten: "BOGOR",
  provinsi: "JAWA BARAT",
  anggota: [
    {
      nik: "3201010105900001",
      nama: "AHMAD SUBARJO",
      jenis_kelamin: "LAKI-LAKI",
      tempat_lahir: "BOGOR",
      tanggal_lahir: "1990-05-01",
      agama: "ISLAM",
      status_perkawinan: "KAWIN",
      hubungan_keluarga: "KEPALA KELUARGA",
    },
  ],
};

const REF_DATE = new Date("2026-11-24T00:00:00Z");

describe("Mesin 14 Aturan Deterministik VERITAS (20+ Fixture)", () => {
  // 1. R01: NIK 16 digit numerik
  describe("R01 - Validasi Format NIK", () => {
    it("Fixture 1 [FAIL]: NIK kurang dari 16 digit atau memiliki huruf", () => {
      const f1 = checkR01("32010101059000A"); // 15 karakter + huruf
      expect(f1).not.toBeNull();
      expect(f1?.rule_id).toBe("R01");
      expect(f1?.severity).toBe("blocker");

      const f2 = checkR01("12345"); // Kurang digit
      expect(f2?.severity).toBe("blocker");
    });

    it("Fixture 2 [PASS]: NIK tepat 16 digit numerik", () => {
      const res = checkR01("3201010105900001");
      expect(res).toBeNull();
    });
  });

  // 2. R02: Prefix Wilayah BPS
  describe("R02 - Prefix Wilayah BPS", () => {
    it("Fixture 3 [FAIL]: Prefix wilayah fiktif/tidak terdaftar di BPS", () => {
      // Kode provinsi 99 tidak ada di BPS
      const res = checkR02("9901010105900001");
      expect(res).not.toBeNull();
      expect(res?.rule_id).toBe("R02");
      expect(res?.severity).toBe("blocker");
    });

    it("Fixture 4 [PASS]: Prefix wilayah Jawa Barat (320101) terdaftar", () => {
      const res = checkR02("3201010105900001");
      expect(res).toBeNull();
    });
  });

  // 3. R03: Digit Tanggal Lahir NIK & Offset Perempuan
  describe("R03 - Validitas Tanggal Lahir NIK & Offset Perempuan", () => {
    it("Fixture 5 [PASS]: Offset perempuan DD > 40 valid (contoh tgl 12 -> DD=52)", () => {
      // NIK wanita lahir 12 Agustus 1995: DD = 12 + 40 = 52, MM = 08, YY = 95
      const nikWanita = "3201015208950001";
      const res = checkR03(nikWanita, REF_DATE);
      expect(res).toBeNull();

      const meta = parseNikMetadata(nikWanita);
      expect(meta.gender).toBe("PEREMPUAN");
      expect(meta.birthDate?.getDate()).toBe(12);
      expect(meta.birthDate?.getMonth()).toBe(7); // Bulan Agustus (0-indexed: 7)
    });

    it("Fixture 6 [FAIL]: Tanggal mustahil 31 Februari", () => {
      // DD = 31, MM = 02, YY = 90
      const nikFeb = "3201013102900001";
      const res = checkR03(nikFeb, REF_DATE);
      expect(res).not.toBeNull();
      expect(res?.rule_id).toBe("R03");
      expect(res?.severity).toBe("blocker");
    });

    it("Fixture 7 [FAIL]: Tanggal lahir di masa depan", () => {
      // Reference date: 24 Nov 2026. NIK lahir 01 Des 2026: DD=01, MM=12, YY=26
      const nikFuture = "3201010112260001";
      const res = checkR03(nikFuture, REF_DATE);
      expect(res).not.toBeNull();
      expect(res?.rule_id).toBe("R03");
      expect(res?.severity).toBe("blocker");
    });

    it("Fixture 8 [PASS]: Tanggal normal pria", () => {
      const res = checkR03("3201010105900001", REF_DATE);
      expect(res).toBeNull();
    });
  });

  // 4. R04: Normalisasi Gelar & Bin/Binti serta Typo Nama
  describe("R04 - Pencocokan Nama KTP vs KK", () => {
    it("Fixture 9 [PASS]: Nama dengan gelar Haji dan bin/binti cocok setelah normalisasi", () => {
      const ktpName = "H. AHMAD SUBARJO, S.KOM";
      const kkName = "AHMAD SUBARJO BIN SULAIMAN";
      const res = checkR04(ktpName, kkName);
      expect(res).toBeNull();
    });

    it("Fixture 10 [WARN]: Typo nama 1 karakter menjadi warning", () => {
      const ktpName = "AHMAD SUBARJO";
      const kkName = "ACHMAD SUBARJO"; // Tambahan huruf C (jarak 1)
      const res = checkR04(ktpName, kkName);
      expect(res).not.toBeNull();
      expect(res?.rule_id).toBe("R04");
      expect(res?.severity).toBe("warning");
    });

    it("Fixture 11 [FAIL]: Nama berbeda signifikan (>2 karakter) menjadi blocker", () => {
      const ktpName = "AHMAD SUBARJO";
      const kkName = "BAMBANG SUDARMONO";
      const res = checkR04(ktpName, kkName);
      expect(res).not.toBeNull();
      expect(res?.rule_id).toBe("R04");
      expect(res?.severity).toBe("blocker");
    });
  });

  // 5. R05 & R06: Keanggotaan KK
  describe("R05 & R06 - Keanggotaan KK & Deteksi NIK Beda", () => {
    it("Fixture 12 [PASS]: NIK KTP ada di daftar anggota KK", () => {
      const findings = checkR05AndR06(
        SYNTHETIC_KTP.nik,
        SYNTHETIC_KTP.nama,
        SYNTHETIC_KK.anggota
      );
      expect(findings).toHaveLength(0);
    });

    it("Fixture 13 [FAIL]: NIK KTP tidak ada sama sekali di KK (nama dan NIK beda)", () => {
      const findings = checkR05AndR06(
        "3201019999990001",
        "ORANG ASING",
        SYNTHETIC_KK.anggota
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].rule_id).toBe("R05");
      expect(findings[0].severity).toBe("blocker");
    });

    it("Fixture 14 [WARN]: Nama ada di KK tapi NIK beda (salah ketik NIK di KK)", () => {
      const kkWithTypoNik: KkData = {
        ...SYNTHETIC_KK,
        anggota: [
          {
            ...SYNTHETIC_KK.anggota[0],
            nik: "3201010105900009", // Berbeda digit terakhir
          },
        ],
      };
      const findings = checkR05AndR06(
        SYNTHETIC_KTP.nik,
        SYNTHETIC_KTP.nama,
        kkWithTypoNik.anggota
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].rule_id).toBe("R06");
      expect(findings[0].severity).toBe("warning");
    });
  });

  // 6. R07: Wilayah RT/RW Normalisasi
  describe("R07 - Kesepakatan Alamat & Normalisasi Zero-Pad RT/RW", () => {
    it("Fixture 15 [PASS]: RT 002 vs 2 dan RW 003 vs 3 sepakat", () => {
      expect(normalizeRtRw("002")).toBe("2");
      expect(normalizeRtRw("2")).toBe("2");
      const findings = checkR07(
        { rt: "002", rw: "003", kelurahan: "Sukamaju", kecamatan: "Cibinong" },
        { rt: "2", rw: "3", kelurahan: "SUKAMAJU", kecamatan: "CIBINONG" },
        true
      );
      expect(findings).toHaveLength(0);
    });

    it("Fixture 16 [FAIL]: Beda RW (RW 003 vs 004) adalah blocker untuk surat domisili", () => {
      const findings = checkR07(
        { rt: "002", rw: "003", kelurahan: "Sukamaju", kecamatan: "Cibinong" },
        { rt: "002", rw: "004", kelurahan: "Sukamaju", kecamatan: "Cibinong" },
        true // surat domisili
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].rule_id).toBe("R07");
      expect(findings[0].severity).toBe("blocker");
    });
  });

  // 7. R08, R09, R10: Biodata
  describe("R08, R09, R10 - Validasi Tanggal Lahir, Gender, dan Status Kawin", () => {
    it("Fixture 17 [FAIL]: Tanggal lahir KTP beda dengan KK", () => {
      const res = checkR08("1990-05-01", "1991-05-01");
      expect(res).not.toBeNull();
      expect(res?.rule_id).toBe("R08");
      expect(res?.severity).toBe("blocker");
    });

    it("Fixture 18 [WARN]: Gender panggilan Hj./Ny. tidak konsisten dengan NIK pria", () => {
      // NIK pria (DD=01), tapi nama tertulis Hj. Fatimah
      const res = checkR09("3201010105900001", "HJ. FATIMAH");
      expect(res).not.toBeNull();
      expect(res?.rule_id).toBe("R09");
      expect(res?.severity).toBe("warning");
    });

    it("Fixture 19 [WARN]: Status kawin KTP (BELUM KAWIN) beda dengan KK (KAWIN)", () => {
      const res = checkR10("BELUM KAWIN", "KAWIN");
      expect(res).not.toBeNull();
      expect(res?.rule_id).toBe("R10");
      expect(res?.severity).toBe("warning");
    });
  });

  // 8. R11: Jenis Dokumen & Pengecualian KTP Baru < 17 Tahun
  describe("R11 - Kelengkapan Dokumen Sesuai Alur", () => {
    it("Fixture 20 [PASS]: Alur KTP baru pemohon <17 tahun tanpa KTP = sah (bukan blocker)", () => {
      const res = checkR11("pengantar_ktp", false, true, true);
      expect(res).toBeNull();
    });

    it("Fixture 21 [FAIL]: Permohonan SKTM tanpa KTP fisik adalah blocker", () => {
      const res = checkR11("sktm", false, true, false);
      expect(res).not.toBeNull();
      expect(res?.rule_id).toBe("R11");
      expect(res?.severity).toBe("blocker");
    });
  });

  // 9. R12 & R13: Foto, Rasio, Kualitas
  describe("R12 & R13 - Validasi Foto dan Kualitas", () => {
    it("Fixture 22 [FAIL]: Foto KTP tertukar dengan dokumen KK atau rasio salah", () => {
      // Foto terdeteksi KK di slot KTP
      const resKind = checkR12("ktp", { detectedKind: "kk", aspectRatio: 1.58 });
      expect(resKind).not.toBeNull();
      expect(resKind?.rule_id).toBe("R12");
      expect(resKind?.severity).toBe("blocker");

      // Rasio foto bujur sangkar (1.0) bukan standar ID-1 (1.585)
      const resRatio = checkR12("ktp", { detectedKind: "ktp", aspectRatio: 1.0 });
      expect(resRatio).not.toBeNull();
      expect(resRatio?.severity).toBe("blocker");
    });

    it("Fixture 23 [WARN]: Foto buram terdeteksi", () => {
      const resBlur = checkR13("ktp", { isBlur: true });
      expect(resBlur).not.toBeNull();
      expect(resBlur?.rule_id).toBe("R13");
      expect(resBlur?.severity).toBe("warning");
    });
  });

  // 10. R14: Duplikat Permohonan 24 Jam
  describe("R14 - Duplikasi Permohonan dalam 24 Jam", () => {
    it("Fixture 24 [WARN]: Permohonan jenis sama untuk NIK sama dalam 2 jam terakhir", () => {
      const res = checkR14(
        SYNTHETIC_KTP.nik,
        "pengantar_ktp",
        [
          {
            nik: SYNTHETIC_KTP.nik,
            letter_type: "pengantar_ktp",
            created_at: new Date(REF_DATE.getTime() - 2 * 3600 * 1000).toISOString(),
          },
        ],
        REF_DATE
      );
      expect(res).not.toBeNull();
      expect(res?.rule_id).toBe("R14");
      expect(res?.severity).toBe("warning");
    });

    it("Fixture 25 [PASS]: Permohonan lebih dari 24 jam yang lalu diizinkan tanpa warning", () => {
      const res = checkR14(
        SYNTHETIC_KTP.nik,
        "pengantar_ktp",
        [
          {
            nik: SYNTHETIC_KTP.nik,
            letter_type: "pengantar_ktp",
            created_at: new Date(REF_DATE.getTime() - 26 * 3600 * 1000).toISOString(),
          },
        ],
        REF_DATE
      );
      expect(res).toBeNull();
    });
  });

  // 11. Integrasi Mesin Aturan Penuh
  describe("Mesin Aturan Lengkap (runVerificationRules)", () => {
    it("Fixture 26 [PASS LENGKAP]: Dokumen sintetis valid lulus 100% tanpa blocker", () => {
      const ctx: VerificationContext = {
        letter_type: "pengantar_ktp",
        ktp: SYNTHETIC_KTP,
        kk: SYNTHETIC_KK,
        photo_meta: {
          ktp_ratio: 1.585,
          ktp_detected_kind: "ktp",
          kk_detected_kind: "kk",
          is_blur: false,
          resolution_ok: true,
        },
      };

      const result = runVerificationRules(ctx, REF_DATE);
      expect(result.isValid).toBe(true);
      expect(result.blockersCount).toBe(0);
      expect(result.findings).toHaveLength(0);
    });
  });
});
