import { config } from "../config.js";
import { rpc } from "../supa.js";
import { SO_AGRADECIMENTO, emCentavos, valorEstaNaMensagem } from "../nucleo/valores.js";
import type { Intencao, Recibo } from "../nucleo/tipos.js";
import { resolverConta } from "./conta.js";

type Registrar = Extract<Intencao, { tipo: "registrar" }>;
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const falha = (aviso: string, extra: Partial<Recibo> = {}): Recibo =>
  ({ ok: false, acao: "registrar", efeito: 0, duplicado: false, itens: [], avisos: [aviso], ...extra });

/**
 * Registra UM lançamento. Travas (vêm da Fase 1, determinísticas — não dependem do modelo):
 *  1) 👍/obrigado não cria lançamento;
 *  2) o valor tem que estar na mensagem atual (ou a mensagem é só confirmação, sem número);
 *  3) a conta citada precisa existir e ser da pessoa;
 *  4) a mesma coisa no mesmo turno não grava duas vezes (chave de idempotência).
 */
export async function registrar(i: Registrar, ctx: { phone: string; mensagem: string; hoje: string; turnoId: string }, jaFeitos: Set<string>): Promise<Recibo> {
  if (SO_AGRADECIMENTO.test(ctx.mensagem.trim())) return falha("so_confirmacao");
  if (!valorEstaNaMensagem(i.valor, ctx.mensagem)) return falha("fora_da_mensagem");
  const conta = await resolverConta(ctx.phone, i.conta);
  if (!conta.ok) return falha(conta.erro === "ambigua" ? "conta_ambigua" : "conta_invalida",
    { texto: conta.contas?.length ? `Contas: pessoal, ${conta.contas.map(c => c.nome).join(", ")}` : undefined });

  const data = /^\d{4}-\d{2}-\d{2}$/.test(i.data ?? "") ? i.data! : ctx.hoje;
  const chave = `core:${ctx.turnoId}:${i.natureza}:${emCentavos(i.valor)}:${norm(i.descricao)}:${data}:${conta.conta_id ?? "p"}`;
  const item = { descricao: i.descricao, valor: i.valor, data, conta: conta.conta_nome, natureza: i.natureza,
                 forma_pagamento: i.forma_pagamento ?? null, pago: i.pago !== false };
  if (jaFeitos.has(chave)) return { ok: true, acao: "registrar", efeito: 0, duplicado: true, itens: [item], avisos: [] };
  jaFeitos.add(chave);

  if (config.modo === "sombra") {
    return { ok: true, acao: i.forma_pagamento === "credito" ? "registrar_cartao" : "registrar", efeito: 1, duplicado: false, simulado: true, itens: [item], avisos: [] };
  }
  if (i.forma_pagamento === "credito") return falha("cartao_ainda_pelo_n8n"); // cartão ainda passa pelo fluxo antigo
  const descricao = (i.origem_dinheiro === "reserva" && i.natureza === "despesa" ? "[Da reserva] " : "") + i.descricao;
  const r = await rpc<Recibo>("fn_lancamento_whatsapp", {
    p_user_id: conta.user_id, p_tipo: i.natureza, p_valor: i.valor, p_descricao: descricao, p_data: data,
    p_confirmado: i.pago === false ? false : data <= ctx.hoje, p_familia_id: conta.conta_id, p_categoria: i.categoria ?? "Outros", p_idem: chave,
  });
  return { ...r, itens: (r.itens ?? []).map(x => ({ ...x, conta: conta.conta_nome })), avisos: r.avisos ?? [] };
}
