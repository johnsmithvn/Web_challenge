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
