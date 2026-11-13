export type DashboardTab = "dashboard" | "training-week";

const TABS: { id: DashboardTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "training-week", label: "Training week" },
];

type HeaderProps = {
  tab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  stravaConnected: boolean;
  athleteName: string | null;
  onConnectStrava: () => void;
  onSync: () => void;
  syncing: boolean;
  syncMessage: string | null;
};

export function Header({ tab, onTabChange, stravaConnected, athleteName, onConnectStrava, onSync, syncing, syncMessage }: HeaderProps) {
  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">🏊🚴🏃 Tri Training Dashboard</h1>
          <p className="text-sm text-white/50">
            {stravaConnected
              ? `Connected to Strava${athleteName ? ` as ${athleteName}` : ""}`
              : "Connect your Strava account to load your training data"}
          </p>
          {syncMessage && <p className="mt-0.5 text-xs text-white/40">{syncMessage}</p>}
        </div>

        <div className="flex items-center gap-3">
          {stravaConnected && (
            <button
              onClick={onSync}
              disabled={syncing}
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/70 shadow-lg disabled:opacity-50"
            >
              {syncing ? "Syncing…" : "↻ Re-pull Strava Data"}
            </button>
          )}

          <button
            onClick={onConnectStrava}
            className={
              stravaConnected
                ? "rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/70 shadow-lg"
                : "rounded-xl bg-gradient-to-r from-tri-orange to-tri-pink px-5 py-2.5 text-sm font-semibold text-white shadow-lg"
            }
          >
            {stravaConnected ? "✓ Strava Connected" : "Connect Strava"}
          </button>
        </div>
      </div>

      <nav className="flex gap-1 border-b border-white/10" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTabChange(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${
              tab === t.id ? "border-tri-purple text-white" : "border-transparent text-white/50 hover:text-white/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
