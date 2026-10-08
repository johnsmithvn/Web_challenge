import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../../');

console.log('Testing Body module contracts and resources...');

// 1. Verify JSON static resources
const exercisesPath = path.join(rootDir, 'src/data/body-exercises.json');
const musclesPath = path.join(rootDir, 'src/data/body-muscles.json');
const templatesPath = path.join(rootDir, 'src/data/body-routine-templates.json');

assert.ok(fs.existsSync(exercisesPath), 'body-exercises.json must exist');
assert.ok(fs.existsSync(musclesPath), 'body-muscles.json must exist');
assert.ok(fs.existsSync(templatesPath), 'body-routine-templates.json must exist');

const exercises = JSON.parse(fs.readFileSync(exercisesPath, 'utf8'));
const muscles = JSON.parse(fs.readFileSync(musclesPath, 'utf8'));
const templates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));

assert.ok(Array.isArray(exercises) && exercises.length >= 20, 'At least 20 exercises present');
assert.ok(Object.keys(muscles).length === 14, 'Exactly 14 anatomical muscles present');
assert.ok(Array.isArray(templates) && templates.length >= 3, 'At least 3 routine templates present');

// Verify exercise references valid primary muscles
exercises.forEach(ex => {
  assert.ok(ex.key && ex.name, `Exercise must have key and name: ${JSON.stringify(ex)}`);
  assert.ok(muscles[ex.primary], `Primary muscle '${ex.primary}' must exist in muscles dictionary for exercise ${ex.name}`);
});

console.log('  ✓ Static JSON data integrity OK');

// 2. Verify all 3 Body Migrations exist and satisfy security policies
const m1Path = path.join(rootDir, 'supabase/migrations/20261008000000_body_workout_v6_22_0.sql');
const m2Path = path.join(rootDir, 'supabase/migrations/20261008000001_body_biometrics_v6_22_0.sql');
const m3Path = path.join(rootDir, 'supabase/migrations/20261008000002_body_nutrition_checkin_v6_22_0.sql');

assert.ok(fs.existsSync(m1Path), 'Workout migration must exist');
assert.ok(fs.existsSync(m2Path), 'Biometrics migration must exist');
assert.ok(fs.existsSync(m3Path), 'Nutrition migration must exist');

const m1Content = fs.readFileSync(m1Path, 'utf8');
const m2Content = fs.readFileSync(m2Path, 'utf8');
const m3Content = fs.readFileSync(m3Path, 'utf8');

// Check security invariants: RLS, REVOKE anon, GRANT authenticated
[
  { name: 'Workout Migration', content: m1Content, tables: ['body_routines', 'body_routine_items', 'body_workout_sessions', 'body_workout_sets'] },
  { name: 'Biometrics Migration', content: m2Content, tables: ['body_measurements', 'body_profiles'] },
  { name: 'Nutrition Migration', content: m3Content, tables: ['body_meal_logs', 'body_saved_meals', 'body_water_logs', 'body_weekly_checkins'] }
].forEach(suite => {
  suite.tables.forEach(table => {
    assert.ok(suite.content.includes(`ENABLE ROW LEVEL SECURITY`), `${suite.name} must enable RLS`);
    assert.ok(suite.content.includes(`REVOKE ALL ON public.${table} FROM anon, public`), `${table} must revoke all from anon`);
    assert.ok(suite.content.includes(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO authenticated`), `${table} must grant to authenticated`);
  });
});

console.log('  ✓ Security & RLS migration policies OK');

// 3. Verify Components and Hooks existence
const requiredFiles = [
  'src/hooks/useWorkouts.js',
  'src/hooks/useBiometrics.js',
  'src/hooks/useNutrition.js',
  'src/components/body/OverviewScreen.jsx',
  'src/components/body/RoutineScreen.jsx',
  'src/components/body/LiveSessionScreen.jsx',
  'src/components/body/WorkoutHistoryScreen.jsx',
  'src/components/body/BiometricsScreen.jsx',
  'src/components/body/NutritionScreen.jsx',
  'src/components/body/MuscleMapScreen.jsx',
  'src/components/body/MuscleBodyCanvas.jsx',
  'src/components/body/ExerciseLibraryScreen.jsx',
  'src/components/body/ExerciseVideoPlayer.jsx',
  'src/components/body/MuscleAnatomy2D.jsx',
  'src/components/body/ExerciseDetailModal.jsx',
  'src/pages/BodyPage.jsx'
];

requiredFiles.forEach(file => {
  const filePath = path.join(rootDir, file);
  assert.ok(fs.existsSync(filePath), `Required Body file must exist: ${file}`);
});

console.log(`  ✓ All ${requiredFiles.length} Body component & hook files present OK`);
console.log('ALL BODY CONTRACT TESTS PASSED!\n');
