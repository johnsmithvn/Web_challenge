import assert from 'node:assert/strict';
import {
  calculateBMI,
  calculateBMR,
  calculateTDEE,
  calculateBodyScore,
  isMeasurementOutlier,
  calculateBodyComposition,
  calculateNavyBodyFat,
  estimateVisceralFatFromWaist,
  weightForBmi,
  calculateMacroTargets,
  BMI_CATEGORIES
} from '../../utils/bodyMetrics.js';

console.log('Testing bodyMetrics pure functions...');

// 1. BMI calculation
{
  const res1 = calculateBMI(64.95, 170);
  assert.equal(res1.bmi, 22.5);
  assert.equal(res1.category.key, BMI_CATEGORIES.NORMAL.key);

  const res2 = calculateBMI(50, 175);
  assert.equal(res2.bmi, 16.3);
  assert.equal(res2.category.key, BMI_CATEGORIES.UNDERWEIGHT.key);

  const res3 = calculateBMI(90, 170);
  assert.equal(res3.bmi, 31.1);
  assert.equal(res3.category.key, BMI_CATEGORIES.OBESE.key);

  // Chuẩn WHO Á Đông: 23.0 - 24.9 là Thừa cân
  const resAsianOverweight = calculateBMI(69.5, 170);
  assert.equal(resAsianOverweight.bmi, 24.0);
  assert.equal(resAsianOverweight.category.key, BMI_CATEGORIES.OVERWEIGHT.key);
  console.log('  ✓ calculateBMI OK (WHO Asian scale verified)');
}

// 2. BMR calculation (Mifflin-St Jeor)
{
  // Male: 64.95kg, 170cm, 26 years old -> 10*64.95 + 6.25*170 - 5*26 + 5 = 649.5 + 1062.5 - 130 + 5 = 1587
  const bmrMale = calculateBMR(65, 170, 26, 'male');
  assert.ok(bmrMale >= 1580 && bmrMale <= 1595, `BMR male should be ~1587, got ${bmrMale}`);

  // Female: 50kg, 160cm, 25 years old -> 10*50 + 6.25*160 - 5*25 - 161 = 500 + 1000 - 125 - 161 = 1214
  const bmrFemale = calculateBMR(50, 160, 25, 'female');
  assert.ok(bmrFemale >= 1210 && bmrFemale <= 1220, `BMR female should be ~1214, got ${bmrFemale}`);
  console.log('  ✓ calculateBMR OK');
}

// 3. TDEE calculation
{
  const bmr = 1540;
  const tdeeSedentary = calculateTDEE(bmr, 'sedentary');
  assert.equal(tdeeSedentary, Math.round(1540 * 1.2));

  const tdeeModerate = calculateTDEE(bmr, 'moderate');
  assert.equal(tdeeModerate, Math.round(1540 * 1.55));
  console.log('  ✓ calculateTDEE OK');
}

// 4. Body Score
{
  const scoreHealthy = calculateBodyScore({ bmi: 22.5, bodyFatPct: 17.2, skeletalMuscleKg: 29.8, visceralFat: 4 });
  assert.ok(scoreHealthy >= 80 && scoreHealthy <= 90, `Score should be healthy (~84-85), got ${scoreHealthy}`);
  console.log('  ✓ calculateBodyScore OK');
}

// 5. Outlier detection
{
  const recentWeights = [65.0, 64.9, 65.1, 64.95];
  assert.equal(isMeasurementOutlier(65.2, recentWeights, 1.5), false);
  assert.equal(isMeasurementOutlier(66.8, recentWeights, 1.5), true); // evening or fluctuation
  console.log('  ✓ isMeasurementOutlier OK');
}

// 6. Body composition
{
  const comp = calculateBodyComposition(65.0, 15.0, 58.0, 2.8);
  assert.equal(comp.fatKg, 9.75);
  assert.equal(comp.waterKg, 37.7);
  assert.equal(comp.boneKg, 2.8);
  assert.ok(comp.proteinKg > 0);
  assert.equal(Number((comp.fatKg + comp.waterKg + comp.boneKg + comp.proteinKg).toFixed(1)), 65.0);
  assert.equal(comp.isEstimated, false);
  // Thiếu số đo nước/khoáng xương -> không tự điền tỷ lệ mặc định
  assert.equal(calculateBodyComposition(65.0, 15.0, null, null), null);
  assert.equal(calculateBodyComposition(65.0, null, 58.0, 2.8), null);
  console.log('  ✓ calculateBodyComposition OK');
}

// 7. US Navy Body Fat calculation
{
  // Male: 175cm, waist 80cm, neck 38cm
  const fatMale = calculateNavyBodyFat('male', 175, 80, 38);
  assert.equal(fatMale, 12.9, `US Navy male body fat should be 12.9%, got ${fatMale}`);

  // Female: 165cm, waist 70cm, neck 32cm, hip 95cm
  const fatFemale = calculateNavyBodyFat('female', 165, 70, 32, 95);
  assert.ok(fatFemale >= 20 && fatFemale <= 28, `US Navy female body fat should be ~22-26%, got ${fatFemale}`);
  console.log('  ✓ calculateNavyBodyFat OK');
}

// 8. Visceral fat estimation from Waist-to-Height Ratio
{
  // 175cm, waist 76cm -> WHtR = 76/175 = 0.43 -> level 3 (Tiêu chuẩn)
  const viscHealthy = estimateVisceralFatFromWaist(76, 175);
  assert.ok(viscHealthy.level <= 5);
  assert.equal(viscHealthy.status, 'Tiêu chuẩn (Lành mạnh)');

  // 175cm, waist 105cm -> WHtR = 105/175 = 0.60 -> level 11 (Nguy cơ cao)
  const viscHigh = estimateVisceralFatFromWaist(105, 175);
  assert.ok(viscHigh.level >= 9);
  console.log('  ✓ estimateVisceralFatFromWaist OK');
}

// 9. weightForBmi & calculateMacroTargets
{
  assert.equal(weightForBmi(22.9, 170), 66.2);
  assert.equal(weightForBmi(18.5, null), null);

  assert.equal(calculateMacroTargets(null, 70), null);
  const m = calculateMacroTargets(2500, 70);
  assert.equal(m.kcal, 2500);
  assert.equal(m.protein, 140); // 2 g/kg
  assert.equal(m.fat, 69); // 25% kcal / 9
  assert.equal(m.carbs, Math.round((2500 - 140 * 4 - 69 * 9) / 4));
  // Không có cân nặng -> đạm 30% năng lượng
  assert.equal(calculateMacroTargets(2000).protein, 150);
  console.log('  ✓ weightForBmi / calculateMacroTargets OK');
}

console.log('ALL BODY METRICS TESTS PASSED!');
