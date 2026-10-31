import { get, set } from "idb-keyval";
import type { PunchInput } from "@turnos/contract";
import { PunchQueue, type QueueStore } from "./punchQueue";

const KEY = "turnos:punch-queue";

const idbStore: QueueStore = {
  load: async () => (await get<PunchInput[]>(KEY)) ?? [],
  save: (punches) => set(KEY, punches),
};

export const punchQueue = new PunchQueue(idbStore);
