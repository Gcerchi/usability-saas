export interface MissionForPlayer {
  id: string;
  title: string;
  instructions: string;
  embedUrl: string; // já pronta com node-id inicial, ex: embed.figma.com/proto/...
  startNodeId: string;
  targetNodeId: string;
  errorNodeIds: string[];
  timeLimitSeconds: number | null;
}

export type SessionStatus = "IN_PROGRESS" | "SUCCESS" | "ABANDONED" | "FAILED";

export interface CreateSessionResponse {
  sessionId: string;
}

export interface SessionEventInput {
  sessionId: string;
  type:
    | "INITIAL_LOAD"
    | "PRESENTED_NODE_CHANGED"
    | "MOUSE_PRESS_OR_RELEASE"
    | "NEW_STATE"
    | "MISCLICK"
    | "SUCCESS_REACHED"
    | "SESSION_ABANDONED";
  nodeId?: string;
  payload: unknown;
  elapsedMs: number;
}

export interface FinishSessionInput {
  sessionId: string;
  status: Exclude<SessionStatus, "IN_PROGRESS">;
  taskTimeMs: number;
  misclickCount: number;
  navigationCount: number;
  reachedTarget: boolean;
}
