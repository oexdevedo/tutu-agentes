import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { inserir } from "./supa.js";
import { carregarContexto } from "./nucleo/contexto.js";
import { compreender } from "./nucleo/compreensao.js";
import { falar } from "./nucleo/voz.js";
import { conferir } from "./nucleo/guardrail.js";
import { executar } from "./execucao/executor.js";
import type { Turno } from "./nucleo/tipos.js";

/** Um turno completo: entender → decidir/executar (recibos) → falar → conferir. */
export async function processarTurno(entrada: { phone: string; mensagem: string; execucao_id?: string;
  historico?: Turno["contexto"]["historico"]; gravarSombra?: boolean;
  contextoFixo?: { nome?: string; contas_texto?: string; conta_fixa?: string; conta_fixa_tipo?: string } }): Promise<Turno> {
  const t0 = Date.now();
  const turnoId = entrada.execucao_id || randomUUID();
  const contexto = await carregarContexto(entrada.phone);
  if (entrada.historico) contexto.historico = entrada.historico;   // avaliação: histórico do caso real
  if (entrada.contextoFixo?.nome) contexto.nome = entrada.contextoFixo.nome;
  if (entrada.contextoFixo?.contas_texto) contexto.contas_texto = entrada.contextoFixo.contas_texto;
  if (entrada.contextoFixo?.conta_fixa) { contexto.conta_fixa_nome = entrada.contextoFixo.conta_fixa; contexto.conta_fixa_tipo = entrada.contextoFixo.conta_fixa_tipo ?? null; }
  const { compreensao, tokens: t1 } = await compreender(entrada.mensagem, contexto);
  const recibos = await executar(compreensao, contexto, entrada.mensagem, turnoId);
  const { texto, tokens: t2 } = await falar(entrada.mensagem, contexto, compreensao, recibos);
  const g = conferir(texto, recibos, entrada.mensagem);
  const turno: Turno = {
    entrada: entrada.mensagem, contexto, compreensao, recibos, resposta: g.resposta,
    guardrail: { regras: g.regras, acao: g.acao }, ms: Date.now() - t0,
    tokens: { entrada: t1.entrada + t2.entrada, saida: t1.saida + t2.saida },
  };
  // modo sombra: guarda o que faria, para comparar com o agente atual (mesmo execucao_id do n8n)
  if (entrada.gravarSombra !== false) await inserir("tutu_sombra", {
    phone: contexto.phone, execucao_id: entrada.execucao_id ?? null, modo: config.modo, modelo: config.modelo,
    entrada: entrada.mensagem, intencoes: compreensao, recibos, resposta: turno.resposta, guardrail: turno.guardrail,
    duracao_ms: turno.ms, tokens_entrada: turno.tokens.entrada, tokens_saida: turno.tokens.saida,
  }).catch(e => console.error("tutu_sombra:", (e as Error).message));
  return turno;
}
