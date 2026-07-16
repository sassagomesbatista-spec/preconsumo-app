import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { projects } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";

export const projectsRouter = router({
  // Lista o histórico (visível para todos os usuários logados)
  list: protectedProcedure.query(async () => {
    return db
      .select({
        id: projects.id,
        clientName: projects.clientName,
        colecao: projects.colecao,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .orderBy(desc(projects.updatedAt));
  }),

  // Carrega um projeto completo
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const [p] = await db.select().from(projects).where(eq(projects.id, input.id)).limit(1);
      if (!p) throw new TRPCError({ code: "NOT_FOUND" });
      return p;
    }),

  // Cria ou atualiza (se id for enviado) um projeto
  save: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      clientName: z.string().default(""),
      colecao: z.string().default(""),
      dataJson: z.string(),
      pricingJson: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (input.id) {
        await db.update(projects).set({
          clientName: input.clientName,
          colecao: input.colecao,
          dataJson: input.dataJson,
          pricingJson: input.pricingJson,
        }).where(eq(projects.id, input.id));
        return { id: input.id };
      }
      await db.insert(projects).values({
        ownerId: ctx.user.userId,
        clientName: input.clientName,
        colecao: input.colecao,
        dataJson: input.dataJson,
        pricingJson: input.pricingJson,
      });
      const [latest] = await db.select({ id: projects.id }).from(projects).orderBy(desc(projects.id)).limit(1);
      return { id: latest.id };
    }),

  // Remove um projeto do histórico (apenas admin)
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await db.delete(projects).where(eq(projects.id, input.id));
      return { ok: true };
    }),
});
