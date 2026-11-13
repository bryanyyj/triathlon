# Coach

The AI coach, brought over from the ROT project (`bryanyyj/ROT`, branch
`feat/rest-or-train-rebuild`, commit `7a422c6`).

- `engine/` is ROT's `packages/engine/src` (readiness: CTL/ATL/TSB, ACWR), unchanged.
- The other `.ts` files are ROT's `apps/server/src` modules. Only import paths changed, plus
  `config.ts`, which is trimmed to the OpenRouter settings.
- Node runs the `.ts` files directly, so imports use real `.ts` extensions and there is no build step.

ROT's own store, Strava sync and Express app were not copied. `../routes/coach.js` replaces them:
it feeds the coach from this dashboard's SQLite activities and races, and saves the coach's plan
into `planned_workouts`.
