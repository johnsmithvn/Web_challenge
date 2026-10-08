/**
 * Pure calculation functions for Body Biometrics & Composition
 * Follows Mifflin-St Jeor equation and standard WHO BMI scales
 */

export const BMI_CATEGORIES = {
  UNDERWEIGHT: { key: 'underweight', label: 'Gầy (Thiếu cân)', color: '#3A82F6', min: 0, max: 18.5 },
  NORMAL: { key: 'normal', label: 'Bình thường (Chuẩn Á Đông)', color: '#2F8A57', min: 18.5, max: 22.9 },
  OVERWEIGHT: { key: 'overweight', label: 'Thừa cân (Nguy cơ)', color: '#B57A12', min: 23.0, max: 24.9 },
  OBESE: { key: 'obese', label: 'Béo phì', color: '#C23B22', min: 25.0, max: 100 }
};

export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,      // Ít vận động, ngồi văn phòng
  light: 1.375,        // Tập nhẹ 1-3 ngày/tuần
  moderate: 1.55,      // Tập vừa 3-5 ngày/tuần
  active: 1.725,       // Tập nặng 6-7 ngày/tuần
  very_active: 1.9     // Lao động nặng hoặc VĐV
};

/**
 * Calculate BMI given weight (kg) and height (cm)
 * Standard WHO Asian: Normal 18.5 - 22.9, Overweight 23.0 - 24.9, Obese >= 25.0
 */
export function calculateBMI(weightKg, heightCm) {
  if (!weightKg || !heightCm || heightCm <= 0) return { bmi: 0, category: BMI_CATEGORIES.NORMAL };
  const heightM = heightCm / 100;
  const bmi = Number((weightKg / (heightM * heightM)).toFixed(1));

  let category = BMI_CATEGORIES.NORMAL;
  if (bmi < 18.5) category = BMI_CATEGORIES.UNDERWEIGHT;
  else if (bmi <= 22.9) category = BMI_CATEGORIES.NORMAL;
  else if (bmi < 25.0) category = BMI_CATEGORIES.OVERWEIGHT;
  else category = BMI_CATEGORIES.OBESE;

  return { bmi, category };
}

/**
 * Calculate Basal Metabolic Rate (BMR) using Mifflin-St Jeor formula
 * Returns null if data is insufficient (no fake numbers)
 */
export function calculateBMR(weightKg, heightCm, ageYears, gender = 'male') {
  if (!weightKg || !heightCm || !ageYears) return null;
  // Men: 10*weight + 6.25*height - 5*age + 5
  // Women: 10*weight + 6.25*height - 5*age - 161
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  const bmr = gender === 'female' ? base - 161 : base + 5;
  return Math.round(bmr);
}

/**
 * Calculate Total Daily Energy Expenditure (TDEE)
 */
export function calculateTDEE(bmr, activityLevel = 'moderate') {
  if (!bmr) return null;
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || 1.55;
  return Math.round(bmr * multiplier);
}

/**
 * Calculate Overall Body Score (0-100) based on multiple metrics
 */
export function calculateBodyScore({ bmi, bodyFatPct, skeletalMuscleKg, visceralFat }) {
  if (!bmi) return null;
  let score = 85; // baseline healthy score

  // BMI penalty if far from ideal 20-22.5
  if (bmi < 18.5 || bmi > 23.0) {
    score -= Math.min(15, Math.abs(bmi - 21.5) * 2.5);
  }

  // Khối lượng cơ: thưởng điểm nếu đạt tỷ lệ cơ tốt
  if (skeletalMuscleKg && skeletalMuscleKg >= 28) {
    score += 2;
  }

  // Body fat penalty (healthy 14-20% for men, 20-28% for women)
  if (bodyFatPct) {
    if (bodyFatPct > 22) score -= Math.min(15, (bodyFatPct - 20) * 1.5);
    else if (bodyFatPct < 10) score -= 5;
  }

  // Visceral fat penalty (standard is 1-9)
  if (visceralFat && visceralFat > 9) {
    score -= Math.min(15, (visceralFat - 9) * 2);
  }

  return Math.max(40, Math.min(100, Math.round(score)));
}

/**
 * Detect if a weight reading is an outlier compared to recent rolling average
 */
export function isMeasurementOutlier(newWeight, recentWeights = [], maxDelta = 1.6) {
  if (!recentWeights || recentWeights.length === 0) return false;
  const avg = recentWeights.reduce((a, b) => a + b, 0) / recentWeights.length;
  return Math.abs(newWeight - avg) >= maxDelta;
}

/**
 * Calculate 4-part body composition (Water, Protein, Fat, Bone mineral)
 * Sum of parts equals total weight
 */
export function calculateBodyComposition(weightKg, bodyFatPct, waterPct, boneMassKg) {
  if (!weightKg || weightKg <= 0) return null;
  const w = Number(weightKg);
  const fat = bodyFatPct ? Number((w * (bodyFatPct / 100)).toFixed(2)) : Number((w * 0.15).toFixed(2));
  const water = waterPct ? Number((w * (waterPct / 100)).toFixed(2)) : Number((w * 0.589).toFixed(2));
  const bone = boneMassKg ? Number(Number(boneMassKg).toFixed(2)) : Number((w * 0.0434).toFixed(2));
  const protein = Math.max(1, Number((w - fat - water - bone).toFixed(2)));
  return {
    waterKg: water,
    proteinKg: protein,
    fatKg: fat,
    boneKg: bone,
    totalKg: w,
    isEstimated: !bodyFatPct
  };
}

/**
 * Calculate Body Fat % using US Navy Circumference Method
 * @param {string} gender 'male' | 'female'
 * @param {number} heightCm Height in cm
 * @param {number} waistCm Waist circumference in cm (at navel for men, narrowest for women)
 * @param {number} neckCm Neck circumference in cm
 * @param {number} [hipCm=0] Hip circumference in cm (required for women)
 * @returns {number|null} Estimated body fat percentage rounded to 1 decimal place
 */
export function calculateNavyBodyFat(gender, heightCm, waistCm, neckCm, hipCm = 0) {
  if (!gender || !heightCm || !waistCm || !neckCm) return null;
  const h = Number(heightCm);
  const w = Number(waistCm);
  const n = Number(neckCm);
  if (h <= 0 || w <= 0 || n <= 0) return null;

  if (gender === 'male') {
    if (w <= n) return null;
    // Canonical Hodgdon & Beckett equation for Men:
    const bd = 1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(h);
    const fat = (495 / bd) - 450;
    return Number(Math.max(3, Math.min(50, fat)).toFixed(1));
  } else {
    const hip = Number(hipCm);
    if (hip <= 0 || (w + hip) <= n) return null;
    // Canonical Hodgdon & Beckett equation for Women:
    const bd = 1.29579 - 0.35004 * Math.log10(w + hip - n) + 0.22100 * Math.log10(h);
    const fat = (495 / bd) - 450;
    return Number(Math.max(8, Math.min(60, fat)).toFixed(1));
  }
}

/**
 * Estimate Visceral Fat level (1-20 scale) from Waist-to-Height Ratio (WHtR)
 * @param {number} waistCm Waist in cm
 * @param {number} heightCm Height in cm
 * @returns {{ level: number, status: string, isEstimated: boolean, whtr: number }|null}
 */
export function estimateVisceralFatFromWaist(waistCm, heightCm) {
  if (!waistCm || !heightCm || heightCm <= 0) return null;
  const whtr = Number(waistCm) / Number(heightCm);
  let level = 5;
  let status = 'Tiêu chuẩn';

  if (whtr < 0.43) {
    level = 2;
    status = 'Thấp';
  } else if (whtr < 0.50) {
    level = Math.round(3 + ((whtr - 0.43) / 0.07) * 2);
    status = 'Tiêu chuẩn (Lành mạnh)';
  } else if (whtr < 0.56) {
    level = Math.round(6 + ((whtr - 0.50) / 0.06) * 2);
    status = 'Cận nguy cơ';
  } else if (whtr < 0.62) {
    level = Math.round(9 + ((whtr - 0.56) / 0.06) * 3);
    status = 'Nguy cơ cao';
  } else {
    level = Math.min(20, Math.round(13 + (whtr - 0.62) * 20));
    status = 'Rất cao (Nguy hiểm)';
  }

  return {
    level,
    status,
    isEstimated: true,
    whtr: Number(whtr.toFixed(2))
  };
}
