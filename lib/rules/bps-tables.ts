/**
 * Tabel Prefiks Wilayah BPS (Offline)
 * Format NIK:
 * Digit 1-2: Kode Provinsi (11-94)
 * Digit 3-4: Kode Kabupaten/Kota (01-99)
 * Digit 5-6: Kode Kecamatan (01-99)
 */

export const VALID_PROVINCES: Record<string, string> = {
  "11": "ACEH",
  "12": "SUMATERA UTARA",
  "13": "SUMATERA BARAT",
  "14": "RIAU",
  "15": "JAMBI",
  "16": "SUMATERA SELATAN",
  "17": "BENGKULU",
  "18": "LAMPUNG",
  "19": "KEPULAUAN BANGKA BELITUNG",
  "21": "KEPULAUAN RIAU",
  "31": "DKI JAKARTA",
  "32": "JAWA BARAT",
  "33": "JAWA TENGAH",
  "34": "DAERAH ISTIMEWA YOGYAKARTA",
  "35": "JAWA TIMUR",
  "36": "BANTEN",
  "51": "BALI",
  "52": "NUSA TENGGARA BARAT",
  "53": "NUSA TENGGARA TIMUR",
  "61": "KALIMANTAN BARAT",
  "62": "KALIMANTAN TENGAH",
  "63": "KALIMANTAN SELATAN",
  "64": "KALIMANTAN TIMUR",
  "65": "KALIMANTAN UTARA",
  "71": "SULAWESI UTARA",
  "72": "SULAWESI TENGAH",
  "73": "SULAWESI SELATAN",
  "74": "SULAWESI TENGGARA",
  "75": "GORONTALO",
  "76": "SULAWESI BARAT",
  "81": "MALUKU",
  "82": "MALUKU UTARA",
  "91": "PAPUA",
  "92": "PAPUA BARAT",
  "93": "PAPUA SELATAN",
  "94": "PAPUA TENGAH",
  "95": "PAPUA PEGUNUNGAN",
  "96": "PAPUA BARAT DAYA",
};

/**
 * Validasi apakah 6 digit pertama wilayah (Provinsi + Kab/Kota + Kec) terdaftar
 * Memeriksa validitas kode provinsi dan rentang kabupaten/kota (01-99) serta kecamatan (01-99).
 */
export function isValidRegionCode(code6: string): boolean {
  if (!/^\d{6}$/.test(code6)) return false;
  const prov = code6.substring(0, 2);
  const kab = parseInt(code6.substring(2, 4), 10);
  const kec = parseInt(code6.substring(4, 6), 10);

  // Cek apakah provinsi terdaftar
  if (!VALID_PROVINCES[prov]) return false;

  // Kode kab/kota harus antara 01 sampai 79 (kabupaten) atau 71 sampai 99 (kota)
  if (kab < 1 || kab > 99) return false;

  // Kode kecamatan harus minimal 01
  if (kec < 1 || kec > 99) return false;

  return true;
}
