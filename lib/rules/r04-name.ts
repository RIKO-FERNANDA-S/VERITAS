import { RuleFinding } from "../types";

/**
 * Menghitung jarak Levenshtein antara dua string
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Normalisasi nama:
 * 1. Mengubah ke huruf kapital
 * 2. Menghapus gelar depan/belakang umum (H., HJ., DRS., DRA., IR., PROF., DR., S.PD, S.KOM, M.M, dll)
 * 3. Menghapus partikel bin / binti
 * 4. Merapikan tanda baca dan spasi ganda
 */
export function normalizeName(name: string): string {
  if (!name) return "";

  let cleaned = name.toUpperCase().trim();

  // Daftar gelar depan & belakang umum di Indonesia
  // Gunakan (?:^|\s+) dan (?:\.|\s+|$) agar mencakup titik tanpa bergantung \b setelah titik
  const titles = [
    /(?:^|\s+)(?:H|HAJI|HJ|HAJJAH|NY|NYONYA|TN|TUAN|NN|NONA)(?:\.|\s+|$)/gi,
    /(?:^|\s+)(?:DRS|DRA|IR|PROF|DR|DRG|K\s*H|USTADZ|UST)(?:\.|\s+|$)/gi,
    /(?:^|\s+)(?:S\.[A-Z]{1,4}|M\.[A-Z]{1,4}|B\.SC|M\.SC|PH\.D|S[A-Z]{1,4}|M[A-Z]{1,4})(?:\.|\s+|$)/gi,
  ];

  for (const pattern of titles) {
    cleaned = cleaned.replace(pattern, " ");
  }

  // Hapus pola bin / binti beserta nama ayah setelahnya
  cleaned = cleaned.replace(/(?:^|\s+)(?:BIN|BINTI)\s+[A-Z]+/gi, " ");

  // Hapus karakter non-alfanumerik kecuali spasi
  cleaned = cleaned.replace(/[^A-Z0-9\s]/g, " ");

  // Normalisasi spasi berlebih
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}

/**
 * R04: Nama KTP ≡ KK setelah normalisasi gelar dan bin/binti
 * Typo 1-2 karakter -> severity warning
 * Perbedaan > 2 karakter -> severity blocker
 */
export function checkR04(ktpName: string, kkName: string): RuleFinding | null {
  const normKtp = normalizeName(ktpName);
  const normKk = normalizeName(kkName);

  if (normKtp === normKk) {
    return null; // Identik sempurna setelah normalisasi
  }

  const distance = levenshteinDistance(normKtp, normKk);

  if (distance <= 2) {
    return {
      id: "R04_NAME_TYPO_WARNING",
      rule_id: "R04",
      field: "nama",
      severity: "warning",
      ktp_value: ktpName,
      kk_value: kkName,
      message: `Terdapat sedikit perbedaan penulisan nama antara KTP dan KK (selisih ${distance} karakter)`,
      resolved: false,
    };
  }

  return {
    id: "R04_NAME_MISMATCH_BLOCKER",
    rule_id: "R04",
    field: "nama",
    severity: "blocker",
    ktp_value: ktpName,
    kk_value: kkName,
    message: `Nama pada KTP berbeda signifikan dengan nama pada KK ("${normKtp}" vs "${normKk}")`,
    resolved: false,
  };
}
