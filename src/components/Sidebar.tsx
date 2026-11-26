export const PAGES = [
  { id: "overview", label: "Overview", icon: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" },
  { id: "calendar", label: "Calendar", icon: "M4 6h16v14H4zM4 10h16M8 3v5M16 3v5" },
  { id: "training", label: "Training", icon: "M3 17l5-6 4 3 5-8 4 5M3 21h18" },
  { id: "recovery", label: "Recovery", icon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" },
  { id: "plan", label: "Plan", icon: "M5 21V4M5 4h13l-3 4 3 4H5" },
] as const;

export type PageId = (typeof PAGES)[number]["id"];

/** Left navigation rail; a scrolling bar along the top on narrow screens. */
export function Sidebar({ page }: { page: PageId }) {
  return (
    <nav
      aria-label="Pages"
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 bg-tri-card p-2 md:h-screen md:w-[88px] md:flex-col md:overflow-y-auto md:overflow-x-hidden md:border-b-0 md:border-r md:px-1.5 md:py-3"
    >
      {PAGES.map((item) => {
        const active = item.id === page;
        const tone = active ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white";
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-[72px] flex-col items-center gap-1 rounded-lg px-1 py-2 text-center text-[11px] font-medium leading-tight ${tone}`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={item.icon} />
            </svg>
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
