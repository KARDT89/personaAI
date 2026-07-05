import "dotenv/config";

import { db, pool, schema } from "@/lib/db/client";
import { buildPersonaRecord, getAvailablePersonas } from "@/lib/personas";

async function main() {
  const records = getAvailablePersonas().map((persona) =>
    buildPersonaRecord(persona.id),
  );

  for (const record of records) {
    await db
      .insert(schema.personas)
      .values(record)
      .onConflictDoUpdate({
        target: schema.personas.id,
        set: {
          name: record.name,
          systemPrompt: record.systemPrompt,
        },
      });
  }

  console.log(`Seeded ${records.length} personas.`);
}

main()
  .catch((error) => {
    console.error("Failed to seed personas.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
