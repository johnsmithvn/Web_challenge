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

// 2. Verify all 4 Body Migrations exist and satisfy security policies
const m1Path = path.join(rootDir, 'supabase/migrations/20261008000000_body_workout_v6_22_0.sql');
const m2Path = path.join(rootDir, 'supabase/migrations/20261008000001_body_biometrics_v6_22_0.sql');
const m3Path = path.join(rootDir, 'supabase/migrations/20261008000002_body_nutrition_checkin_v6_22_0.sql');
const m4Path = path.join(rootDir, 'supabase/migrations/20261009000000_body_exercise_videos_v6_22_0.sql');

assert.ok(fs.existsSync(m1Path), 'Workout migration must exist');
assert.ok(fs.existsSync(m2Path), 'Biometrics migration must exist');
assert.ok(fs.existsSync(m3Path), 'Nutrition migration must exist');
assert.ok(fs.existsSync(m4Path), 'Exercise videos migration must exist');

const m1Content = fs.readFileSync(m1Path, 'utf8');
const m2Content = fs.readFileSync(m2Path, 'utf8');
const m3Content = fs.readFileSync(m3Path, 'utf8');
const m4Content = fs.readFileSync(m4Path, 'utf8');

// Bản sao trong data/ phải giống hệt bản trong supabase/migrations (runbook hosted dùng data/)
assert.equal(
  fs.readFileSync(path.join(rootDir, 'data/migration_v6.22.0_body_exercise_videos.sql'), 'utf8'),
  m4Content,
  'data/ copy of exercise videos migration must match'
);

// Check security invariants: RLS, REVOKE anon, GRANT authenticated
[
  { name: 'Workout Migration', content: m1Content, tables: ['body_routines', 'body_routine_items', 'body_workout_sessions', 'body_workout_sets'] },
  { name: 'Biometrics Migration', content: m2Content, tables: ['body_measurements', 'body_profiles'] },
  { name: 'Nutrition Migration', content: m3Content, tables: ['body_meal_logs', 'body_saved_meals', 'body_water_logs', 'body_weekly_checkins'] },
  { name: 'Exercise Videos Migration', content: m4Content, tables: ['body_exercise_videos'] }
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

// 4. Hợp đồng luồng buổi tập (chặn tái phát các lỗi đã sửa)
const read = file => fs.readFileSync(path.join(rootDir, file), 'utf8');
const overviewSrc = read('src/components/body/OverviewScreen.jsx');
const liveSrc = read('src/components/body/LiveSessionScreen.jsx');
const bodyPageSrc = read('src/pages/BodyPage.jsx');

// Tổng quan → Bắt đầu phải truyền dayInfo { weekday, name }, không phải mảng bài (từng ra màn "không có bài")
assert.ok(!/onStartSession\??\.?\(todayRoutineItems\)/.test(overviewSrc), 'Overview must not pass the routine item array as dayInfo');
assert.ok(/weekday: todayWeekday/.test(overviewSrc), 'Overview start must pass today weekday');
// Tổng quan dùng chung dữ liệu tập của BodyPage, không mở instance useWorkouts thứ hai
assert.ok(!/import \{ useWorkouts \}/.test(overviewSrc), 'Overview must read workout data from BodyPage props');

// Mở lại màn tập luôn khôi phục set đã ghi của buổi (không phụ thuộc cờ isResume)
assert.ok(!/isResume/.test(liveSrc) && !/isResume/.test(bodyPageSrc), 'Live screen must always restore logged sets');
// Set tính giây không tự chạy khi tab đang ẩn
assert.ok(/visibilityState !== 'hidden'/.test(liveSrc), 'Timed set must not auto-start while the page is hidden');

// Có buổi dở: tab Lộ trình chuyển sang màn tập, và bắt đầu buổi mới luôn hỏi xác nhận
assert.ok(/routeScreen === 'routine' && liveSession/.test(bodyPageSrc), 'Routine tab must redirect to live session while a session is in progress');
assert.ok(/if \(liveSession\) \{\s*setPendingStart/.test(bodyPageSrc), 'Starting a new session while one is in progress must ask first');

console.log('  ✓ Live session flow contracts OK');
console.log('ALL BODY CONTRACT TESTS PASSED!\n');
