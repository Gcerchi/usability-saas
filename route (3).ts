/**
 * Tipos e utilitários para a comunicação com o Figma Embed Kit 2.0.
 *
 * Referência oficial: https://developers.figma.com/docs/embeds/embed-api/
 *
 * Origem obrigatória das mensagens: "https://www.figma.com"
 * Eventos relevantes para este produto:
 *  - INITIAL_LOAD              -> disparado quando o protótipo termina de carregar
 *  - PRESENTED_NODE_CHANGED    -> disparado a cada navegação entre telas
 *  - MOUSE_PRESS_OR_RELEASE    -> disparado a cada clique dentro do protótipo
 *                                 (nem sempre traz coordenadas — ver fallback abaixo)
 */

export const FIGMA_EMBED_ORIGIN = "https://www.figma.com";

export interface FigmaPosition {
  x: number;
  y: number;
}

export interface FigmaInitialLoadMessage {
  type: "INITIAL_LOAD";
}

export interface FigmaPresentedNodeChangedMessage {
  type: "PRESENTED_NODE_CHANGED";
  data: {
    presentedNodeId: string;
  };
}

export interface FigmaMousePressOrReleaseMessage {
  type: "MOUSE_PRESS_OR_RELEASE";
  data: {
    // Nó (tela ou overlay) atualmente em exibição
    presentedNodeId: string;
    // true se o clique atingiu um hotspot/interação configurada no protótipo
    handled: boolean;
    // Camada mais no topo sob o cursor, quando NÃO houve interação (handled = false)
    targetNodeId?: string;
    // Posição relativa ao canto superior esquerdo do targetNode
    targetNodeMousePosition?: FigmaPosition;
    // Frame com scroll mais próximo (pode não vir preenchido em todos os protótipos)
    nearestScrollingFrameId?: string;
    nearestScrollingFrameMousePosition?: FigmaPosition;
    nearestScrollingFrameOffset?: FigmaPosition;
  };
}

export interface FigmaNewStateMessage {
  type: "NEW_STATE";
  data: Record<string, unknown>;
}

export type FigmaEmbedMessage =
  | FigmaInitialLoadMessage
  | FigmaPresentedNodeChangedMessage
  | FigmaMousePressOrReleaseMessage
  | FigmaNewStateMessage;

/** Type guard central: valida origem e formato antes de tratar qualquer mensagem. */
export function isFigmaEmbedMessage(
  event: MessageEvent
): event is MessageEvent<FigmaEmbedMessage> {
  if (event.origin !== FIGMA_EMBED_ORIGIN) return false;
  const data = event.data;
  return (
    data &&
    typeof data === "object" &&
    typeof data.type === "string" &&
    [
      "INITIAL_LOAD",
      "PRESENTED_NODE_CHANGED",
      "MOUSE_PRESS_OR_RELEASE",
      "NEW_STATE",
    ].includes(data.type)
  );
}

/**
 * Extrai coordenadas de clique de um evento MOUSE_PRESS_OR_RELEASE, quando disponíveis.
 * IMPORTANTE: em muitos protótipos o Figma NÃO envia nearestScrollingFrameMousePosition
 * (fica null), então nem sempre teremos coordenadas absolutas. Nesses casos o produto
 * cai no fallback de heurística temporal (ver `misclick-heuristics.ts`).
 */
export function extractClickPosition(
  msg: FigmaMousePressOrReleaseMessage
): FigmaPosition | null {
  const { nearestScrollingFrameMousePosition, nearestScrollingFrameOffset } =
    msg.data;
  if (nearestScrollingFrameMousePosition && nearestScrollingFrameOffset) {
    return {
      x: nearestScrollingFrameMousePosition.x + nearestScrollingFrameOffset.x,
      y: nearestScrollingFrameMousePosition.y + nearestScrollingFrameOffset.y,
    };
  }
  return null;
}

/** Mensagens de controle que podemos ENVIAR para o iframe (não usadas no MVP, mas prontas). */
export function sendRestart(iframe: HTMLIFrameElement) {
  iframe.contentWindow?.postMessage({ type: "RESTART" }, FIGMA_EMBED_ORIGIN);
}

export function sendNavigateForward(iframe: HTMLIFrameElement) {
  iframe.contentWindow?.postMessage(
    { type: "NAVIGATE_FORWARD" },
    FIGMA_EMBED_ORIGIN
  );
}
