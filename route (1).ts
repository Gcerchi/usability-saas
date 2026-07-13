/**
 * Estratégia de detecção de "misclick" (clique fora de área interativa).
 *
 * Fonte primária: campo `handled` do evento MOUSE_PRESS_OR_RELEASE.
 *   handled === false  -> o clique NÃO atingiu nenhum hotspot configurado no Figma.
 *   Esse é o sinal mais confiável e é o que usamos como critério principal.
 *
 * Fallback (quando o protótipo não emite handled de forma confiável, ou quando
 * queremos detectar "hesitação" mesmo em cliques válidos): heurística de tempo
 * entre trocas de tela. Muitos cliques (>= threshold) sem uma mudança de
 * `presentedNodeId` dentro de uma janela curta sugere que o participante está
 * clicando repetidamente sem sair da tela — sinal indireto de confusão.
 */

export interface MisclickWindowState {
  lastNodeId: string | null;
  lastNodeChangedAt: number; // epoch ms
  clicksSinceLastNodeChange: number;
}

const HESITATION_CLICK_WINDOW_MS = 4000; // janela para considerar "mesma tela"
const HESITATION_CLICK_THRESHOLD = 2; // nº de cliques sem navegar para contar como misclick extra

export function createMisclickWindowState(
  initialNodeId: string | null
): MisclickWindowState {
  return {
    lastNodeId: initialNodeId,
    lastNodeChangedAt: Date.now(),
    clicksSinceLastNodeChange: 0,
  };
}

export function onNodeChanged(
  state: MisclickWindowState,
  newNodeId: string
): MisclickWindowState {
  return {
    lastNodeId: newNodeId,
    lastNodeChangedAt: Date.now(),
    clicksSinceLastNodeChange: 0,
  };
}

/**
 * Chamado a cada MOUSE_PRESS_OR_RELEASE.
 * Retorna { isMisclick, updatedState } — `isMisclick` combina o critério primário
 * (handled === false) com o fallback de hesitação por tempo, evitando contar
 * o mesmo clique duas vezes.
 */
export function evaluateClick(
  state: MisclickWindowState,
  handled: boolean
): { isMisclick: boolean; updatedState: MisclickWindowState } {
  // Critério primário: Figma nos disse explicitamente que não houve hotspot.
  if (!handled) {
    return {
      isMisclick: true,
      updatedState: {
        ...state,
        clicksSinceLastNodeChange: state.clicksSinceLastNodeChange + 1,
      },
    };
  }

  // Critério fallback: clique "válido" segundo o Figma, mas dentro da janela de
  // hesitação e sem troca de tela — ainda assim contamos como sinal de dificuldade
  // a partir do 2º clique na mesma tela dentro da janela.
  const withinWindow =
    Date.now() - state.lastNodeChangedAt < HESITATION_CLICK_WINDOW_MS;
  const nextCount = state.clicksSinceLastNodeChange + 1;

  const isMisclick = withinWindow && nextCount > HESITATION_CLICK_THRESHOLD;

  return {
    isMisclick,
    updatedState: { ...state, clicksSinceLastNodeChange: nextCount },
  };
}
