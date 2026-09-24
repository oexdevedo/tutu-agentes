import { config } from "./config.js";

// Supabase via REST com a service role (o Core roda no servidor, nunca no navegador).
async function chamar<T>(metodo: string, caminho: string, corpo?: unknown, prefer?: string): Promise<T> {
  const k = config.supabaseKey();
  const r = await fetch(`${config.supabaseUrl()}/rest/v1/${caminho}`, {
    method: metodo,
    headers: { apikey: k, Authorization: `Bearer ${k}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(20_000),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`supabase ${metodo} ${caminho.split("?")[0]}: ${r.status} ${t.slice(0, 200)}`);
  return (t ? JSON.parse(t) : null) as T;
}
export const rpc = <T = unknown>(fn: string, corpo: Record<string, unknown>) => chamar<T>("POST", `rpc/${fn}`, corpo);
export const ler = <T = unknown>(caminho: string) => chamar<T>("GET", caminho);
export const inserir = (tabela: string, linha: unknown) => chamar<null>("POST", tabela, linha, "return=minimal");
