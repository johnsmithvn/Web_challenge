# TEAM MODE v3 — Design Document

## Vấn đề với thiết kế cũ
- `teams` chỉ có `member1_id` + `member2_id` → giới hạn 2 người cứng
- Không track tuần cá nhân của từng user
- Rules không có approval flow

---

## 1. Team Size — Nhóm N người

### Thay đổi DB schema

**Cũ:**
```sql
teams: member1_id, member2_id  -- giới hạn 2 người
```

**Mới: Many-to-Many**
```sql
-- Team là container
teams (id, name, invite_code, max_members, status, created_by, ...)

-- Bảng junction: ai đang trong team nào
team_members (
  id, team_id, user_id,
  role    TEXT  -- 'owner' | 'member'
  joined_at TIMESTAMPTZ
)
```

### Team size options
| Size | Tên | Logic check tuần 2 |
|------|-----|-------------------|
| 2 người | Duo | A check B, B check A |
| 3 người | Trio | A check B+C, B check A+C, C check A+B |
| 4+ người | Squad | Mỗi người check cho toàn bộ người còn lại |

> **Rule tuần 2**: Bất kỳ ai trong team có thể check cho bạn.
> Cần **ít nhất 1 người khác** trong team check = considered valid.

---

## 2. Week Tracking — Tuần theo từng User

### Concept
Mỗi user có lộ trình 21 ngày **độc lập**. Tuần của bạn ≠ tuần của teammate.

### DB: User Program
```sql
user_programs (
  id           UUID PK
  user_id      UUID FK profiles
  started_at   DATE NOT NULL          -- ngày user tự bắt đầu
  current_week SMALLINT DEFAULT 1     -- 1 / 2 / 3
  reset_count  INT DEFAULT 0          -- số lần restart
  status       TEXT                   -- 'active' | 'completed' | 'paused'
  created_at   TIMESTAMPTZ
)
-- 1 active program per user at a time
```

### Tính week_num
```
current_week = CEIL((today - started_at + 1) / 7)
Clamp: 1–3. Nếu > 21 ngày → status = 'completed'
```

### Kịch bản: User A (tuần 2) ghép với User B (mới – tuần 1)

**2 options khi join:**

```
Option A — Sync lại từ đầu
  → Cả 2 reset started_at = today
  → Cả 2 bắt đầu tuần 1 cùng nhau
  → Data cũ vẫn giữ (không xóa), chỉ program mới

Option B — Tiếp tục độc lập
  → A tiếp tục tuần 2 (cần B check cho A)
  → B bắt đầu tuần 1 (tự check được)
  → Nhưng A vẫn phải check cho B khi B lên tuần 2
```

**UI flow khi join team:**
```
"Bạn đang ở Tuần X. Bạn muốn:"
  ◉ [Option A] Bắt đầu lại từ Tuần 1 cùng nhóm
  ○ [Option B] Tiếp tục tuần của mình (Tuần X)

[Xác nhận]
```

---

## 3. Check Logic — Tuần 2 Rule theo từng người

```
IF user.current_week == 1 OR user.current_week == 3:
  → user có thể tự tick checkbox của mình
  → teammate CŨNG có thể check (optional)

IF user.current_week == 2:
  → Checkbox của user BỊ LOCK (disabled)
  → Cần ≥ 1 teammate check = completed/not completed + reason
  → Realtime: khi được check → unlock view, hiện trạng thái
```

### DB: Team Check Logs
```sql
team_check_logs (
  id           UUID PK
  team_id      UUID FK
  checker_id   UUID FK profiles     -- người đang check
  checked_id   UUID FK profiles     -- người được check
  date         DATE NOT NULL
  status       BOOLEAN NOT NULL     -- true=done, false=fail
  reason       TEXT                 -- ghi chú (bắt buộc khi status=false)
  created_at   TIMESTAMPTZ
  UNIQUE(team_id, checked_id, date) -- chỉ 1 check chính thức mỗi ngày mỗi người
)
```

### UI trong Team Page
```
Ngày hôm nay — Tuần 2:
┌─────────────────────────────┐
│ Minh Anh cần được check     │
│ [✅ Done] [❌ Fail]          │
│ Lý do: [____________________]│
│ [Confirm Check]             │
└─────────────────────────────┘
```

---

## 4. Team Rules — Thưởng / Phạt

### DB
```sql
team_rules (
  id           UUID PK
  team_id      UUID FK
  rule_type    TEXT NOT NULL  -- 'reward' | 'punishment'
  trigger      TEXT NOT NULL  -- 'miss_day' | 'streak_7' | 'complete_week2' | 'custom'
  description  TEXT NOT NULL  -- "Chuyển khoản 50k"
  amount_vnd   INT            -- optional
  proposed_by  UUID FK profiles
  created_at   TIMESTAMPTZ
)

-- Approval: mọi member phải đồng ý
team_rule_agreements (
  rule_id    UUID FK team_rules
  user_id    UUID FK profiles
  agreed     BOOLEAN NOT NULL DEFAULT FALSE
  agreed_at  TIMESTAMPTZ
  PRIMARY KEY (rule_id, user_id)
)
```

### Rule Status
```
pending  → chưa đủ người agree
active   → tất cả member đã agree → rule có hiệu lực
rejected → ≥ 1 người từ chối
```

### UI Flow
```
Member A tạo rule:
  "Bỏ 1 ngày = Chuyển khoản 50k cho teammate"
  → Status: ⏳ Chờ đồng ý (1/3 người đã agree)

Member B thấy:
  "Minh Anh đề xuất rule: ..."
  [✅ Đồng Ý] [❌ Từ Chối]

Tất cả đồng ý → Rule chuyển sang ACTIVE
  → Hiện trong Team Page với badge 🔴 hoặc 🏆
```

---

## 5. Components cần build/sửa

### DB Changes (chạy trước)
```sql
-- 1. Sửa teams table
ALTER TABLE teams ADD COLUMN name TEXT;
ALTER TABLE teams ADD COLUMN max_members SMALLINT DEFAULT 2;
ALTER TABLE teams ADD COLUMN created_by UUID REFERENCES profiles(id);

-- 2. Tạo team_members
CREATE TABLE team_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id   UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member',
  week_sync TEXT NOT NULL DEFAULT 'continue', -- 'restart' | 'continue'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

-- 3. Tạo user_programs
CREATE TABLE user_programs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  current_week SMALLINT NOT NULL DEFAULT 1,
  reset_count  INT NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'active',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 4. team_check_logs (như trên)
-- 5. team_rules + team_rule_agreements (như trên)

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE team_members;
ALTER PUBLICATION supabase_realtime ADD TABLE team_check_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE team_rules;
ALTER PUBLICATION supabase_realtime ADD TABLE team_rule_agreements;
```

### React Components
```
src/
  pages/
    TeamPage.jsx              ← refactor: N members, week logic
  components/team/
    TeamMemberCard.jsx        ← 1 card per member (progress, streak, week)
    TeammateCheckPanel.jsx    ← form check người khác (tuần 2)
    CheckHistoryLog.jsx       ← ai check ai, khi nào, lý do
    JoinSyncModal.jsx         ← chọn Option A / B khi join
    TeamRules.jsx             ← list rules + propose + agree
    TeamRuleCard.jsx          ← 1 rule card (status, agree btn)
  hooks/
    useTeam.js                ← fetch team, members, week info
    useTeamCheck.js           ← check logic, validate week
    useTeamRules.js           ← CRUD rules + agreements
```

---

## 6. Visual Design Notes

### Team Page Layout (N members)
```
[Team Name] • [3 thành viên] • [Tuần X avg]

┌──────┐  ┌──────┐  ┌──────┐
│User A│  │User B│  │User C│
│Tuần 2│  │Tuần 1│  │Tuần 3│  ← tuần của mỗi người
│🔒Lock│  │✅Self│  │✅Self│  ← ai được tự check
│Streak│  │Streak│  │Streak│
└──────┘  └──────┘  └──────┘

[Check cho người cần → TeammateCheckPanel]

─── Team Rules ────────────────
🔴 Bỏ 1 ngày → Transfer 50k    [✅ Active]
🏆 Streak 7 → Bạn mua cà phê   [⏳ 2/3 agree]
[+ Thêm Rule]
```

---

## Next Steps
- [x] Chạy SQL mới trong Supabase → `docs/supabase_team_v3.sql`
- [x] Build `useTeam.js`, `useTeamCheck.js`, `useTeamRules.js`
- [x] Refactor `TeamPage.jsx` → N members
- [x] Build `TeammateCheckPanel.jsx`
- [x] Build `TeamRules.jsx` + approval flow
- [x] Build `JoinSyncModal.jsx`
- [x] Realtime cho tất cả tables mới
- [ ] Manual: run `docs/supabase_team_v3.sql` on Supabase
- [ ] E2E test: create → join → week-2 check flow
