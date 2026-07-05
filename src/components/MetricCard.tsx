type MetricCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  accent?: string;
};

export function MetricCard({ title, value, subtitle, accent = "from-tri-purple to-tri-pink" }: MetricCardProps) {
  return (
    <div className="rounded-2xl bg-tri-card border border-white/10 p-5 relative overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${accent}`} />
      <p className="text-xs uppercase tracking-widest text-white/40">{title}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
      {subtitle && <p className="mt-1 text-sm text-white/50">{subtitle}</p>}
    </div>
  );
}
