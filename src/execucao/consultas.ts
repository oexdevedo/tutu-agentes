import { ler, rpc } from "../supa.js";
import type { Intencao, Recibo } from "../nucleo/tipos.js";
import { resolverConta } from "./conta.js";
import { formatarCartoes } from "./cartoes_formato.js";

const brl = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const leitura = (acao: string, texto: string, ok = true, avisos: string[] = []): Recibo =>
  ({ ok, acao, efeito: 0, duplicado: false, leitura: true, itens: [], avisos, texto });

/** Saldo: mesma fonte do app (fn_saldo_escopo). Conta PJ não tem "pode gastar hoje" (pedido de 24/09). */
export async function consultarSaldo(i: Extract<Intencao, { tipo: "consultar_saldo" }>, phone: string, hoje: string): Promise<Recibo> {
  const conta = await resolverConta(phone, i.conta);
  if (!conta.ok || !conta.user_id) return leitura("consultar_saldo", "Não achei essa conta.", false, [conta.erro ?? "conta"]);
  const s = await rpc<Record<string, number>>("fn_saldo_escopo", { p_user_id: conta.user_id, p_month: null, p_conta: conta.conta_id });
  const linhas = [
    `Conta: ${conta.conta_nome}${conta.conta_tipo === "pj" ? " (PJ)" : ""}`,
    `Entrou no mês (confirmado): ${brl(s.receitas_confirmadas)}`,
    `Saiu no mês (confirmado): ${brl(s.despesas_confirmadas)}`,
    `Saldo do mês: ${brl(s.saldo_atual)}`,
  ];
  if (conta.conta_tipo === "pj") linhas.push("Conta PJ não tem limite do dia; para gastar no pessoal, tirar pró-labore.");
  else if (!conta.conta_id) {
    const l = (await rpc<{ limite: number; gasto: number }[]>("fn_limite_diario_periodo", { p_user_id: conta.user_id, p_ini: hoje, p_fim: hoje }))?.[0];
    if (l) linhas.push(`Limite de hoje: ${brl(Math.max(0, l.limite))} · gasto hoje: ${brl(l.gasto)} · ainda pode: ${brl(Math.max(0, l.limite - l.gasto))}`);
  }
  return leitura("consultar_saldo", linhas.join("\n"));
}

/** Lista do MÊS (não "do mês em diante" — bug do Uilton), somando itens de mesmo nome. */
export async function consultarMes(i: Extract<Intencao, { tipo: "consultar_mes" }>, phone: string, hoje: string): Promise<Recibo> {
  const conta = await resolverConta(phone, i.conta);
  if (!conta.ok || !conta.filtro) return leitura("consultar_mes", "Não achei essa conta.", false, [conta.erro ?? "conta"]);
  const [y, m] = (/^\d{4}-\d{2}$/.test(i.mes ?? "") ? i.mes! : hoje.slice(0, 7)).split("-").map(Number);
  const ini = `${y}-${String(m).padStart(2, "0")}-01`, fim = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const tabela = i.o_que === "receitas" ? "incomes" : "expenses";
  const rows = await ler<{ description: string; amount: number; is_confirmed: boolean }[]>(
    `${tabela}?${conta.filtro}&date=gte.${ini}&date=lt.${fim}${i.o_que === "fixas" ? "&is_recurring=eq.true" : ""}&select=description,amount,is_confirmed&limit=5000`);
  const soma = new Map<string, { v: number; n: number }>();
  for (const r of rows.filter(r => !/^\s*\[Ignorado\]/i.test(r.description ?? ""))) {
    const k = (r.description ?? "").trim() || "(sem nome)"; const a = soma.get(k) ?? { v: 0, n: 0 };
    soma.set(k, { v: a.v + Number(r.amount), n: a.n + 1 });
  }
  const lista = [...soma.entries()].sort((a, b) => b[1].v - a[1].v);
  const total = lista.reduce((s, [, x]) => s + x.v, 0);
  const rot = `${i.o_que} de ${MESES[m - 1]}`;
  const texto = lista.length
    ? `${rot} (${conta.conta_nome}):\n` + lista.slice(0, 20).map(([k, x]) => `• ${k} — ${brl(x.v)}${x.n > 1 ? ` (${x.n}x)` : ""}`).join("\n") + (lista.length > 20 ? `\n… e mais ${lista.length - 20}` : "") + `\nTotal: ${brl(total)}`
    : `Sem ${rot} lançadas.`;
  return leitura("consultar_mes", texto);
}

/** Cartões de crédito da conta: limite usado/disponível, última fatura, parcelas futuras (fn_cartao_uso). */
export async function consultarCartoes(i: Extract<Intencao, { tipo: "consultar_cartoes" }>, phone: string, hoje: string): Promise<Recibo> {
  const conta = await resolverConta(phone, i.conta);
  if (!conta.ok || !conta.user_id) return leitura("consultar_cartoes", "Não achei essa conta.", false, [conta.erro ?? "conta"]);
  const cs = await rpc<any[]>("fn_cartao_uso", { p_familia_id: conta.conta_id, p_user_id: conta.user_id });
  const r = leitura("consultar_cartoes", formatarCartoes(cs ?? [], hoje, conta.conta_nome));
  r.itens = (cs ?? []).map(c => ({ cartao: c.nome, final: c.final_principal, limite: c.limite, usado: c.consumido, perc: c.perc }));
  return r;
}
