"use client";

import { SessionStatus } from "@/types";

interface MissionSidebarProps {
  title: string;
  instructions: string;
  status: SessionStatus;
  misclickCount: number;
  onFinishEarly?: () => void;
}

const STATUS_CONFIG: Record<
  SessionStatus,
  { label: string; className: string }
> = {
  IN_PROGRESS: { label: "Em andamento", className: "bg-blue-50 text-blue-700" },
  SUCCESS: { label: "Concluído com sucesso", className: "bg-emerald-50 text-emerald-700" },
  ABANDONED: { label: "Abandonado", className: "bg-amber-50 text-amber-700" },
  FAILED: { label: "Não concluído", className: "bg-red-50 text-red-700" },
};

export function MissionSidebar({
  title,
  instructions,
  status,
  misclickCount,
  onFinishEarly,
}: MissionSidebarProps) {
  const cfg = STATUS_CONFIG[status];

  return (
    <aside className="w-full max-w-sm h-full flex flex-col border-r border-neutral-200 bg-white px-8 py-10">
      <span
        className={`self-start px-3 py-1 rounded-full text-xs font-medium mb-6 ${cfg.className}`}
      >
        {cfg.label}
      </span>

      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-2">
        Sua missão
      </p>
      <h1 className="text-2xl font-semibold text-neutral-900 leading-snug mb-4">
        {title}
      </h1>
      <p className="text-neutral-600 leading-relaxed whitespace-pre-line">
        {instructions}
      </p>

      <div className="mt-auto pt-8 border-t border-neutral-100 flex flex-col gap-4">
        {misclickCount > 2 && status === "IN_PROGRESS" && (
          <p className="text-sm text-amber-600">
            Sem pressa — explore a tela à vontade até encontrar o caminho.
          </p>
        )}

        {status === "IN_PROGRESS" && onFinishEarly && (
          <button
            onClick={onFinishEarly}
            className="text-sm text-neutral-400 hover:text-neutral-700 transition-colors underline underline-offset-2 self-start"
          >
            Não consigo concluir essa tarefa
          </button>
        )}

        {status !== "IN_PROGRESS" && (
          <p className="text-sm text-neutral-500">
            Obrigado por participar! Você já pode fechar esta janela.
          </p>
        )}
      </div>
    </aside>
  );
}
