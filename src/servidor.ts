import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { config } from "./config.js";
import { processarTurno } from "./turno.js";

// POST /v1/turno  { phone, mensagem, execucao_id? }  (Authorization: Bearer CORE_TOKEN)  → turno
// GET  /saude
const autorizado = (h?: string) => {
  const a = Buffer.from(String(h ?? "").replace(/^Bearer\s+/i, "")), b = Buffer.from(config.token());
  return a.length === b.length && timingSafeEqual(a, b);
};
const responder = (res: import("node:http").ServerResponse, status: number, corpo: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(corpo));
};

createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/saude") return responder(res, 200, { ok: true, modo: config.modo, modelo: config.modelo });
    if (req.method !== "POST" || req.url !== "/v1/turno") return responder(res, 404, { erro: "rota" });
    if (!autorizado(req.headers.authorization)) return responder(res, 401, { erro: "não autorizado" });
    let corpo = ""; for await (const p of req) { corpo += p; if (corpo.length > 100_000) return responder(res, 413, { erro: "grande demais" }); }
    const b = JSON.parse(corpo || "{}");
    if (!b.phone || !b.mensagem) return responder(res, 400, { erro: "phone e mensagem são obrigatórios" });
    const t = await processarTurno({ phone: String(b.phone), mensagem: String(b.mensagem), execucao_id: b.execucao_id ? String(b.execucao_id) : undefined });
    return responder(res, 200, { resposta: t.resposta, intencoes: t.compreensao, recibos: t.recibos, guardrail: t.guardrail, ms: t.ms, tokens: t.tokens, modo: config.modo });
  } catch (e) {
    console.error(e);
    return responder(res, 500, { erro: "falha no turno", detalhe: String((e as Error).message).slice(0, 200) });
  }
}).listen(config.porta, () => console.log(`Tutu Core no ar na porta ${config.porta} (modo ${config.modo}, ${config.modelo})`));
