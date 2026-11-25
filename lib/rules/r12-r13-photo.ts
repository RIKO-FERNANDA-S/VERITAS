import { RuleFinding } from "../types";

export interface PhotoMeta {
  detectedKind?: string; // "ktp" | "kk" | "other"
  aspectRatio?: number; // width / height
  isBlur?: boolean;
  resolutionOk?: boolean;
  hasGlare?: boolean;
}

/**
 * R12: Foto benar jenisnya (vision) + rasio standar ID-1 (~1.585) untuk KTP
 * Blocker jika foto tertukar atau bukan jenis yang tepat.
 */
export function checkR12(expectedDoc: "ktp" | "kk", meta?: PhotoMeta | null): RuleFinding | null {
  if (!meta) return null;

  // 1. Cek jenis deteksi dokumen
  if (meta.detectedKind && meta.detectedKind !== "unknown") {
    if (meta.detectedKind !== expectedDoc) {
      return {
        id: "R12_WRONG_DOCUMENT_TYPE",
        rule_id: "R12",
        field: `foto_${expectedDoc}`,
        severity: "blocker",
        ktp_value: meta.detectedKind,
        kk_value: expectedDoc,
        message: `Foto yang diunggah terdeteksi sebagai ${meta.detectedKind.toUpperCase()}, seharusnya ${expectedDoc.toUpperCase()}`,
        resolved: false,
      };
    }
  }

  // 2. Untuk KTP, periksa rasio aspek (ID-1 ISO/IEC 7810 adalah 85.60 mm × 53.98 mm ≈ 1.5858)
  if (expectedDoc === "ktp" && meta.aspectRatio) {
    // Berikan toleransi rotasi / crop wajar (misal 1.35 - 1.85)
    // Jika rasio vertikal (< 1), pengguna mungkin mengunggah portrait
    const ratio = meta.aspectRatio > 1 ? meta.aspectRatio : 1 / meta.aspectRatio;
    if (ratio < 1.3 || ratio > 1.9) {
      return {
        id: "R12_INVALID_KTP_ASPECT_RATIO",
        rule_id: "R12",
        field: "foto_ktp",
        severity: "blocker",
        ktp_value: ratio.toFixed(2),
        message: `Rasio foto KTP tidak sesuai standar kartu identitas (${ratio.toFixed(2)}, standar ~1.585)`,
        resolved: false,
      };
    }
  }

  return null;
}

/**
 * R13: Kualitas foto (resolusi, blur, silau)
 * Severity: Warning
 */
export function checkR13(docType: "ktp" | "kk", meta?: PhotoMeta | null): RuleFinding | null {
  if (!meta) return null;

  if (meta.isBlur) {
    return {
      id: "R13_BLURRY_PHOTO",
      rule_id: "R13",
      field: `foto_${docType}`,
      severity: "warning",
      message: `Kualitas foto ${docType.toUpperCase()} terdeteksi buram/kurang tajam`,
      resolved: false,
    };
  }

  if (meta.resolutionOk === false) {
    return {
      id: "R13_LOW_RESOLUTION",
      rule_id: "R13",
      field: `foto_${docType}`,
      severity: "warning",
      message: `Resolusi foto ${docType.toUpperCase()} terlalu rendah untuk pembacaan OCR optimal`,
      resolved: false,
    };
  }

  if (meta.hasGlare) {
    return {
      id: "R13_PHOTO_GLARE",
      rule_id: "R13",
      field: `foto_${docType}`,
      severity: "warning",
      message: `Terdapat pantulan cahaya (silau) pada foto ${docType.toUpperCase()}`,
      resolved: false,
    };
  }

  return null;
}
