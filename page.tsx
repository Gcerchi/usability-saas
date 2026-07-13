import { TestSession } from "@prisma/client";

const STATUS_STYLES: Record<string, string> = {
  SUCCESS: "bg-emerald-50 text-emerald-700",
  ABANDONED: "bg-amber-50 text-amber-700",
  FAILED: "bg-red-50 text-red-700",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
};

const STATUS_LABELS: Record<string, string> = {
  SUCCESS: "Sucesso",
  ABANDONED: "Abandono",
  FAILED: "Falha",
  IN_PROGRESS: "Em andamento",
};

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  const totalSeconds = Math.round(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}m ${(totalSeconds % 60)
    .toString()
    .padStart(2, "0")}s`;
}

export function ParticipantsTable({ sessions }: { sessions: TestSession[] }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-100 text-left text-neutral-400">
            <th className="px-5 py-3 font-medium">Participante</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Tempo</th>
            <th className="px-5 py-3 font-medium">Misclicks</th>
            <th className="px-5 py-3 font-medium">Navegações</th>
            <th className="px-5 py-3 font-medium">Iniciado em</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session, i) => (
            <tr key={session.id} className="border-b border-neutral-50 last:border-0">
              <td className="px-5 py-3 text-neutral-700">
                {session.participantLabel ?? `Participante #${i + 1}`}
              </td>
              <td className="px-5 py-3">
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    STATUS_STYLES[session.status]
                  }`}
                >
                  {STATUS_LABELS[session.status]}
                </span>
              </td>
              <td className="px-5 py-3 text-neutral-600">
                {formatDuration(session.taskTimeMs)}
              </td>
              <td className="px-5 py-3 text-neutral-600">{session.misclickCount}</td>
              <td className="px-5 py-3 text-neutral-600">{session.navigationCount}</td>
              <td className="px-5 py-3 text-neutral-400">
                {new Date(session.startedAt).toLocaleString("pt-BR")}
              </td>
            </tr>
          ))}
          {sessions.length === 0 && (
            <tr>
              <td colSpan={6} className="px-5 py-8 text-center text-neutral-400">
                Nenhum participante ainda. Compartilhe o link da missão para começar.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
