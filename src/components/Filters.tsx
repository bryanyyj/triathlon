import type { QuickFilter, SportFilter } from "../types";

const SPORTS: { value: SportFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "swim", label: "Swim" },
  { value: "bike", label: "Bike" },
  { value: "run", label: "Run" },
];

const QUICK_FILTERS: { value: QuickFilter; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "ytd", label: "YTD" },
  { value: "all", label: "All time" },
];

type FiltersProps = {
  sport: SportFilter;
  onSportChange: (sport: SportFilter) => void;
  quickFilter: QuickFilter;
  onQuickFilterChange: (filter: QuickFilter) => void;
};

export function Filters({ sport, onSportChange, quickFilter, onQuickFilterChange }: FiltersProps) {
  return (
    <section className="sticky top-0 z-20 rounded-2xl bg-tri-card border border-white/10 p-4 flex flex-wrap items-center gap-4 shadow-lg">
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-white/40">Sport</span>
        <div className="flex gap-1 rounded-xl bg-tri-soft p-1">
          {SPORTS.map((s) => (
            <button
              key={s.value}
              onClick={() => onSportChange(s.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                sport === s.value ? "bg-gradient-to-r from-tri-purple to-tri-pink text-white" : "text-white/60 hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-white/40">Date Range</span>
        <div className="flex gap-1 rounded-xl bg-tri-soft p-1">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => onQuickFilterChange(f.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                quickFilter === f.value ? "bg-gradient-to-r from-tri-blue to-tri-purple text-white" : "text-white/60 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function quickFilterToRange(filter: QuickFilter): { startDate?: string; endDate?: string } {
  if (filter === "all") return {};

  const end = new Date();
  const start = new Date();

  if (filter === "7d") start.setDate(start.getDate() - 7);
  else if (filter === "30d") start.setDate(start.getDate() - 30);
  else if (filter === "90d") start.setDate(start.getDate() - 90);
  else if (filter === "ytd") start.setMonth(0, 1);

  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}
