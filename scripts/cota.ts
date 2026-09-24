import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
const c = new AnthropicBedrock({ awsRegion: "us-east-1", maxRetries: 0 });
for (const model of ["global.anthropic.claude-haiku-4-5-20251001-v1:0", "us.anthropic.claude-haiku-4-5-20251001-v1:0"]) {
  let ok = 0; const t0 = Date.now(); let erro = "";
  for (let i = 0; i < 12; i++) {
    try { await c.messages.create({ model, max_tokens: 5, messages: [{ role: "user", content: "oi" }] }); ok++; }
    catch (e: any) { erro = `${e.status} após ${ok} chamadas em ${((Date.now() - t0) / 1000).toFixed(1)}s`; break; }
  }
  console.log(model, "→", erro || `${ok} seguidas sem recusa em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await new Promise(r => setTimeout(r, 61_000));
}
