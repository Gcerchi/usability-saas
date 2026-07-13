// ============================================================================
// Prisma Schema — Plataforma de Testes de Usabilidade não moderados via Figma
// ============================================================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ----------------------------------------------------------------------------
// AUTENTICAÇÃO / CONTA
// ----------------------------------------------------------------------------

model User {
  id            String    @id @default(cuid())
  name          String
  email         String    @unique
  passwordHash  String?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  missions      Mission[]

  @@map("users")
}

// ----------------------------------------------------------------------------
// PROTÓTIPO FIGMA IMPORTADO
// ----------------------------------------------------------------------------

// Representa um arquivo/protótipo Figma importado por URL.
// Guardamos os dados brutos da URL para poder remontar o embed a qualquer momento.
model FigmaPrototype {
  id                String   @id @default(cuid())
  originalUrl       String   // URL colada pelo criador
  fileKey           String   // extraído da URL (ex: "acDzTcMe9zjkq0b")
  fileName          String?  // nome do arquivo, se disponível via Figma API
  startingNodeId    String?  // node-id inicial, extraído da URL ou definido manualmente
  pageId            String?  // page-id, se presente na URL
  embedUrl          String   // URL final montada para o iframe embed.figma.com/proto/...
  thumbnailUrl      String?
  createdAt         DateTime @default(now())

  missions          Mission[]

  @@map("figma_prototypes")
}

// ----------------------------------------------------------------------------
// MISSÃO (a definição do teste de usabilidade)
// ----------------------------------------------------------------------------

enum MissionStatus {
  DRAFT
  ACTIVE
  PAUSED
  ARCHIVED
}

model Mission {
  id                  String         @id @default(cuid())
  title               String         // ex: "Chegue até a tela de checkout"
  instructions         String         @db.Text // texto exibido ao participante (lado esquerdo)
  status              MissionStatus  @default(DRAFT)

  // Link público único para envio a participantes (não moderado)
  shareSlug           String         @unique @default(cuid())

  // Relação com o protótipo Figma
  figmaPrototypeId    String
  figmaPrototype      FigmaPrototype @relation(fields: [figmaPrototypeId], references: [id])

  // Definição do fluxo esperado
  startNodeId         String         // nó em que o teste começa (tela inicial)
  targetNodeId        String         // nó "alvo" — sucesso quando alcançado
  // Nós opcionais que, se alcançados, indicam erro/desvio conhecido (para funil de erro)
  errorNodeIds        String[]       @default([])

  // Configurações do teste
  timeLimitSeconds    Int?           // opcional: tempo máximo antes de considerar abandono
  misclickThreshold   Int            @default(3) // nº de misclicks antes de sinalizar dificuldade

  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt

  creatorId           String
  creator             User           @relation(fields: [creatorId], references: [id])

  sessions            TestSession[]

  @@index([shareSlug])
  @@map("missions")
}

// ----------------------------------------------------------------------------
// SESSÃO DE TESTE (uma execução de um participante sobre uma Missão)
// ----------------------------------------------------------------------------

enum SessionStatus {
  IN_PROGRESS
  SUCCESS
  ABANDONED   // fechou/saiu antes de concluir
  FAILED      // atingiu limite de tempo ou node de erro terminal
}

model TestSession {
  id                String        @id @default(cuid())

  missionId         String
  mission           Mission       @relation(fields: [missionId], references: [id])

  // Identificação leve do participante (sem exigir cadastro)
  participantLabel  String?       // ex: "Participante #4" ou nome informado opcionalmente
  participantMeta   Json?         // userAgent, viewport, locale, etc.

  status            SessionStatus @default(IN_PROGRESS)

  startedAt         DateTime      @default(now())
  finishedAt        DateTime?
  taskTimeMs        Int?          // tempo total na tarefa (finishedAt - startedAt), em ms

  currentNodeId     String?       // último nó reportado por PRESENTED_NODE_CHANGED
  reachedTarget     Boolean       @default(false)

  misclickCount     Int           @default(0)
  navigationCount   Int           @default(0) // total de PRESENTED_NODE_CHANGED recebidos

  events            SessionEvent[]

  @@index([missionId, status])
  @@map("test_sessions")
}

// ----------------------------------------------------------------------------
// EVENTO BRUTO (log granular de cada mensagem postMessage recebida do iframe)
// Guardar o payload cru permite reprocessar métricas no futuro (ex: heatmaps).
// ----------------------------------------------------------------------------

enum SessionEventType {
  INITIAL_LOAD
  PRESENTED_NODE_CHANGED
  MOUSE_PRESS_OR_RELEASE
  NEW_STATE
  MISCLICK          // derivado: clique sem handled=true fora de hotspot
  SUCCESS_REACHED    // derivado: nodeId == targetNodeId
  SESSION_ABANDONED  // derivado: unload/beforeunload sem sucesso
}

model SessionEvent {
  id            String            @id @default(cuid())

  sessionId     String
  session       TestSession       @relation(fields: [sessionId], references: [id])

  type          SessionEventType
  nodeId        String?           // presentedNodeId / targetNodeId conforme o tipo
  payload       Json              // payload bruto do postMessage, para auditoria/replay
  elapsedMs     Int               // ms desde o início da sessão (startedAt)

  createdAt     DateTime          @default(now())

  @@index([sessionId, type])
  @@map("session_events")
}
