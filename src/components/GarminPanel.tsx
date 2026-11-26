import type { Garmin } from "../lib/useGarmin";

function Command({ children }: { children: string }) {
  return <code className="rounded-md bg-tri-soft px-2 py-0.5 font-mono text-xs text-white">{children}</code>;
}

/** Sign-in steps until Garmin is connected, then the sync control. */
export function GarminPanel({ garmin }: { garmin: Garmin }) {
  const { status, days, error, sync, refresh } = garmin;
  if (!status) return error ? <p className="text-sm text-red-300">{error}</p> : null;

  const ready = status.installed && status.signedIn;
  const needsLogin = status.errorCode === "not_signed_in" || status.errorCode === "login_failed";

  return (
    <section className="rounded-3xl border border-white/10 bg-tri-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">Garmin Connect</h2>
          <p className="text-sm text-white/50">
            {status.syncing
              ? `Syncing day ${Math.min(status.done + 1, status.total)} of ${status.total}…`
              : ready
                ? days.length
                  ? `Signed in · ${days.length} days saved, latest ${days[days.length - 1].date}`
                  : "Signed in. Sync to load your sleep and health data."
                : "Not connected yet."}
          </p>
        </div>

        {ready ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void sync(30)}
              disabled={status.syncing}
              className="rounded-xl bg-gradient-to-r from-tri-purple to-tri-pink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Sync 30 days
            </button>
            <button
              type="button"
              onClick={() => void sync(180)}
              disabled={status.syncing}
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 disabled:opacity-50"
            >
              Sync 6 months
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70"
          >
            Check again
          </button>
        )}
      </div>

      {(!ready || needsLogin) && (
        <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-white/70">
          {!status.installed && (
            <li>
              In a terminal in the project folder, install the Garmin tools: <Command>npm run garmin:setup</Command>
            </li>
          )}
          <li>
            Sign in: <Command>npm run garmin:login</Command> and enter your Garmin email, password and MFA code when asked.
            They are typed into the terminal only; this app stores just the sign-in token.
          </li>
          <li>Come back to this tab, then press Sync.</li>
        </ol>
      )}

      {(status.error || error) && <p className="mt-3 text-sm text-red-300">{status.error || error}</p>}
    </section>
  );
}
