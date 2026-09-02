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

// Reduz as linhas de tecido pra uma grade de produção (uma por modelo+variante).
// IMPORTANTE: a peça acabada é identificada por "Variante" (o colorway/SKU da
// peça — é o mesmo campo que a aba Precificação usa pra contar peça, "por
// variante (cor) do produto"), NÃO por "Cor" — esse último é a cor de cada
// TECIDO usado (corpo, forro, recorte...), e uma peça só pode ter mais de um
// tecido/cor pro mesmo colorway. Agrupar por "Cor" contava a mesma peça uma vez
// por tecido que ela usa — inflava a grade e o valor do contrato.
// "Tipo de Variante" NÃO é tamanho (P/M/G) — é outra classificação do tecido
// (ex: principal/secundário), sem relação com grade de tamanho. Essa planilha
// não tem uma coluna de tamanho de verdade, então todo mundo sai "Único" — se
// precisar de tamanho por peça, edita a grade direto no ERP depois de puxar.
function gradeFromRows(rows: FabricRow[]) {
  const seen = new Map<string, { modelo: string; cor: string; tamanho: string; quantidade: number }>();
  for (const r of rows) {
    const modelo = String(r.codigo ?? "").trim();
    const cor = String(r.variante ?? r.cor ?? "").trim();
    const tamanho = "Único";
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
// Vem também qtdCompra/selecionado (aba Revenda) quando existir — é a
// quantidade NEGOCIADA com esse comprador específico, que pode ser menor que
// o total do corte (ex: pedido parcial/proposta), e o modelo pode ter sido
// desmarcado da proposta inteiramente. Sem isso, o ERP calcularia em cima do
// corte da coleção toda, não da compra real desse cliente.
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
  let qtdCompra: Record<string, number> = {};
  let selecionados: Record<string, boolean> = {};
  let debug = "nunca salvou pricingJson nenhum (aba Precificação nunca chegou a persistir)";
  try {
    const parsed = p.pricingJson ? JSON.parse(p.pricingJson) : null;
    precos = parsed?.precos ?? [];
    qtdCompra = parsed?.revenda?.qtdCompra ?? {};
    selecionados = parsed?.revenda?.selecionados ?? {};
    if (p.pricingJson && parsed && !("precos" in parsed)) debug = "pricingJson salvo é de antes dessa funcionalidade existir (sem a chave 'precos') — reabra a aba Precificação uma vez pra atualizar.";
    else if (p.pricingJson) debug = `pricingJson salvo, mas 'precos' veio com ${precos.length} item(ns)`;
  } catch {
    debug = "pricingJson salvo não é um JSON válido";
  }
  res.json({
    precos: precos.map((r) => ({
      modelo: r.cod,
      precoUnitario: r.precoAtacado,
      qtdCompra: qtdCompra[r.cod] ?? null, // null = usa a quantidade da grade (não tem proposta de revenda com número próprio pra esse modelo)
      selecionado: selecionados[r.cod] ?? true, // desmarcado na Revenda = fora da proposta desse comprador
    })),
    debug,
  });
});

// Consumo de tecido por modelo, pra alimentar a Ordem de Corte do ERP (peso
// total do enfesto, custo de matéria-prima etc.) — mesma fórmula já usada e
// validada dentro da aba Precificação (PricingTab.calcModel/precoPorKg), só
// exposta aqui pro outro app não reimplementar nem inventar número por conta
// própria. Sempre normalizado em Kg (mesmo pra tecido precificado por metro,
// convertido via gramatura), então o ERP só multiplica por quantidade e
// preço, sem precisar lidar com unidade/gramatura.
externalApiRouter.get("/api/external/projetos/:id/materiais", requireApiKey, async (req, res) => {
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
  let plmData: ImportResult["plmData"] | undefined;
  try {
    const parsed = JSON.parse(p.dataJson) as ImportResult;
    rows = parsed.rows ?? [];
    plmData = parsed.plmData;
  } catch {
    rows = [];
  }

  // Preço/unidade/gramatura configurados na aba Precificação (pricingJson.pricing.tecidos)
  // têm prioridade — é o que a usuária efetivamente ajustou lá; cai pro preço
  // inicial importado do PLM (plmData.tecidos) se a aba nunca foi aberta/salva.
  let tecidosCfg: Record<string, { preco: number; unidade: "kg" | "metro"; gramatura: number }> = {};
  try {
    const parsed = p.pricingJson ? JSON.parse(p.pricingJson) : null;
    tecidosCfg = parsed?.pricing?.tecidos ?? plmData?.tecidos ?? {};
  } catch {
    tecidosCfg = plmData?.tecidos ?? {};
  }

  const precoPorKg = (tecido: string): number => {
    const tc = tecidosCfg[tecido];
    if (!tc) return 0;
    if (tc.unidade === "kg") return tc.preco;
    return tc.gramatura > 0 ? tc.preco / (tc.gramatura / 1000) : 0;
  };

  // Mesmo dedup da aba Precificação: um tecido só entra uma vez por modelo
  // (a primeira cor que aparece manda), preferindo o Kg confiável da aba
  // "Tecidos" do PLM (consumoPorCodigo) e caindo pro Consumo da linha só se
  // faltar — ver comentário equivalente em excelImport.ts/PricingTab.tsx.
  const byModelo = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const modelo = String(r.codigo ?? "").trim();
    const tecido = String(r.tecido ?? "").trim();
    if (!modelo || !tecido) continue;
    if (!byModelo.has(modelo)) byModelo.set(modelo, new Map());
    const porTecido = byModelo.get(modelo)!;
    if (porTecido.has(tecido)) continue;
    const doPlm = plmData?.consumoPorCodigo?.[modelo]?.[tecido];
    porTecido.set(tecido, doPlm ?? (Number(r.consumo) || 0));
  }

  const materiais = [...byModelo.entries()].flatMap(([modelo, tecidos]) =>
    [...tecidos.entries()].map(([tecido, consumoPorPecaKg]) => ({
      modelo,
      tecido,
      consumoPorPecaKg,
      precoPorKg: precoPorKg(tecido),
    }))
  );

  res.json({ materiais });
});
