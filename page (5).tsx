import { MissionMetrics } from "@/lib/metrics";

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function Card({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5 flex flex-col gap-1">
      <span className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
        {label}
      </span>
      <span className="text-2xl font-semibold text-neutral-900">{value}</span>
      {hint && <span className="text-xs text-neutral-400">{hint}</span>}
    </div>
  );
}

export function MetricsCards({ metrics }: { metrics: MissionMetrics }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card
        label="Taxa de sucesso"
        value={`${metrics.successRate}%`}
        hint={`${metrics.successCount} de ${metrics.totalSessions} participantes`}
      />
      <Card
        label="Tempo médio na tarefa"
        value={formatDuration(metrics.avgTaskTimeMs)}
        hint="apenas sessões concluídas"
      />
      <Card
        label="Misclicks médios"
        value={metrics.avgMisclicks?.toString() ?? "—"}
        hint="por sessão finalizada"
      />
      <Card
        label="Abandonos"
        value={metrics.abandonedCount.toString()}
        hint={`${metrics.failedCount} não concluídos por outros motivos`}
      />
    </div>
  );
}
