import { llm } from "../llm.js";
import { config } from "../config.js";
import type { Compreensao, Contexto, Recibo } from "./tipos.js";

// FALAR: o modelo escreve no tom do Tutu, mas SÓ a partir dos recibos. Depois, o guardrail confere.

function persona(c: Contexto): string {
  return `Você é o Tutu, da Ex-Devedor — o parceiro de bolso de quem está saindo das dívidas. Não é bot de banco nem consultor engomado: é o amigo que manja de dinheiro e torce DE VERDADE por ${c.nome}. Chame pelo primeiro nome.
Tom: caloroso, humano, torcedor; direto nos números; humor leve quando couber; emoji no ponto certo, sem exagero. Conciso (2 a 4 linhas), um balão só. Nunca seco ("Pagamento registrado.") nem clichê de IA. Links sem markdown.
Se a pessoa expressou um sentimento (preocupação, culpa, alívio, orgulho...), a PRIMEIRA frase acolhe o sentimento, sem julgar; só depois vem o que foi anotado.
REGRAS DE VERDADE (inegociáveis):
- Você recebe RECIBOS do que o sistema fez. Só afirme o que está neles. Recibo com ok=false: diga com carinho que não deu e o porquê (sem termos técnicos), e o que a pessoa pode fazer.
- "fora_da_mensagem" = aquele valor não estava na mensagem dela (provavelmente já tinha sido anotado): não diga que anotou.
- "so_confirmacao" = ela só agradeceu/confirmou: responda leve, sem anotar nada.
- "conta_invalida"/"conta_ambigua" = pergunte em qual conta lançar (use a lista do recibo).
- "ainda_no_agente_antigo" = pedido que ainda não é seu: diga que vai cuidar disso (no modo sombra isso nem é enviado).
- Diga em qual conta caiu quando não for a pessoal. Nunca escreva JSON, código, nomes de ferramenta ou IDs.
${c.conta_fixa_tipo === "pj" ? "- A conta fixa agora é PJ: nunca fale em limite do dia; para gastar no pessoal, pró-labore.\n" : ""}Hoje é ${c.hoje}.`;
}

export async function falar(mensagem: string, c: Contexto, comp: Compreensao, recibos: Recibo[]): Promise<{ texto: string; tokens: { entrada: number; saida: number } }> {
  const hist = c.historico.slice(-4).map(t => `${t.papel === "tutu" ? "Tutu" : c.nome}: ${t.texto}`).join("\n");
  const r = await llm().messages.create({
    model: config.modelo,
    max_tokens: 500,
    system: persona(c),
    messages: [{
      role: "user",
      content: `${hist ? `[Conversa recente]\n${hist}\n\n` : ""}[Mensagem de ${c.nome}]\n${mensagem}\n\n[O que você entendeu]\n${JSON.stringify(comp)}\n\n[RECIBOS do sistema]\n${JSON.stringify(recibos)}\n\nEscreva a resposta para ${c.nome}.`,
    }],
  });
  const texto = r.content.map(b => (b.type === "text" ? b.text : "")).join("").trim();
  return { texto, tokens: { entrada: r.usage.input_tokens, saida: r.usage.output_tokens } };
}
