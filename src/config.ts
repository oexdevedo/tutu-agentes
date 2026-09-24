const obrig = (k: string) => { const v = process.env[k]; if (!v) throw new Error(`falta a variável de ambiente ${k}`); return v; };
export const config = {
  porta: Number(process.env.PORT ?? 3000),
  token: () => obrig("CORE_TOKEN"),
  supabaseUrl: () => obrig("SUPABASE_URL").replace(/\/$/, ""),
  supabaseKey: () => obrig("SUPABASE_SERVICE_ROLE_KEY"),
  modelo: process.env.MODELO ?? "us.anthropic.claude-haiku-4-5-20251001-v1:0",
  regiao: process.env.AWS_REGION ?? "us-east-1",
  // "sombra": nunca grava nem envia. "real": executa (só depois de aprovado no banco de casos).
  modo: (process.env.MODO === "real" ? "real" : "sombra") as "real" | "sombra",
};
