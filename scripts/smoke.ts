import { processarTurno } from "../src/turno.js";
const casos: [string, string, { papel: "pessoa" | "tutu"; texto: string }[]][] = [
  ["556196778007", "Boa tarde.\nPeço registrar mais uma despesa de hoje, Dia 24/09/2026, abaixo:\n* R$ 50,00 - Pix para Rafael - Almoço Colégio.",
    [{ papel: "pessoa", texto: "Boa tarde.\nPeço registrar uma despesa de hoje, Dia 24/09/2026, abaixo:\n* R$ 15,82 - Uber - Rafael - De Casa para o Colégio." },
     { papel: "tutu", texto: "Anotei uma despesa de R$ 15,82 em Uber para o Rafael hoje. Qualquer outra coisa, é só falar!" }]],
  ["556196778007", "👍", [{ papel: "tutu", texto: "Anotei R$ 50 de Pix pro almoço do Rafael." }]],
  ["556192287012", "Tuto coloca a receita na Sweet Cows no valor de 2 mil reais, conta PJ.", []],
  ["5585999850673", "gastei 80 no cartão e 30 na farmácia, tô meio preocupado com o mês", []],
  ["5521980357680", "quanto posso gastar hoje?", []],
];
for (const [phone, mensagem, historico] of casos) {
  const t = await processarTurno({ phone, mensagem, historico, gravarSombra: false });
  console.log("\n━━", mensagem.replace(/\n/g, " ").slice(0, 70));
  console.log("  entendeu:", t.compreensao.intencoes.map(i => i.tipo + ("valor" in i ? `:${i.valor}` : "") + ("conta" in i && i.conta ? `@${i.conta}` : "")).join(", "), t.compreensao.emocao ? `| emoção: ${t.compreensao.emocao}` : "");
  console.log("  recibos:", t.recibos.map(r => `${r.acao}:${r.ok ? "ok" : "NÃO"}${r.avisos.length ? "(" + r.avisos.join(",") + ")" : ""}`).join(", ") || "—");
  console.log("  resposta:", t.resposta.replace(/\n/g, " ⏎ "));
  console.log(`  ${t.ms} ms · ${t.tokens.entrada}+${t.tokens.saida} tokens · guardrail: ${t.guardrail.acao}`);
}
