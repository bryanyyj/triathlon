type HeaderProps = {
  stravaConnected: boolean;
  athleteName: string | null;
  onConnectStrava: () => void;
};

export function Header({ stravaConnected, athleteName, onConnectStrava }: HeaderProps) {
  return (
    <header className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-black text-white">🏊🚴🏃 Tri Training Dashboard</h1>
        <p className="text-sm text-white/50">
          {stravaConnected
            ? `Connected to Strava${athleteName ? ` as ${athleteName}` : ""}`
            : "Connect your Strava account to load your training data"}
        </p>
      </div>

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
    </header>
  );
}
