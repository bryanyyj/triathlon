type HeaderActionsProps = {
  stravaConnected: boolean;
  athleteName: string | null;
  onConnectStrava: () => void;
  onSync: () => void;
  syncing: boolean;
  onOpenCoach: () => void;
};

const BUTTON = "whitespace-nowrap rounded-xl border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10 disabled:opacity-50";

/** Strava and coach buttons shown at the right of every page header. */
export function HeaderActions({ stravaConnected, athleteName, onConnectStrava, onSync, syncing, onOpenCoach }: HeaderActionsProps) {
  return (
    <>
      {stravaConnected ? (
        <button type="button" onClick={onSync} disabled={syncing} title={`Re-pull Strava data · connected${athleteName ? ` as ${athleteName}` : ""}`} className={BUTTON}>
          {syncing ? "Syncing…" : "↻ Strava"}
        </button>
      ) : (
        <button type="button" onClick={onConnectStrava} className="whitespace-nowrap rounded-xl bg-gradient-to-r from-tri-orange to-tri-pink px-3 py-1.5 text-xs font-semibold text-white">
          Connect Strava
        </button>
      )}
      <button type="button" onClick={onOpenCoach} className={BUTTON}>
        Coach
      </button>
    </>
  );
}
