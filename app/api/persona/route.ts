import { sessions } from "@/lib/db/schema";
import { getAvailablePersonas, isPersonaId } from "@/lib/personas";

export async function GET() {
  return Response.json({
    personas: getAvailablePersonas(),
  });
}

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const personaId =
    typeof body === "object" && body !== null && "personaId" in body
      ? body.personaId
      : undefined;

  if (!isPersonaId(personaId)) {
    return Response.json({ error: "Invalid personaId." }, { status: 400 });
  }

  const { db } = await import("@/lib/db");
  const [session] = await db
    .insert(sessions)
    .values({ personaId })
    .returning({ id: sessions.id });

  const persona = getAvailablePersonas().find((item) => item.id === personaId);

  return Response.json({
    sessionId: session.id,
    persona,
  });
}
