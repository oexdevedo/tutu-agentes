// Tipos do Tutu Core. Regra de ouro: a IA devolve INTENÇÕES; só o código mexe em dinheiro,
// e toda ação devolve um RECIBO. A resposta só pode afirmar o que está nos recibos.

export type Natureza = "despesa" | "receita";
export type Forma = "credito" | "debito" | "pix" | "dinheiro";

export type Intencao =
  | { tipo: "registrar"; natureza: Natureza; valor: number; descricao: string; categoria?: string;
      data?: string; forma_pagamento?: Forma; nome_cartao?: string; conta?: string; pago?: boolean;
      origem_dinheiro?: "reserva" }
  | { tipo: "consultar_saldo"; conta?: string }
  | { tipo: "consultar_mes"; o_que: "receitas" | "despesas" | "fixas"; mes?: string; conta?: string }
  | { tipo: "agradecimento" }
  | { tipo: "conversa"; assunto?: string }
  // Tudo que o Core ainda não executa sozinho (editar, apagar, pagar conta, metas, dívidas, fatura...):
  // no modo sombra fica registrado para comparação; na virada, vai para o agente antigo.
  | { tipo: "outra"; descricao: string };

export interface Compreensao {
  intencoes: Intencao[];
  emocao?: string | null;          // "ansiosa", "culpada", "orgulhosa"... a voz acolhe antes de calcular
  responde_pergunta_anterior?: boolean;
}

export interface ItemRecibo {
  id?: string; tabela?: string; descricao?: string; valor?: number; data?: string; conta?: string;
  [k: string]: unknown;
}

export interface Recibo {
  ok: boolean;
  acao: string;
  efeito: number;            // quantas linhas mudaram (0 = nada foi gravado)
  duplicado: boolean;        // já tinha sido feito: não repetiu
  simulado?: boolean;        // modo sombra: é o que TERIA sido feito
  leitura?: boolean;         // só consulta
  itens: ItemRecibo[];
  avisos: string[];
  texto?: string;            // resumo pronto (consultas)
}

export interface Contexto {
  phone: string;
  user_id: string | null;
  nome: string;
  contas_texto: string;      // "Pessoal (padrão) · Sweet Chaos (PJ)..."
  conta_fixa_tipo?: string | null;
  conta_fixa_nome?: string | null;   // avaliação: força a conta fixa do caso
  historico: { papel: "pessoa" | "tutu"; texto: string }[];
  hoje: string;              // AAAA-MM-DD (São Paulo)
}

export interface Turno {
  entrada: string;
  contexto: Contexto;
  compreensao: Compreensao;
  recibos: Recibo[];
  resposta: string;
  guardrail: { regras: string[]; acao: "nenhuma" | "substituiu" };
  ms: number;
  tokens: { entrada: number; saida: number };
}
