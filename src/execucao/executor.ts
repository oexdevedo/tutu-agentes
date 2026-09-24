import type { Compreensao, Contexto, Recibo } from "../nucleo/tipos.js";
import { registrar } from "./registrar.js";
import { consultarMes, consultarSaldo } from "./consultas.js";

/** DECIDIR E EXECUTAR: cada intenção vira uma ação de código que devolve recibo. Nada aqui é decidido pelo modelo. */
export async function executar(c: Compreensao, ctx: Contexto, mensagem: string, turnoId: string): Promise<Recibo[]> {
  const feitos = new Set<string>();
  const recibos: Recibo[] = [];
  for (const i0 of c.intencoes) {
    // sem conta citada, vale a conta fixa (normalmente vem do banco; na avaliação, do caso)
    const i = ("conta" in i0 && !i0.conta && ctx.conta_fixa_nome) ? { ...i0, conta: ctx.conta_fixa_nome } : i0;
    try {
      if (i.tipo === "registrar") recibos.push(await registrar(i, { phone: ctx.phone, mensagem, hoje: ctx.hoje, turnoId }, feitos));
      else if (i.tipo === "consultar_saldo") recibos.push(await consultarSaldo(i, ctx.phone, ctx.hoje));
      else if (i.tipo === "consultar_mes") recibos.push(await consultarMes(i, ctx.phone, ctx.hoje));
      else if (i.tipo === "outra") recibos.push({ ok: false, acao: "outra", efeito: 0, duplicado: false, itens: [], avisos: ["ainda_no_agente_antigo"], texto: i.descricao });
      // agradecimento e conversa: nada a executar
    } catch (e) {
      recibos.push({ ok: false, acao: i.tipo, efeito: 0, duplicado: false, itens: [], avisos: ["erro: " + String((e as Error).message).slice(0, 120)] });
    }
  }
  return recibos;
}
