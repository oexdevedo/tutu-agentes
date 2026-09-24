import { describe, expect, it } from "vitest";
import { SO_AGRADECIMENTO, valorEstaNaMensagem, valoresDaMensagem } from "../src/nucleo/valores.js";
import { conferir, HONESTA } from "../src/nucleo/guardrail.js";
import { validar } from "../src/nucleo/compreensao.js";
import type { Recibo } from "../src/nucleo/tipos.js";

const PAULO = "Boa tarde.\nPeço registrar mais uma despesa de hoje, Dia 24/09/2026, abaixo:\n* R$ 50,00 - Pix para Rafael - Almoço Colégio.";

describe("valores da mensagem (casos reais)", () => {
  it("lê formatos brasileiros", () => {
    const v = valoresDaMensagem("R$ 15,82 · 1.250 de geladeira · 2 mil · 1,5k · 79,90");
    for (const c of [1582, 125000, 200000, 150000, 7990]) expect(v.has(c)).toBe(true);
  });
  it("barra o Uber do turno anterior (Paulo, 24/09)", () => {
    expect(valorEstaNaMensagem(15.82, PAULO)).toBe(false);
    expect(valorEstaNaMensagem(50, PAULO)).toBe(true);
  });
  it("confirmação sem número passa", () => expect(valorEstaNaMensagem(500, "sim")).toBe(true));
  it("regravar 13 e 49 junto com a camiseta é barrado", () => {
    expect(valorEstaNaMensagem(13, "79,90 camiseta branca")).toBe(false);
    expect(valorEstaNaMensagem(79.9, "79,90 camiseta branca")).toBe(true);
  });
  it("👍 e obrigado são só agradecimento; sim/ok não", () => {
    for (const s of ["👍", "👍👍", "Obrigado!", "valeu 🙏", "❤️"]) expect(SO_AGRADECIMENTO.test(s)).toBe(true);
    for (const s of ["sim", "ok", "50 de uber", "Confirmado."]) expect(SO_AGRADECIMENTO.test(s)).toBe(false);
  });
});

const rec = (p: Partial<Recibo>): Recibo => ({ ok: true, acao: "registrar", efeito: 1, duplicado: false, itens: [], avisos: [], ...p });

describe("guardrail: só afirma o que o recibo confirma", () => {
  it("anotei sem nada feito → troca pela honesta", () => {
    const g = conferir("Anotei R$ 50 no Pix!", [], "Peço registrar...");
    expect(g.acao).toBe("substituiu"); expect(g.resposta).toBe(HONESTA);
  });
  it("👍 com 'anotei' falso → Fechado! 💛", () => expect(conferir("Anotei a despesa de R$ 50", [], "👍").resposta).toBe("Fechado! 💛"));
  it("anotei com recibo ok → mantém", () => expect(conferir("Anotei R$ 50 ✅", [rec({})], "50 pix").acao).toBe("nenhuma"));
  it("repetido (duplicado) conta como feito", () => expect(conferir("Anotei!", [rec({ efeito: 0, duplicado: true })], "x").acao).toBe("nenhuma"));
  it("falha de gravação + 'anotei' → troca", () => expect(conferir("Anotei!", [rec({ ok: false, efeito: 0 })], "x").acao).toBe("substituiu"));
  it("'já anotei' fala do passado → mantém", () => expect(conferir("Sim, já anotei a de R$ 24", [], "anotou essa?").acao).toBe("nenhuma"));
  it("tira vazamento de chamada de ferramenta", () => expect(conferir('Calling registrar with input {"a":1}\nPronto!', [], "x").resposta).toBe("Pronto!"));
});

describe("formato WhatsApp", () => {
  it("**negrito** vira *negrito* sem contar como substituição", () => {
    const g = conferir("Você tem **5 cartões estourados** e soma **R$ 4.821,99**", [], "como estão meus cartões?");
    expect(g.resposta).toBe("Você tem *5 cartões estourados* e soma *R$ 4.821,99*"); expect(g.acao).toBe("nenhuma");
  });
});

describe("validação do que o modelo devolve", () => {
  it("registro sem valor vira 'outra'", () => {
    expect(validar({ intencoes: [{ tipo: "registrar", natureza: "despesa", descricao: "x" } as never] }).intencoes[0].tipo).toBe("outra");
  });
  it("tipo desconhecido vira 'outra'; vazio vira conversa", () => {
    expect(validar({ intencoes: [{ tipo: "apagar_tudo" } as never] }).intencoes[0].tipo).toBe("outra");
    expect(validar({}).intencoes[0].tipo).toBe("conversa");
  });
  it("registro válido passa inteiro", () => {
    const i = validar({ intencoes: [{ tipo: "registrar", natureza: "despesa", valor: 15.82, descricao: "Uber", forma_pagamento: "credito" } as never] }).intencoes[0];
    expect(i).toMatchObject({ tipo: "registrar", valor: 15.82, forma_pagamento: "credito" });
  });
});
