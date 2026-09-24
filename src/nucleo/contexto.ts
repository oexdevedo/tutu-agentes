import { ler, rpc } from "../supa.js";
import type { Contexto } from "./tipos.js";

export const hojeSP = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const soDigitos = (p: string) => String(p || "").replace("@s.whatsapp.net", "").replace(/\D/g, "");

interface CtxWhats { ok?: boolean; user_id?: string; nome?: string; conta_ativa_tipo?: string | null }
interface ContasPrompt { contas?: { nome: string; tipo: string }[]; padrao?: string; fixa?: string }

/** Quem é a pessoa, em que contas mexe e o que conversou há pouco (memória curta = rastro do Tutu). */
export async function carregarContexto(phoneBruto: string): Promise<Contexto> {
  const phone = soDigitos(phoneBruto);
  const [ctx, contas, rastro] = await Promise.all([
    rpc<CtxWhats>("fn_ctx_whatsapp", { p_phone: phone }).catch(() => ({} as CtxWhats)),
    rpc<ContasPrompt>("fn_tutu_contas_prompt", { p_phone: phone }).catch(() => ({} as ContasPrompt)),
    ler<{ entrada: string; resposta_final: string; criado_em: string }[]>(
      `tutu_rastro?phone=eq.${phone}&criado_em=gte.${new Date(Date.now() - 6 * 3600e3).toISOString()}&select=entrada,resposta_final,criado_em&order=criado_em.desc&limit=4`,
    ).catch(() => []),
  ]);
  const lst = contas.contas ?? [];
  const contas_texto = lst.length
    ? "Contas: " + ["Pessoal" + (contas.padrao === "pessoal" ? " (padrão)" : ""),
        ...lst.map(c => `${c.nome} (${c.tipo === "pj" ? "PJ" : "conjunta"}${contas.padrao === c.nome ? ", padrão" : ""})`)].join(" · ")
      + `. Conta fixa agora: ${contas.fixa === "pessoal" || !contas.fixa ? "Pessoal" : contas.fixa}.`
    : "Só a conta pessoal.";
  const historico = rastro.reverse().flatMap(t => [
    { papel: "pessoa" as const, texto: t.entrada ?? "" },
    { papel: "tutu" as const, texto: t.resposta_final ?? "" },
  ]).filter(h => h.texto);
  return {
    phone, user_id: ctx.user_id ?? null, nome: String(ctx.nome || "você").split(" ")[0],
    contas_texto, conta_fixa_tipo: ctx.conta_ativa_tipo ?? null, historico, hoje: hojeSP(),
  };
}
