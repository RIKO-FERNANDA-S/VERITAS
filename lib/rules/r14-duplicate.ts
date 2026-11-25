import { LetterType, RuleFinding } from "../types";

export interface ExistingSubmission {
  nik: string;
  letter_type: LetterType;
  created_at: string;
}

/**
 * R14: Duplikat NIK + jenis dalam 24 jam
 * Severity: Warning (mencegah kirim ganda yang tidak disengaja)
 */
export function checkR14(
  currentNik: string,
  currentLetterType: LetterType,
  existingSubmissions: ExistingSubmission[] = [],
  currentTime: Date = new Date()
): RuleFinding | null {
  if (!currentNik || !existingSubmissions.length) return null;

  const twentyFourHoursMs = 24 * 60 * 60 * 1000;
  const nowMs = currentTime.getTime();

  const duplicate = existingSubmissions.find((sub) => {
    if (sub.nik !== currentNik || sub.letter_type !== currentLetterType) return false;
    const subTime = new Date(sub.created_at).getTime();
    return nowMs - subTime < twentyFourHoursMs && nowMs >= subTime;
  });

  if (duplicate) {
    return {
      id: "R14_DUPLICATE_SUBMISSION_24H",
      rule_id: "R14",
      field: "nik",
      severity: "warning",
      ktp_value: currentNik,
      message: `Terdapat permohonan surat dengan jenis yang sama untuk NIK ini dalam kurun waktu 24 jam terakhir`,
      resolved: false,
    };
  }

  return null;
}
