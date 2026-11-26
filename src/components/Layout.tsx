import type { ReactElement, ReactNode } from "react";
import { ResponsiveContainer } from "recharts";

type Option<T> = { value: T; label: string };

export function Segmented<T extends string | number>({ label, options, value, onChange }: { label: string; options: readonly Option<T>[]; value: T; onChange: (value: T) => void }) {
  return (
    <div className="flex gap-0.5 rounded-xl border border-white/10 bg-tri-card p-1" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold ${
            option.value === value ? "bg-gradient-to-r from-tri-purple to-tri-pink text-white" : "text-white/60 hover:text-white"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

type PageShellProps = {
  title: string;
  status?: string | null;
  tabs?: ReactNode;
  controls?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

/** On large screens a page is exactly one screen tall; on small ones it scrolls. */
export function PageShell({ title, status, tabs, controls, actions, children }: PageShellProps) {
  return (
    <div className="flex flex-col gap-3 p-3 md:px-4 lg:h-full lg:min-h-0">
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-2xl font-black text-white">{title}</h1>
        {tabs}
        {controls}
        <div className="ml-auto flex items-center gap-2">
          {status && <span className="max-w-xs truncate text-xs text-white/50" title={status}>{status}</span>}
          {actions}
        </div>
      </header>
      {children}
    </div>
  );
}

/** Two rows of panels sharing the height left under the header. */
export const FIT_GRID = "grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-2 lg:[grid-template-rows:repeat(2,minmax(200px,1fr))]";
/** One row of panels filling the height. */
export const FILL_ROW = "grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-2 lg:[grid-template-rows:minmax(0,1fr)]";

export type LegendItem = { label: string; color: string };

type PanelProps = {
  title: string;
  note?: string;
  legend?: readonly LegendItem[];
  extra?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Panel({ title, note, legend, extra, className = "", children }: PanelProps) {
  return (
    <section className={`flex min-h-[260px] min-w-0 flex-col rounded-2xl border border-white/10 bg-tri-card p-3 lg:min-h-0 ${className}`}>
      <div className="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-sm font-bold text-white">{title}</h2>
        {note && <p className="text-[11px] text-white/40">{note}</p>}
        {legend && (
          <div className="ml-auto flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/60">
            {legend.map((item) => (
              <span key={item.label} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
        )}
        {extra && <div className={legend ? "" : "ml-auto"}>{extra}</div>}
      </div>
      {children}
    </section>
  );
}

/** A panel whose chart stretches to whatever space it is given. */
export function ChartPanel({ empty, emptyText = "No data in this range yet.", children, ...panel }: Omit<PanelProps, "children"> & { empty: boolean; emptyText?: string; children: ReactElement }) {
  return (
    <Panel {...panel}>
      <div className="relative mt-2 min-h-0 flex-1">
        {empty ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-white/40">{emptyText}</p>
        ) : (
          <div className="absolute inset-0">
            <ResponsiveContainer width="100%" height="100%">
              {children}
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Panel>
  );
}

/** A panel for lists and forms, which scroll inside it. */
export function ScrollArea({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`tri-scroll-y min-h-0 lg:overflow-y-auto ${className}`}>{children}</div>;
}
