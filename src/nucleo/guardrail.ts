import type { Recibo } from "./tipos.js";

// A resposta só pode afirmar o que os recibos confirmam (mesma regra do nó "Confere Recibo" do n8n).
// "já anotei" / "já tinha registrado" falam do passado — não são promessa desta mensagem.
const AFIRMA = /(?<!\bj[áa] )(?<!\bj[áa] tinha )\b(anotei|registrei|lancei|exclu[ií]|apaguei|removi|atualizei|alterei|editei|marquei|dei baixa|quitei|cadastrei|troquei|mudei|guardei|coloquei|depositei|salvei|ajustei|corrigi|transferi)\b/i;
const VAZAMENTO = /Calling \w+|"id"\s*:\s*"call_|tool_?call|^\s*[[{]/m;

export const HONESTA = 'Opa, deixa eu ser transparente: nessa mensagem eu não cheguei a anotar nem alterar nada 😅 Se tem algo pra registrar ou mudar, me manda de novo (ex.: "50 de almoço no pix") que eu faço na hora.';

/** WhatsApp não é Markdown: **negrito** vira *negrito*, títulos "## " e links [x](url) viram texto. */
export function paraWhatsApp(t: string): string {
  return t.replace(/\*\*([^*\n]+)\*\*/g, "*$1*").replace(/^#{1,6}\s+/gm, "").replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1: $2").trim();
}

export function conferir(resposta: string, recibos: Recibo[], entrada: string): { resposta: string; regras: string[]; acao: "nenhuma" | "substituiu" } {
  const regras: string[] = [];
  const escritas = recibos.filter(r => !r.leitura);
  const fez = escritas.some(r => r.ok && (r.efeito > 0 || r.duplicado));
  let final = paraWhatsApp(resposta);
  // pergunta "anotou essa?": "sim, anotei" confirma o que JÁ foi feito, não é promessa nova
  const perguntouSeAnotou = /(anot(ou|aste|ado|ada)|registr(ou|aste|ado|ada)|lan[çc](ou|aste|ado|ada)|t[áa] (anotad|registrad|lan[çc]ad))[^?]*\?/i.test(entrada);
  if (AFIRMA.test(resposta) && !fez && !perguntouSeAnotou) {
    regras.push(escritas.length ? "prometeu_mas_falhou" : "prometeu_sem_acao");
    final = /^[\s!.]*((valeu|vlw|obrigad[oa]|grato|grata)\b|\p{Extended_Pictographic})/iu.test(entrada) ? "Fechado! 💛" : HONESTA;
  }
  if (VAZAMENTO.test(final)) { regras.push("vazamento"); final = final.split("\n").filter(l => !VAZAMENTO.test(l)).join("\n").trim() || HONESTA; }
  return { resposta: final, regras, acao: regras.length ? "substituiu" : "nenhuma" };
}
