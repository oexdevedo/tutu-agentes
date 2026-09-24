import { rpc } from "../supa.js";

export interface ContaResolvida {
  ok: boolean; user_id?: string; conta_id: string | null; conta_nome: string; conta_tipo: string | null;
  filtro?: string; erro?: "conta_nao_encontrada" | "ambigua" | string; contas?: { nome: string }[];
}

/** A conta citada vale só para esta ação; sem citar, vale a conta fixa. fn_ctx_whatsapp valida que a pessoa é membro. */
export async function resolverConta(phone: string, termo?: string): Promise<ContaResolvida> {
  const c = await rpc<Record<string, any>>("fn_ctx_whatsapp", { p_phone: phone, p_conta: termo?.trim() || null });
  if (!c?.ok) return { ok: false, conta_id: null, conta_nome: "pessoal", conta_tipo: null, erro: "perfil" };
  if (c.conta_erro) return { ok: false, conta_id: null, conta_nome: "pessoal", conta_tipo: null, erro: c.conta_erro, contas: c.contas ?? [] };
  return { ok: true, user_id: c.user_id, conta_id: c.conta_ativa ?? null, conta_nome: c.conta_ativa_nome ?? "pessoal",
           conta_tipo: c.conta_ativa_tipo ?? null, filtro: c.filtro };
}
