# HCQ FE — Dynamic Scrum Dashboard

Детермінований генератор щоденного звіту перед Daily Scrum для команди HCQ FE.
Джерело істини — промт `daily-scrum-prompt-v2.md` (правила валідації, JQL, custom field IDs), переписаний у TypeScript.

## Що робить

- **Snapshot** (щодня 08:30 Kiev, Mon–Fri): тягне дані з Jira, застосовує 10 правил валідації, рендерить HTML-звіт у `docs/reports/YYYY-MM-DD.html`.
- **Live dashboard** (щопів години в робочі години): оновлює `docs/data/latest.json`, який читає клієнтська сторінка `docs/live/` з фільтрами per dev / per goal / per status.
- **Index** (`docs/index.html`): архів усіх снапшотів + лінк на live.
- Автоматично обирає variant: **вт/чт** → Sprint Pulse (muted palette), інші дні → Daily Scrum.

## Швидкий старт

```bash
pnpm install
cp .env.example .env
# заповнити JIRA_EMAIL, JIRA_API_TOKEN, CLOUD_ID
pnpm snapshot              # генерує docs/reports/{сьогодні}.html
pnpm live                  # генерує docs/data/latest.json
pnpm build:live            # збирає web/ → docs/live/app.js
open docs/reports/*.html   # оглянути результат
```

### Jira API token

Якщо токена немає: https://id.atlassian.com/manage-profile/security/api-tokens → Create API token.
Токен + твоя пошта передаються як Basic auth.

## Структура

```
src/
  jira/           Jira REST client + JQL queries + custom field IDs
  analyze/        Raw issues → ReportData (rules, metrics, goals, loads, blockers, subtasks, bugs, forecast)
  model/types.ts  Канонічна модель ReportData (єдиний контракт)
  render/html/    Шаблонні функції (секції, chips, icons, styles)
  render/         snapshot.ts (full HTML) + index-page.ts (архівна сторінка)
  cli/            snapshot.ts + live.ts — точки входу для Actions
web/              Клієнтський live-dashboard (TS, бандл esbuild у docs/live/)
docs/             GitHub Pages root — коміт робить CI
config/team.json  Команда, sprint ID, cloud ID
```

## GitHub Secrets (для CI)

У налаштуваннях репо → Settings → Secrets and variables → Actions:

- `JIRA_EMAIL` — твоя пошта на newsiteam.atlassian.net
- `JIRA_API_TOKEN` — токен з https://id.atlassian.com/manage-profile/security/api-tokens
- `CLOUD_ID` — `657e24cd-f643-4482-aba5-7e848607df28` (або інший, якщо зміниться)

## Pages

Settings → Pages → Source: **Deploy from a branch** → Branch: `main`, folder: `/docs`.
На Free-акаунті Pages буде публічний. Для private Pages треба GitHub Pro/Team/Enterprise.

## Оновлення спринту

Коли починається новий спринт — редагуємо `config/team.json` → `sprintId`.
(Можна автоматизувати пізніше через JQL `sprint in openSprints()`.)

## Локальне тестування

```bash
pnpm typecheck             # перевірка типів
pnpm snapshot --dry        # рендерить у stdout без запису файлу
pnpm snapshot --variant daily
pnpm snapshot --variant pulse
```

## Як додати нове правило

1. Додати константу + логіку у `src/analyze/rules.ts` (функція `applyRules`).
2. Додати формулювання питання у `src/analyze/forecast.ts::buildQuestions`, якщо потрібне на стендапі.
3. Якщо треба візуальний бейдж — додати клас у `src/render/html/styles.ts` + помістити у `ticket-line.ts`.

## Обмеження

- **READ-ONLY** у Jira — ніяких edits/transitions/comments.
- Rate limit Jira: expand=changelog для всіх тасок — якщо спринт > 150 тасок, може знадобитися кеш.
- Timezone GitHub cron у UTC — два cron-записи покривають зимовий і літній Kiev час (один спрацює за день).
