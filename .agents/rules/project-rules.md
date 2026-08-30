---
trigger: always_on
---

@"
# Project Rules — Web_Update

Before implementing any code change:

1. Read `CLAUDE.md`.
2. Read `docs/RULES.md`.
3. Read only additional documentation relevant to the task.
4. Follow the project-specific rules in those files.
5. Preserve existing user changes.
6. Stay within the requested scope.
7. Do not replace or weaken project-specific security, database, data-loss, or workflow rules because of generic coding preferences.

Project-specific rule sources:

@CLAUDE.md
@docs/RULES.md

Ponytail is an additional coding philosophy. Follow Ponytail for simplicity,
YAGNI, reuse, and minimum code, but project-specific safety and data rules
remain authoritative.
"@ | Set-Content ".agents\rules\project-rules.md" -Encoding UTF8