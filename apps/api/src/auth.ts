import { createHash } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthUser, Role, Store } from "./store";

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}

/** Los tokens de los enlaces personales se guardan hasheados (User.accessTokenHash). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Autenticación por token de enlace (Authorization: Bearer <token>).
 * PROVISORIO para el dueño: la forma de autenticarlo es una decisión abierta (docs/ARQUITECTURA.md).
 */
export function requireRole(store: Store, roles: readonly Role[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
    const user = token ? await store.findUserByTokenHash(hashToken(token)) : null;
    if (!user) return reply.code(401).send({ error: "Enlace no válido o vencido" });
    if (!roles.includes(user.role)) return reply.code(403).send({ error: "Sin permiso" });
    req.user = user;
  };
}
