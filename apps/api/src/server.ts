import { PrismaClient } from "@prisma/client";
import { buildApp } from "./app";
import { memoryStore } from "./memoryStore";
import { prismaStore } from "./prismaStore";
import { demoData } from "./seed";
import type { Store } from "./store";

const port = Number(process.env.PORT ?? 3000);
const webOrigin = process.env.WEB_ORIGIN?.split(",") ?? "http://localhost:5173";

let store: Store;
if (process.env.DATABASE_URL) {
  store = prismaStore(new PrismaClient());
} else {
  console.warn("Sin DATABASE_URL: modo demo en memoria (tokens: dueno, ana, bruno). Nada se guarda.");
  store = memoryStore(demoData());
}

const app = buildApp({ store, webOrigin, logger: true });
await app.listen({ port, host: "0.0.0.0" });
