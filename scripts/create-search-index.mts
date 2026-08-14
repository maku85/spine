import { MongoClient } from "mongodb";

const DB_NAME = process.env.MONGODB_DB ?? "books_catalog";
const COLLECTION_NAME = process.env.MONGODB_COLLECTION ?? "books";
const INDEX_NAME = "books_autocomplete";
const MAX_POLL_ATTEMPTS = 60;
const POLL_INTERVAL_MS = 5000;

const INDEX_DEFINITION = {
  mappings: {
    dynamic: false,
    fields: {
      title: [
        {
          type: "autocomplete",
          tokenization: "edgeGram",
          minGrams: 2,
          maxGrams: 15,
          foldDiacritics: true,
        },
      ],
      authors: [
        {
          type: "autocomplete",
          tokenization: "edgeGram",
          minGrams: 2,
          maxGrams: 15,
          foldDiacritics: true,
        },
      ],
      isbn: { type: "string" },
      alternateIsbns: { type: "string" },
      language: { type: "token" },
      pendingReview: { type: "boolean" },
      translations: {
        type: "document",
        fields: {
          it: {
            type: "document",
            fields: {
              title: [
                {
                  type: "autocomplete",
                  tokenization: "edgeGram",
                  minGrams: 2,
                  maxGrams: 15,
                  foldDiacritics: true,
                },
              ],
              isbn: { type: "string" },
            },
          },
          en: {
            type: "document",
            fields: {
              title: [
                {
                  type: "autocomplete",
                  tokenization: "edgeGram",
                  minGrams: 2,
                  maxGrams: 15,
                  foldDiacritics: true,
                },
              ],
              isbn: { type: "string" },
            },
          },
        },
      },
    },
  },
};

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI non impostata.");
    process.exit(1);
  }

  const client = new MongoClient(mongoUri);
  await client.connect();

  try {
    const collection = client.db(DB_NAME).collection(COLLECTION_NAME);

    const existing = (await collection
      .listSearchIndexes(INDEX_NAME)
      .toArray()) as Array<{
      name: string;
      status?: string;
    }>;

    if (existing.length > 0) {
      console.log(
        `Indice "${INDEX_NAME}" già esistente, aggiorno la definizione...`,
      );
      await collection.updateSearchIndex(INDEX_NAME, INDEX_DEFINITION);
    } else {
      await collection.createSearchIndex({
        name: INDEX_NAME,
        definition: INDEX_DEFINITION,
      });
      console.log(`Indice "${INDEX_NAME}" creato, attendo che sia pronto...`);
    }

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      const indexes = (await collection
        .listSearchIndexes(INDEX_NAME)
        .toArray()) as Array<{
        name: string;
        status?: string;
        queryable?: boolean;
      }>;
      const status = indexes[0]?.status;
      console.log(`  stato: ${status}`);
      if (status === "READY" && indexes[0]?.queryable !== false) {
        console.log("Indice pronto.");
        return;
      }
      if (status === "FAILED") {
        console.error("Aggiornamento indice fallito.");
        process.exit(1);
      }
    }

    console.warn(
      "Timeout in attesa dell'indice: potrebbe essere ancora in costruzione su Atlas.",
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
