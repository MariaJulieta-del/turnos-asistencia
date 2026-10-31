import type { PunchInput } from "@turnos/contract";
import type { Punch, PunchType } from "@turnos/core";

/**
 * Dónde vive la cola. En el navegador es IndexedDB (localQueue.ts); en tests, memoria.
 * Cada marca guarda su ubicación (si la hubo) tomada en el instante de fichar, así un envío
 * posterior sin señal no la pierde ni la vuelve a pedir.
 */
export interface QueueStore {
  load(): Promise<PunchInput[]>;
  save(punches: PunchInput[]): Promise<void>;
}

/** Crea una marca con su clientEventId. El servidor deduplica por ese id, así reenviar nunca duplica. */
export function newPunch(
  employeeId: string,
  type: PunchType,
  at: number = Date.now(),
  makeId: () => string = () => crypto.randomUUID(),
): Punch {
  return { id: makeId(), employeeId, type, at };
}

export interface FlushResult {
  sent: number;
  remaining: number;
}

/**
 * Cola offline de marcas. Una marca sale de la cola solo cuando el servidor confirmó que la recibió:
 * si no hay señal, queda guardada en el celular y se reintenta.
 */
export class PunchQueue {
  private chain: Promise<unknown> = Promise.resolve();
  private flushing: Promise<FlushResult> | null = null;

  constructor(private readonly store: QueueStore) {}

  /** Serializa lecturas/escrituras para que un enqueue durante un flush no pise la cola. */
  private run<T>(op: () => Promise<T>): Promise<T> {
    const next = this.chain.then(op, op);
    this.chain = next.catch(() => undefined);
    return next;
  }

  enqueue(p: PunchInput): Promise<void> {
    return this.run(async () => {
      const list = await this.store.load();
      if (!list.some((x) => x.id === p.id)) await this.store.save([...list, p]);
    });
  }

  pending(): Promise<PunchInput[]> {
    return this.run(() => this.store.load());
  }

  /** Envía en orden y corta en el primer error (sin señal no tiene sentido seguir probando). */
  flush(send: (p: PunchInput) => Promise<void>): Promise<FlushResult> {
    this.flushing ??= this.doFlush(send).finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async doFlush(send: (p: PunchInput) => Promise<void>): Promise<FlushResult> {
    let sent = 0;
    for (const p of await this.pending()) {
      try {
        await send(p);
      } catch {
        break;
      }
      await this.run(async () => {
        await this.store.save((await this.store.load()).filter((x) => x.id !== p.id));
      });
      sent++;
    }
    return { sent, remaining: (await this.pending()).length };
  }
}

export function memoryStore(initial: PunchInput[] = []): QueueStore {
  let data = [...initial];
  return {
    load: async () => [...data],
    save: async (p) => {
      data = [...p];
    },
  };
}
