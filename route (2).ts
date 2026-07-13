"use client";

/**
 * TestPlayer
 * ----------------------------------------------------------------------------
 * Componente central da experiência do participante em um teste não moderado.
 *
 * Responsabilidades:
 *  1. Renderizar o layout (sidebar de instruções + iframe do protótipo Figma).
 *  2. Escutar `window.postMessage` vindo de embed.figma.com e traduzir os
 *     eventos brutos do Embed Kit 2.0 em métricas de produto (sucesso,
 *     misclicks, tempo na tarefa, navegação).
 *  3. Persistir eventos e o resultado final da sessão via API routes
 *     (fire-and-forget para eventos, síncrono para o fechamento da sessão).
 *
 * Este componente é "burro" em relação a regras de negócio pesadas — ele
 * delega parsing/tipagem de mensagens Figma para `figma-messages.ts` e a
 * heurística de misclick para `misclick-heuristics.ts`, mantendo-se focado
 * em orquestração de estado e ciclo de vida.
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import { MissionForPlayer, SessionStatus } from "@/types";
import {
  FigmaEmbedMessage,
  extractClickPosition,
  isFigmaEmbedMessage,
} from "./figma-messages";
import {
  createMisclickWindowState,
  evaluateClick,
  onNodeChanged,
  MisclickWindowState,
} from "./misclick-heuristics";
import { MissionSidebar } from "./MissionSidebar";
import { ProgressBar } from "./ProgressBar";

interface TestPlayerProps {
  mission: MissionForPlayer;
  sessionId: string; // criado no servidor antes de montar o player (ver /test/[missionId]/page.tsx)
}

// ----------------------------------------------------------------------------
// STATE MANAGEMENT
// ----------------------------------------------------------------------------

interface PlayerState {
  status: SessionStatus;
  currentNodeId: string | null;
  misclickCount: number;
  navigationCount: number;
  elapsedSeconds: number;
  iframeLoaded: boolean;
}

type PlayerAction =
  | { type: "IFRAME_LOADED" }
  | { type: "NODE_CHANGED"; nodeId: string }
  | { type: "MISCLICK" }
  | { type: "TICK" }
  | { type: "FINISH"; status: Extract<SessionStatus, "SUCCESS" | "FAILED" | "ABANDONED"> };

function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case "IFRAME_LOADED":
      return { ...state, iframeLoaded: true };
    case "NODE_CHANGED":
      return {
        ...state,
        currentNodeId: action.nodeId,
        navigationCount: state.navigationCount + 1,
      };
    case "MISCLICK":
      return { ...state, misclickCount: state.misclickCount + 1 };
    case "TICK":
      return state.status === "IN_PROGRESS"
        ? { ...state, elapsedSeconds: state.elapsedSeconds + 1 }
        : state;
    case "FINISH":
      return state.status === "IN_PROGRESS"
        ? { ...state, status: action.status }
        : state; // idempotente: não sobrescreve um status final já definido
    default:
      return state;
  }
}

const initialState: PlayerState = {
  status: "IN_PROGRESS",
  currentNodeId: null,
  misclickCount: 0,
  navigationCount: 0,
  elapsedSeconds: 0,
  iframeLoaded: false,
};

// ----------------------------------------------------------------------------
// COMPONENT
// ----------------------------------------------------------------------------

export function TestPlayer({ mission, sessionId }: TestPlayerProps) {
  const [state, dispatch] = useReducer(playerReducer, initialState);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const startedAtRef = useRef<number>(Date.now());
  const misclickWindowRef = useRef<MisclickWindowState>(
    createMisclickWindowState(mission.startNodeId)
  );
  // Guarda a versão mais recente do state para ser lida dentro de closures
  // registradas uma única vez (listener de message, beforeunload, timer).
  const stateRef = useRef(state);
  stateRef.current = state;

  // --------------------------------------------------------------------------
  // Persistência (fire-and-forget para eventos; aguardada para o fechamento)
  // --------------------------------------------------------------------------

  const logEvent = useCallback(
    (type: string, nodeId: string | undefined, payload: unknown) => {
      const elapsedMs = Date.now() - startedAtRef.current;
      fetch("/api/results/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true, // garante envio mesmo se a página estiver sendo fechada
        body: JSON.stringify({ sessionId, type, nodeId, payload, elapsedMs }),
      }).catch(() => {
        /* eventos são best-effort; falha de rede não deve travar o teste */
      });
    },
    [sessionId]
  );

  const finishSession = useCallback(
    (status: Extract<SessionStatus, "SUCCESS" | "FAILED" | "ABANDONED">) => {
      dispatch({ type: "FINISH", status });
      const taskTimeMs = Date.now() - startedAtRef.current;
      const body = JSON.stringify({
        sessionId,
        status,
        taskTimeMs,
        misclickCount: stateRef.current.misclickCount,
        navigationCount: stateRef.current.navigationCount,
        reachedTarget: status === "SUCCESS",
      });

      // sendBeacon é mais confiável que fetch no evento beforeunload/unload
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/results/finish", blob);
      } else {
        fetch("/api/results/finish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body,
        }).catch(() => {});
      }
    },
    [sessionId]
  );

  // --------------------------------------------------------------------------
  // Listener central de postMessage do Figma
  // --------------------------------------------------------------------------

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!isFigmaEmbedMessage(event)) return;
      const msg = event.data as FigmaEmbedMessage;

      switch (msg.type) {
        case "INITIAL_LOAD": {
          dispatch({ type: "IFRAME_LOADED" });
          logEvent("INITIAL_LOAD", mission.startNodeId, msg);
          break;
        }

        case "PRESENTED_NODE_CHANGED": {
          const nodeId = msg.data.presentedNodeId;
          dispatch({ type: "NODE_CHANGED", nodeId });
          misclickWindowRef.current = onNodeChanged(
            misclickWindowRef.current,
            nodeId
          );
          logEvent("PRESENTED_NODE_CHANGED", nodeId, msg);

          // Critério de SUCESSO: nó alvo alcançado.
          if (nodeId === mission.targetNodeId) {
            logEvent("SUCCESS_REACHED", nodeId, msg);
            finishSession("SUCCESS");
            break;
          }

          // Critério de FALHA "conhecida": nó marcado como caminho de erro terminal.
          if (mission.errorNodeIds.includes(nodeId)) {
            finishSession("FAILED");
          }
          break;
        }

        case "MOUSE_PRESS_OR_RELEASE": {
          const { handled } = msg.data;
          const position = extractClickPosition(msg);
          const { isMisclick, updatedState } = evaluateClick(
            misclickWindowRef.current,
            handled
          );
          misclickWindowRef.current = updatedState;

          if (isMisclick) {
            dispatch({ type: "MISCLICK" });
            logEvent("MISCLICK", msg.data.presentedNodeId, {
              ...msg,
              resolvedPosition: position, // pode ser null — ver figma-messages.ts
            });
          } else {
            logEvent("MOUSE_PRESS_OR_RELEASE", msg.data.presentedNodeId, {
              ...msg,
              resolvedPosition: position,
            });
          }
          break;
        }

        case "NEW_STATE": {
          logEvent("NEW_STATE", state.currentNodeId ?? undefined, msg);
          break;
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs cobrem o estado mutável
  }, [mission.targetNodeId, mission.errorNodeIds, mission.startNodeId, logEvent, finishSession]);

  // --------------------------------------------------------------------------
  // Cronômetro (tempo na tarefa) — inicia no mount, para quando status != IN_PROGRESS
  // --------------------------------------------------------------------------

  useEffect(() => {
    const interval = setInterval(() => dispatch({ type: "TICK" }), 1000);
    return () => clearInterval(interval);
  }, []);

  // Limite de tempo opcional definido na Missão
  useEffect(() => {
    if (!mission.timeLimitSeconds) return;
    if (state.elapsedSeconds >= mission.timeLimitSeconds) {
      finishSession("FAILED");
    }
  }, [state.elapsedSeconds, mission.timeLimitSeconds, finishSession]);

  // Detecta abandono: participante fecha a aba/navega para fora sem concluir.
  useEffect(() => {
    function handleUnload() {
      if (stateRef.current.status === "IN_PROGRESS") {
        finishSession("ABANDONED");
      }
    }
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [finishSession]);

  // --------------------------------------------------------------------------
  // Segurança: validar origem também no carregamento inicial do iframe.
  // O client-id/allowed-origin real é configurado no painel de desenvolvedor
  // do Figma para o domínio de produção desta aplicação.
  // --------------------------------------------------------------------------

  const handleFinishEarly = () => finishSession("ABANDONED");

  return (
    <div className="flex flex-col h-screen w-screen bg-neutral-50">
      <ProgressBar
        elapsedSeconds={state.elapsedSeconds}
        timeLimitSeconds={mission.timeLimitSeconds}
        status={state.status}
      />

      <div className="flex flex-1 min-h-0">
        <MissionSidebar
          title={mission.title}
          instructions={mission.instructions}
          status={state.status}
          misclickCount={state.misclickCount}
          onFinishEarly={handleFinishEarly}
        />

        <main className="flex-1 relative bg-neutral-100">
          {!state.iframeLoaded && (
            <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-sm">
              Carregando protótipo…
            </div>
          )}

          <iframe
            ref={iframeRef}
            src={mission.embedUrl}
            title={mission.title}
            className="w-full h-full border-0"
            allow="fullscreen; clipboard-write"
            // Restringe o que pode ser feito no iframe além do necessário para o embed
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />

          {state.status !== "IN_PROGRESS" && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-white shadow-xl rounded-2xl px-10 py-8 text-center max-w-sm">
                <p className="text-lg font-semibold text-neutral-900 mb-1">
                  {state.status === "SUCCESS"
                    ? "Missão concluída! 🎉"
                    : "Teste encerrado"}
                </p>
                <p className="text-sm text-neutral-500">
                  Obrigado por sua participação.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
