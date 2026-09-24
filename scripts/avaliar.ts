// Avalia o Tutu Core no MESMO banco de casos do agente atual (tutu_avaliacao_casos, n8n/avaliacao).
// Modo sombra: nada grava. Mede EFEITO (o que teria sido gravado), não tentativa.
// Casos que pedem ações que o Core ainda não faz (editar, apagar, pagar conta...) contam à parte:
// ali o certo é classificar como "outra" (vai pro agente antigo) e não gravar nada.
//   npx tsx scripts/avaliar.ts [--rep 2] [--rotulo "..."]
import { processarTurno } from "../src/turno.js";
import { ler, inserir } from "../src/supa.js";
import { config } from "../src/config.js";
import type { Intencao, Recibo, Turno } from "../src/nucleo/tipos.js";

type Esp = Record<string, any>;
interface Chamada { tool: string; input: Record<string, unknown>; escrita: boolean }
const DO_CORE = new Set(["registrar_lancamento", "consultar_saldo", "consultar_cartoes", "receitas", "despesas_fixas"]);
const LEITURA = /^(listar|listar_recorrentes)$/;
const CLAIM = /(?<!já )(?<!ja )\b(anotei|registrei|lancei|exclu[ií]|apaguei|removi|atualizei|alterei|editei|marquei|dei baixa|quitei|cadastrei|troquei|mudei|guardei|coloquei|depositei|salvei|ajustei|corrigi)\b/i;
const PERGUNTOU = /(anot(ou|aste|ado|ada)|registr(ou|aste|ado|ada)|lan[çc](ou|aste|ado|ada)|t[áa] (anotad|registrad|lan[çc]ad))[^?]*\?/i;
const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const ontem = () => new Date(Date.now() - 864e5).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** O que o Core fez, no vocabulário das ferramentas do n8n (para usar as mesmas regras dos casos). */
function chamadas(t: Turno): Chamada[] {
  const out: Chamada[] = [];
  t.compreensao.intencoes.forEach((i: Intencao) => {
    if (i.tipo === "registrar") {
      const r = t.recibos.find(x => (x.acao === "registrar" || x.acao === "registrar_cartao") && x.itens?.[0]?.valor === i.valor && !(x as any)._usado);
      if (r) (r as any)._usado = true;
      const efetivo = !!r && r.ok && r.efeito > 0;
      out.push({ tool: "registrar_lancamento", escrita: efetivo, input: { tipo: i.natureza, valor: i.valor, forma_pagamento: i.forma_pagamento ?? "", conta: i.conta ?? r?.itens?.[0]?.conta ?? "", data_lancamento: i.data ?? hoje(), origem_dinheiro: i.origem_dinheiro ?? "", descricao: i.descricao } });
    } else if (i.tipo === "consultar_saldo") out.push({ tool: "consultar_saldo", escrita: false, input: { conta: i.conta ?? "" } });
    else if (i.tipo === "consultar_cartoes") out.push({ tool: "consultar_cartoes", escrita: false, input: { conta: i.conta ?? "" } });
    else if (i.tipo === "consultar_mes") out.push({ tool: i.o_que === "receitas" ? "receitas" : "despesas_fixas", escrita: false, input: { acao: i.o_que === "fixas" ? "listar_recorrentes" : "listar", mes: i.mes ?? "" } });
    else if (i.tipo === "outra") out.push({ tool: "outra", escrita: false, input: { descricao: i.descricao } });
  });
  return out;
}

function campoOk(esp: unknown, atual: unknown, k: string) {
  if (k === "data") { const a = String(atual ?? "").slice(0, 10); return a === (esp === "hoje" ? hoje() : esp === "ontem" ? ontem() : esp); }
  if (typeof esp === "number") return Math.abs(Number(atual) - esp) < 0.011;
  return norm(atual).includes(norm(esp));
}
const casa = (spec: any, c: Chamada) => typeof spec === "string" ? c.tool === spec :
  c.tool === spec.tool && Object.entries(spec.campos ?? {}).every(([k, v]) => campoOk(v, k === "data" ? c.input.data_lancamento : c.input[k], k));

function conferir(esp: Esp, cs: Chamada[], saida: string): string[] {
  if (esp.alternativas) {
    const resto = Object.fromEntries(Object.entries(esp).filter(([k]) => k !== "alternativas" && k !== "meta"));
    const ts = esp.alternativas.map((a: Esp) => conferir({ ...a, ...resto }, cs, saida));
    return ts.some((t: string[]) => !t.length) ? [] : ["nenhuma alternativa: " + ts.map((t: string[]) => t.join("; ")).join(" | ")];
  }
  const f: string[] = [], escritas = cs.filter(c => c.escrita);
  for (const s of esp.chamar ?? []) { const n = cs.filter(c => casa(s, c)).length; if (s.n != null ? n !== s.n : n === 0) f.push(`faltou ${s.tool} ${JSON.stringify(s.campos ?? {})}`); }
  for (const s of esp.nao_chamar ?? []) { if (s === "*escrita" ? escritas.length : cs.some(c => casa(s, c))) f.push(`fez o proibido ${JSON.stringify(s)}`); }
  if (esp.total_escritas != null && escritas.length !== esp.total_escritas) f.push(`gravaria ${escritas.length}, esperado ${esp.total_escritas} (${escritas.map(c => c.input.valor).join(", ")})`);
  for (const rx of esp.proibido ?? []) if (new RegExp(rx, "i").test(saida)) f.push(`resposta tem /${rx}/`);
  for (const rx of esp.exige ?? []) if (!new RegExp(rx, "i").test(saida)) f.push(`resposta sem /${rx}/`);
  return f;
}
/** O caso pede alguma ação que o Core ainda não executa? */
function foraDoEscopo(esp: Esp, grupo = ""): boolean {
  if (["excluir", "editar"].includes(grupo)) return true;   // apagar/editar ainda é do agente antigo
  const specs = [...(esp.chamar ?? []), ...((esp.alternativas ?? []).flatMap((a: Esp) => a.chamar ?? []))];
  if (!specs.length) return false;
  const podeCore = (s: any) => DO_CORE.has(s.tool) && !(["despesas_fixas", "receitas"].includes(s.tool) && s.campos?.acao && !LEITURA.test(s.campos.acao)) && !(s.tool === "despesas_fixas" && s.campos?.valor);
  return esp.alternativas ? !(esp.alternativas as Esp[]).some(a => (a.chamar ?? []).every(podeCore)) : !specs.every(podeCore);
}

const args = process.argv.slice(2);
const rep = Number(args[args.indexOf("--rep") + 1]) || 1;
const rotulo = args.includes("--rotulo") ? args[args.indexOf("--rotulo") + 1] : "";
const filtro = args.includes("--caso") ? new Set(args[args.indexOf("--caso") + 1].split(",")) : null;
const casos = (await ler<any[]>("tutu_avaliacao_casos?ativo=eq.true&select=*&order=grupo,id")).filter(c => !filtro || filtro.has(c.id));
const res: any[] = [];
const fila = casos.flatMap(c => Array.from({ length: rep }, (_, r) => ({ c, r })));
async function trabalhador() {
  for (let it = fila.shift(); it; it = fila.shift()) {
    const { c, r } = it; const fora = foraDoEscopo(c.esperado, c.grupo);
    try {
      const t = await processarTurno({ phone: c.entrada.phone ?? "0", mensagem: c.entrada.mensagem, historico: c.entrada.historico ?? [], gravarSombra: false, contextoFixo: c.entrada });
      const cs = chamadas(t);
      const falhas = fora
        ? [...(cs.some(x => x.escrita) ? ["fora do escopo mas gravaria"] : []), ...(cs.some(x => x.tool === "outra") ? [] : ["não mandou pro agente antigo"])]
        : [...conferir(c.esperado, cs, t.resposta), ...(CLAIM.test(t.resposta) && !PERGUNTOU.test(c.entrada.mensagem ?? "") && !cs.some(x => x.escrita) ? ["prometeu e não fez"] : [])];
      res.push({ caso: c.id, grupo: c.grupo, rep: r, meta: !!c.esperado.meta, fora, passou: !falhas.length, falhas, resposta: t.resposta, intencoes: t.compreensao.intencoes, ms: t.ms, tokens: t.tokens });
    } catch (e) { res.push({ caso: c.id, grupo: c.grupo, rep: r, fora, meta: !!c.esperado.meta, passou: false, falhas: ["erro: " + (e as Error).message.slice(0, 150)] }); }
  }
}
await Promise.all([trabalhador()]);   // um por vez: a cota do Bedrock é baixa
const conta = res.filter(x => !x.meta && !x.fora), fora = res.filter(x => x.fora);
const ok = conta.filter(x => x.passou).length;
console.log(`\nCORE (${config.modelo}) — no escopo: ${ok}/${conta.length} (${Math.round(100 * ok / Math.max(1, conta.length))}%) · fora do escopo, roteado certo: ${fora.filter(x => x.passou).length}/${fora.length}`);
const ms = res.filter(x => x.ms).map(x => x.ms).sort((a, b) => a - b), tk = res.filter(x => x.tokens);
console.log(`tempo mediano ${ms[Math.floor(ms.length / 2)]} ms · tokens médios ${Math.round(tk.reduce((s, x) => s + x.tokens.entrada, 0) / tk.length)} entrada + ${Math.round(tk.reduce((s, x) => s + x.tokens.saida, 0) / tk.length)} saída`);
const grupos: Record<string, boolean[]> = {}; for (const x of conta) (grupos[x.grupo] ??= []).push(x.passou);
for (const [g, v] of Object.entries(grupos).sort()) console.log(`  ${g.padEnd(12)} ${v.filter(Boolean).length}/${v.length}`);
for (const x of res.filter(x => !x.passou)) console.log(`✗ ${x.caso}${x.fora ? " (fora do escopo)" : ""}${x.meta ? " (meta)" : ""}: ${x.falhas.join("; ")}`);
await inserir("tutu_avaliacao_rodadas", { rotulo: `CORE ${rotulo}`.trim(), modelo: config.modelo, total: conta.length, passou: ok, resultados: res }).catch(() => {});
