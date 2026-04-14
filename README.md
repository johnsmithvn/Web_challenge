# Thử Thách Vượt Lười — v1.0.0

> Kỷ Luật = Hệ Thống, Không Phải Ý Chí

## Cách chạy từ đầu (Clean Machine)

```bash
# 1. Clone / copy thư mục vuu-liem/
cd vuu-liem

# 2. Cài dependencies
npm install

# 3. Chạy dev server
npm run dev
# → http://localhost:5173
```

## Cấu trúc

```
src/
  components/     ← UI components (Hero, Navbar, Tracker, ...)
  pages/          ← Route pages (Landing, Tracker, Team, Dashboard)
  hooks/          ← useHabitStore (localStorage)
  styles/         ← CSS design system
```

## Pages

| URL          | Mô tả |
|--------------|-------|
| `/`          | Landing page 7 sections |
| `/tracker`   | Habit tracker + heatmap |
| `/team`      | Team Mode (mock demo) |
| `/dashboard` | Analytics + insights |

## Tính năng v1.0.0

- ✅ Landing page 7 sections đầy đủ
- ✅ Habit tracker (T2→CN, 3 tuần, based on PDF)
- ✅ Streak system + Badge (Lấy Đà / Bứt Phá / Hoàn Thành)
- ✅ 28-day heatmap
- ✅ Day-of-week bar chart
- ✅ Dashboard insights tự động
- ✅ Team Mode (demo + invite code)
- ✅ Countdown timer pricing
- ✅ Dark mode glassmorphism design

## Roadmap

- **v2.0.0** — Firebase Auth + Firestore + Real Team Mode
- **v3.0.0** — AI Coach (OpenAI), Leaderboard, Push notifications
