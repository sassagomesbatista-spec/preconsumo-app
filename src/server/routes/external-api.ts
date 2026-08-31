// API externa pro ERP (erp-comissao) puxar a grade (modelo/cor/tamanho/quantidade)
// de um projeto já vinculado, na hora de criar a Ordem de Produção — pra não
// obrigar redigitar ali algo que já foi lançado aqui. Autenticado pela mesma
// chave fixa usada na outra direção (ver src/server/routers/erpBridge.ts),
// guardada aqui em process.env.ERP_API_KEY.
import { Router } from "express";
import { db } from "../db/index.js";
import { projects } from "../db/schema.js";
import { eq } from "drizzle-orm";
import type { ImportResult, FabricRow } from "../../types.js";

export const externalApiRouter = Router();

function requireApiKey(req: any, res: any, next: any) {
  const expected = process.env.ERP_API_KEY;
  if (!expected || req.headers["x-api-key"] !== expected) {
    res.status(401).json({ error: "Chave inválida." });
    return;
  }
  next();
}

// Reduz as linhas de tecido pra uma grade de produção (uma por modelo+variante+
// tamanho). IMPORTANTE: a peça acabada é identificada por "Variante" (o
// colorway/SKU da peça — é o mesmo campo que a aba Precificação usa pra contar
// peça, "por variante (cor) do produto"), NÃO por "Cor" — esse último é a cor
// de cada TECIDO usado (corpo, forro, recorte...), e uma peça só pode ter mais
// de um tecido/cor pro mesmo colorway. Agrupar por "Cor" contava a mesma peça
// uma vez por tecido que ela usa — inflava a grade e o valor do contrato.
function gradeFromRows(rows: FabricRow[]) {
  const seen = new Map<string, { modelo: string; cor: string; tamanho: string; quantidade: number }>();
  for (const r of rows) {
    const modelo = String(r.codigo ?? "").trim();
    const cor = String(r.variante ?? r.cor ?? "").trim();
    const tamanho = String(r.tipoVariante ?? "").trim() || "Único";
    const quantidade = Number(r.qtadeACortar) || 0;
    if (!modelo || !cor || quantidade <= 0) continue;
    const key = `${modelo}|${cor}|${tamanho}`;
    if (!seen.has(key)) seen.set(key, { modelo, cor, tamanho, quantidade });
  }
  return Array.from(seen.values());
}

externalApiRouter.get("/api/external/projetos/:id/grade", requireApiKey, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "id inválido." });
    return;
  }
  const [p] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!p) {
    res.status(404).json({ error: "Projeto não encontrado." });
    return;
  }
  let rows: FabricRow[] = [];
  try {
    rows = (JSON.parse(p.dataJson) as ImportResult).rows ?? [];
  } catch {
    rows = [];
  }
  res.json({ grade: gradeFromRows(rows), clientName: p.clientName, colecao: p.colecao });
});

// Preço unitário (atacado) por modelo, já calculado aqui na aba Precificação —
// o ERP não reimplementa a fórmula (tecido, mão de obra, outros custos, nº de
// operações, ajuste manual por código...), só lê o resultado já aprovado.
// Vem vazio se ninguém nunca abriu a aba Precificação desse projeto.
externalApiRouter.get("/api/external/projetos/:id/precos", requireApiKey, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "id inválido." });
    return;
  }
  const [p] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!p) {
    res.status(404).json({ error: "Projeto não encontrado." });
    return;
  }
  let precos: Array<{ cod: string; tipo: string; precoAtacado: number; totalPecas: number }> = [];
  let debug = "nunca salvou pricingJson nenhum (aba Precificação nunca chegou a persistir)";
  try {
    const parsed = p.pricingJson ? JSON.parse(p.pricingJson) : null;
    precos = parsed?.precos ?? [];
    if (p.pricingJson && parsed && !("precos" in parsed)) debug = "pricingJson salvo é de antes dessa funcionalidade existir (sem a chave 'precos') — reabra a aba Precificação uma vez pra atualizar.";
    else if (p.pricingJson) debug = `pricingJson salvo, mas 'precos' veio com ${precos.length} item(ns)`;
  } catch {
    debug = "pricingJson salvo não é um JSON válido";
  }
  res.json({ precos: precos.map((r) => ({ modelo: r.cod, precoUnitario: r.precoAtacado })), debug });
});
