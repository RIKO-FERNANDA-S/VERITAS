import { RuleFinding } from "../types";

/**
 * Normalisasi nomor RT / RW (mis. "002" -> "2", " 03 " -> "3")
 */
export function normalizeRtRw(value: string | undefined | null): string {
  if (!value) return "";
  const cleaned = value.replace(/[^0-9]/g, "");
  if (!cleaned) return value.trim().toUpperCase();
  return String(parseInt(cleaned, 10));
}

export function normalizeAddressText(text: string | undefined | null): string {
  if (!text) return "";
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface AddressData {
  alamat?: string;
  rt?: string;
  rw?: string;
  kelurahan?: string;
  kecamatan?: string;
  kabupaten?: string;
}

/**
 * R07: RT/RW/kel/kec/kab sepakat (`002`=`2`)
 * Menjadi Blocker terutama untuk surat domisili, atau peringatan ketidaksesuaian wilayah.
 */
export function checkR07(
  ktpAddress: AddressData,
  kkAddress: AddressData,
  isDomisili: boolean = false
): RuleFinding[] {
  const findings: RuleFinding[] = [];

  const ktpRt = normalizeRtRw(ktpAddress.rt);
  const kkRt = normalizeRtRw(kkAddress.rt);
  const ktpRw = normalizeRtRw(ktpAddress.rw);
  const kkRw = normalizeRtRw(kkAddress.rw);

  const ktpKel = normalizeAddressText(ktpAddress.kelurahan);
  const kkKel = normalizeAddressText(kkAddress.kelurahan);
  const ktpKec = normalizeAddressText(ktpAddress.kecamatan);
  const kkKec = normalizeAddressText(kkAddress.kecamatan);

  const mismatchList: string[] = [];

  if (ktpRt && kkRt && ktpRt !== kkRt) {
    mismatchList.push(`RT (KTP: ${ktpAddress.rt} vs KK: ${kkAddress.rt})`);
  }
  if (ktpRw && kkRw && ktpRw !== kkRw) {
    mismatchList.push(`RW (KTP: ${ktpAddress.rw} vs KK: ${kkAddress.rw})`);
  }
  if (ktpKel && kkKel && ktpKel !== kkKel) {
    mismatchList.push(`Kelurahan (KTP: ${ktpAddress.kelurahan} vs KK: ${kkAddress.kelurahan})`);
  }
  if (ktpKec && kkKec && ktpKec !== kkKec) {
    mismatchList.push(`Kecamatan (KTP: ${ktpAddress.kecamatan} vs KK: ${kkAddress.kecamatan})`);
  }

  if (mismatchList.length > 0) {
    findings.push({
      id: "R07_ADDRESS_MISMATCH",
      rule_id: "R07",
      field: "alamat",
      severity: isDomisili ? "blocker" : "warning",
      ktp_value: `RT ${ktpAddress.rt}/RW ${ktpAddress.rw}, ${ktpAddress.kelurahan}`,
      kk_value: `RT ${kkAddress.rt}/RW ${kkAddress.rw}, ${kkAddress.kelurahan}`,
      message: `Terdapat ketidaksesuaian wilayah antara KTP dan KK: ${mismatchList.join(", ")}`,
      resolved: false,
    });
  }

  return findings;
}
