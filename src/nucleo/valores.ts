// Valores em R$ que aparecem num texto: "R$ 15,82", "15.82", "1.234,56", "2 mil", "2k", "1,5 mil", "300".
// Base da trava "o valor tem que estar na mensagem atual" (Fase 1): em produção a IA regravou
// um Uber do turno anterior junto com um Pix novo.
export function valoresDaMensagem(texto: string): Set<number> {
  const s = String(texto || "").toLowerCase().replace(/ /g, " ");
  const out = new Set<number>();
  const re = /(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(mil\b|k\b)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const t = m[1];
    let v: number;
    if (/^\d{1,3}(\.\d{3})+$/.test(t)) v = Number(t.replace(/\./g, ""));
    else if (t.includes(",")) v = Number(t.replace(/\./g, "").replace(",", "."));
    else v = Number(t);
    if (!Number.isFinite(v)) continue;
    if (m[2]) v *= 1000;
    out.add(emCentavos(v));
  }
  return out;
}

export const emCentavos = (v: number) => Math.round(Number(v) * 100);

/** Mensagem só de emoji/agradecimento: nunca cria lançamento. ("sim"/"ok" continuam valendo como confirmação.) */
export const SO_AGRADECIMENTO = /^[\s!.]*((valeu|vlw|obrigad[oa]|grato|grata)\b[\s!.]*|\p{Extended_Pictographic}[\s️‍]*)+$/iu;

/** O valor pode ser gravado a partir desta mensagem? Sem número na mensagem = confirmação ("sim"): pode. */
export function valorEstaNaMensagem(valor: number, mensagem: string): boolean {
  if (!/\d/.test(mensagem)) return true;
  const vs = valoresDaMensagem(mensagem);
  return vs.size === 0 || vs.has(emCentavos(valor));
}
