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

// Reduz as linhas de tecido (uma por modelo+cor+tamanho+tecido) pra uma grade
// de produção (uma por modelo+cor+tamanho, sem repetir por causa dos vários
// tecidos que a mesma peça pode usar).
function gradeFromRows(rows: FabricRow[]) {
  const seen = new Map<string, { modelo: string; cor: string; tamanho: string; quantidade: number }>();
  for (const r of rows) {
    const modelo = String(r.codigo ?? "").trim();
    const cor = String(r.cor ?? "").trim();
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
  try {
    const parsed = p.pricingJson ? JSON.parse(p.pricingJson) : null;
    precos = parsed?.precos ?? [];
  } catch {
    precos = [];
  }
  res.json({ precos: precos.map((r) => ({ modelo: r.cod, precoUnitario: r.precoAtacado })) });
});
