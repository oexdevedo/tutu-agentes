import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { llm } from "../llm.js";
import { config } from "../config.js";
import type { Compreensao, Contexto, Intencao } from "./tipos.js";

// ENTENDER: uma chamada ao modelo, saída estruturada e validada. O modelo NÃO decide o que gravar
// nem escolhe registro: só diz o que a pessoa quis. Quem decide e executa é o código (execucao/).

const INTERPRETAR: Tool = {
  name: "interpretar",
  description: "Devolve o que a pessoa quer nesta mensagem, como uma lista de intenções.",
  input_schema: {
    type: "object",
    properties: {
      intencoes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tipo: { type: "string", enum: ["registrar", "consultar_saldo", "consultar_cartoes", "consultar_mes", "agradecimento", "conversa", "outra"] },
            natureza: { type: "string", enum: ["despesa", "receita"] },
            valor: { type: "number", description: "em reais, ex.: 15.82" },
            descricao: { type: "string" },
            categoria: { type: "string" },
            data: { type: "string", description: "AAAA-MM-DD" },
            forma_pagamento: { type: "string", enum: ["credito", "debito", "pix", "dinheiro"] },
            nome_cartao: { type: "string" },
            conta: { type: "string", description: "a palavra EXATA que a pessoa usou para a conta NESTA mensagem ('pj', 'empresa', 'Sweet Cows'); nunca troque por um nome da lista; vazio se não citou" },
            pago: { type: "boolean", description: "false quando é conta A PAGAR que ainda não foi paga" },
            origem_dinheiro: { type: "string", enum: ["reserva"] },
            o_que: { type: "string", enum: ["receitas", "despesas", "fixas"] },
            mes: { type: "string", description: "AAAA-MM" },
            assunto: { type: "string" },
          },
          required: ["tipo"],
        },
      },
      emocao: { type: ["string", "null"], description: "sentimento claro na mensagem (ansiosa, culpada, orgulhosa...) ou null" },
      responde_pergunta_anterior: { type: "boolean" },
    },
    required: ["intencoes"],
  },
};

function sistema(c: Contexto): string {
  return `Você interpreta mensagens de WhatsApp para o Tutu, assistente financeiro. Hoje é ${c.hoje} (São Paulo).
Pessoa: ${c.nome}. ${c.contas_texto}

Devolva SÓ o que a pessoa quer NESTA mensagem, chamando a ferramenta "interpretar".
- registrar: cada gasto/recebimento NOVO citado nesta mensagem = um item (natureza, valor, descricao curta, data se citada — "ontem" vira data absoluta).
  • "no crédito", "no cartão", "no nubank" → forma_pagamento=credito (nome_cartao se citou).
  • "tenho que pagar X dia 10", "vence amanhã" → pago=false com a data.
  • "usei a reserva/poupança/dinheiro guardado" → origem_dinheiro=reserva.
  • NUNCA inclua algo que a conversa anterior mostra que já foi anotado, nem valores que não estão na mensagem atual — exceto quando a mensagem é só uma confirmação ("sim", "pode anotar") de um lançamento que o Tutu PROPÔS na última resposta.
  • Recebimento avulso ("recebi 2 mil", "entrou 53,63") é registrar natureza=receita.
  • Valores somados na mensagem ("18 + 11 de uber") são itens SEPARADOS (18 e 11), nunca a soma.
  • Uma data dita uma vez ("Ontem foi 26 de uber, 14 de café... 18 + 11 de uber") vale para TODOS os itens da mensagem, até outra data ser citada.
  • Recebimento SEM valor ("ajuda de custo entrou", "caiu o salário") é outra (confirmar receita fixa), nunca registrar.
  • conta: copie a palavra EXATA da pessoa ("pj", "empresa", "Sweet Cows"). NUNCA escolha nem corrija o nome da conta — o sistema resolve e pergunta se houver dúvida.
  • Conta FIXA/recorrente ("todo mês", "assinatura", "recorrente", "pelos próximos meses", "vence todo dia 10") NÃO é registrar: é outra (cadastro de conta fixa).
- consultar_saldo: saldo, quanto posso gastar, quanto gastei/recebi hoje, e perguntas sobre o limite do dia ("por que tenho X pra gastar hoje?").
- consultar_cartoes: cartões de crédito — limite, quanto usou, fatura, vencimento, "estourei o cartão?". (PDF de fatura é outra coisa: importar.)
- consultar_mes: listar receitas/despesas/fixas de um mês (mes=AAAA-MM se citou).
- agradecimento: só 👍/obrigado/valeu, sem pedido.
- conversa: desabafo, dúvida geral, papo — nada a executar.
- outra: qualquer outro pedido (editar, apagar, "paguei a luz", metas, dívidas, fatura, trocar conta, preferências...). Descreva em "descricao".
"Anotou essa?" é pergunta (conversa), não registro. Dívida ("devo 500 pro João") é outra, nunca registrar.`;
}

const texto = (h: Contexto["historico"]) =>
  h.length ? "[Conversa recente]\n" + h.map(t => `${t.papel === "tutu" ? "Tutu" : "Pessoa"}: ${t.texto}`).join("\n") + "\n\n" : "";

export async function compreender(mensagem: string, c: Contexto): Promise<{ compreensao: Compreensao; tokens: { entrada: number; saida: number } }> {
  const r = await llm().messages.create({
    model: config.modelo,
    max_tokens: 1200,
    system: sistema(c),
    tools: [INTERPRETAR],
    tool_choice: { type: "tool", name: "interpretar" },
    messages: [{ role: "user", content: `${texto(c.historico)}[Mensagem atual]\n${mensagem}` }],
  });
  const bloco = r.content.find(b => b.type === "tool_use");
  const bruto = (bloco && bloco.type === "tool_use" ? bloco.input : {}) as Partial<Compreensao>;
  return {
    compreensao: validar(bruto),
    tokens: { entrada: r.usage.input_tokens, saida: r.usage.output_tokens },
  };
}

/** Não confia no formato: descarta intenção sem os campos mínimos (vira "outra"). */
export function validar(b: Partial<Compreensao>): Compreensao {
  const intencoes: Intencao[] = [];
  for (const i of (Array.isArray(b.intencoes) ? b.intencoes : []) as Record<string, unknown>[]) {
    if (i.tipo === "registrar") {
      const valor = Number(i.valor);
      if ((i.natureza === "despesa" || i.natureza === "receita") && Number.isFinite(valor) && valor > 0) {
        intencoes.push({ ...(i as object), tipo: "registrar", natureza: i.natureza, valor, descricao: String(i.descricao || "Lançamento").slice(0, 200) } as Intencao);
      } else intencoes.push({ tipo: "outra", descricao: `registro incompleto: ${JSON.stringify(i).slice(0, 150)}` });
    } else if (i.tipo === "consultar_saldo") intencoes.push({ tipo: "consultar_saldo", conta: i.conta ? String(i.conta) : undefined });
    else if (i.tipo === "consultar_cartoes") intencoes.push({ tipo: "consultar_cartoes", conta: i.conta ? String(i.conta) : undefined });
    else if (i.tipo === "consultar_mes") intencoes.push({ tipo: "consultar_mes", o_que: (["receitas", "despesas", "fixas"].includes(String(i.o_que)) ? i.o_que : "despesas") as "receitas", mes: i.mes ? String(i.mes) : undefined, conta: i.conta ? String(i.conta) : undefined });
    else if (i.tipo === "agradecimento") intencoes.push({ tipo: "agradecimento" });
    else if (i.tipo === "conversa") intencoes.push({ tipo: "conversa", assunto: i.assunto ? String(i.assunto) : undefined });
    else intencoes.push({ tipo: "outra", descricao: String(i.descricao || i.tipo || "pedido não reconhecido").slice(0, 200) });
  }
  if (!intencoes.length) intencoes.push({ tipo: "conversa" });
  return { intencoes, emocao: typeof b.emocao === "string" ? b.emocao : null, responde_pergunta_anterior: !!b.responde_pergunta_anterior };
}
