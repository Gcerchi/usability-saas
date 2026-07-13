import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/sessions
 * Body: { missionId: string, participantMeta?: object }
 *
 * Chamado no servidor (Server Component da rota /test/[missionId]) antes de
 * renderizar o <TestPlayer />, garantindo que já exista um sessionId para
 * anexar aos eventos desde o primeiro postMessage (INITIAL_LOAD).
 */
export async function POST(req: NextRequest) {
  const { missionId, participantMeta } = await req.json();

  if (!missionId) {
    return NextResponse.json({ error: "missionId é obrigatório." }, { status: 400 });
  }

  const mission = await prisma.mission.findUnique({ where: { id: missionId } });
  if (!mission || mission.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Missão não encontrada ou não está ativa." },
      { status: 404 }
    );
  }

  const session = await prisma.testSession.create({
    data: {
      missionId,
      participantMeta: participantMeta ?? {},
      currentNodeId: mission.startNodeId,
    },
  });

  return NextResponse.json({ sessionId: session.id });
}
