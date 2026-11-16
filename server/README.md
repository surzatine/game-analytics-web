# Game Analytics Backend (Node + Express + MongoDB + Mongoose)

## Run
```bash
cp .env.example .env     # set MONGO_URI + keys
npm install
npm run dev
```

## API docs (Swagger)
Open `http://localhost:5000/api-docs` (raw spec: `/api-docs.json`). Click **Authorize** and enter `GAME_API_KEY` (x-api-key) and/or `DASHBOARD_API_KEY` (Bearer) to try endpoints. Request schemas are generated from the Mongoose models. Disable with `ENABLE_DOCS=false`.

## Auth
- Unity -> `/api/ingest/*` and `/api/experiments/*`: header `x-api-key: <GAME_API_KEY>`
- React -> `/api/analytics/*`: header `Authorization: Bearer <DASHBOARD_API_KEY>`

## Ingestion (Unity)
`POST /api/ingest/:type` — body can be one object, an array, or `{ "events": [...] }` (max 500, for offline queue flush).

| type | collection | behaviour |
|---|---|---|
| users, app-sessions, game-sessions | users, app_sessions, game_sessions | upsert by id (send start, then update at end) |
| events, inventory, purchases, currency, iap, ads, levels, progression, performance | matching collection | insert; duplicate ids are skipped (rule 11) |

```bash
curl -X POST localhost:5000/api/ingest/events -H "x-api-key: change-me-game-key" -H "Content-Type: application/json" \
 -d '[{"event_id":"e1","event_name":"button_click","user_id":"u1","app_session_id":"a1","event_timestamp_utc":"2026-11-16T10:00:00Z","screen_name":"MainMenu","properties":{"button_name":"Play"}}]'
```
Response: `{ received, inserted, updated, duplicates, failed }`

## Analytics (all accept `?from=&to=&limit=`)
overview, players, sessions, buttons, gameplay, deaths, respawns, levels, inventory, purchases, currency, iap, ads, retention (`?days=1,3,7,30`), performance, experiments, experiments/:id/results

## A/B testing
- `POST /api/experiments` `{experiment_id, experiment_name, status:"Active", variants:[{variant_id:"A",weight:50},{variant_id:"B",weight:50}]}`
- `POST /api/experiments/:id/assign` `{user_id}` -> deterministic, sticky variant

## Event conventions the dashboards rely on
- `button_click`: `properties.button_name`; `screen_exit`: `properties.duration_ms`
- `player_death` / `player_respawn` events: `properties.level_id`, `cause`, `checkpoint_id`
