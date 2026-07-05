import { and, eq } from "drizzle-orm";

import { requireUser } from "@/lib/auth-utils";
import { learningSources } from "@/lib/db/schema";

export async function DELETE(
  req: Request,
  context: { params: Promise<unknown> },
) {
  const user = await requireUser(req);

  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const params = (await context.params) as { id?: unknown };
  const id = typeof params.id === "string" ? params.id : null;

  if (!id) {
    return Response.json({ error: "Invalid source id." }, { status: 400 });
  }

  const { db } = await import("@/lib/db");
  const [deletedSource] = await db
    .delete(learningSources)
    .where(and(eq(learningSources.id, id), eq(learningSources.userId, user.id)))
    .returning({ id: learningSources.id });

  if (!deletedSource) {
    return Response.json({ error: "Learning source not found." }, { status: 404 });
  }

  return Response.json({ ok: true });
}
