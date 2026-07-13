import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/results/finish
 * Body: FinishSessionInput (ver src/types/index.ts)
 *
 * Recebido tanto via fetch normal quanto via navigator.sendBeacon (por isso
 * lemos o corpo como texto puro — sendBeacon nem sempre define
 * Content-Type: application/json corretamente em todos os navegadores).
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const body = JSON.parse(raw);
  const { sessionId, status, taskTimeMs, misclickCount, navigationCount, reachedTarget } = body;

  if (!sessionId || !status) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  // Idempotente: se a sessão já tiver um status final, não sobrescreve
  // (evita corrida entre beforeunload e um SUCCESS já processado).
  const existing = await prisma.testSession.findUnique({ where: { id: sessionId } });
  if (!existing || existing.status !== "IN_PROGRESS") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  await prisma.testSession.update({
    where: { id: sessionId },
    data: {
      status,
      finishedAt: new Date(),
      taskTimeMs,
      misclickCount,
      navigationCount,
      reachedTarget,
    },
  });

  return NextResponse.json({ ok: true });
}
