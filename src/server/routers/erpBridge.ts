// Ponte com o ERP (erp-comissao) — busca pedidos aprovados e grava o vínculo,
// tanto aqui (projects.erpQuoteId) quanto lá (quotes.preconsumoProjectUrl).
// Autenticado por chave fixa (a mesma configurada em Configurações →
// Integração Préconsumo, do lado do ERP).
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { projects } from "../db/schema.js";
import { eq } from "drizzle-orm";

function erpConfig() {
  const baseUrl = process.env.ERP_API_URL;
  const apiKey = process.env.ERP_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Integração com o ERP não configurada (ERP_API_URL/ERP_API_KEY)." });
  }
  return { baseUrl, apiKey };
}

export const erpBridgeRouter = router({
  searchPedidos: protectedProcedure
    .input(z.object({ search: z.string().min(1) }))
    .query(async ({ input }) => {
      const { baseUrl, apiKey } = erpConfig();
      const res = await fetch(`${baseUrl}/api/external/pedidos?search=${encodeURIComponent(input.search)}`, {
        headers: { "x-api-key": apiKey },
      });
      if (!res.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `ERP respondeu ${res.status}` });
      const data = (await res.json()) as any;
      return data.pedidos as Array<{ id: number; number: string; clientName: string }>;
    }),

  // Vincula um projeto (já salvo, com id) a um pedido do ERP — grava dos dois
  // lados: aqui (erpQuoteId/erpQuoteNumber) e lá (preconsumoProjectUrl).
  linkPedido: protectedProcedure
    .input(z.object({ projectId: z.number(), quoteId: z.number(), quoteNumber: z.string() }))
    .mutation(async ({ input }) => {
      const { baseUrl, apiKey } = erpConfig();
      const appUrl = process.env.APP_URL ?? "";
      const projectUrl = `${appUrl}/?project=${input.projectId}`;

      const res = await fetch(`${baseUrl}/api/external/pedidos/${input.quoteId}/vincular-preconsumo`, {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ url: projectUrl }),
      });
      if (!res.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `ERP respondeu ${res.status} ao vincular.` });

      await db.update(projects).set({ erpQuoteId: input.quoteId, erpQuoteNumber: input.quoteNumber }).where(eq(projects.id, input.projectId));
      return { ok: true };
    }),
});
