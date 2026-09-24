import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
import { config } from "./config.js";

// Claude pelo Bedrock da conta (Haiku 4.5; Sonnet não — decisão do Patrick).
let cliente: AnthropicBedrock | null = null;
export function llm(): AnthropicBedrock {
  // cota de Haiku 4.5 desta conta é baixa (medido 24/09: regional ~11 seguidas; global 3): o SDK espera e tenta de novo
  cliente ??= new AnthropicBedrock({ awsRegion: config.regiao, maxRetries: 6 }); // credenciais: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
  return cliente;
}
