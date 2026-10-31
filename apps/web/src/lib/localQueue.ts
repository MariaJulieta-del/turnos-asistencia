import { get, set } from "idb-keyval";
import type { Punch } from "@turnos/core";
import { PunchQueue, type QueueStore } from "./punchQueue";

const KEY = "turnos:punch-queue";

const idbStore: QueueStore = {
  load: async () => (await get<Punch[]>(KEY)) ?? [],
  save: (punches) => set(KEY, punches),
};

export const punchQueue = new PunchQueue(idbStore);
