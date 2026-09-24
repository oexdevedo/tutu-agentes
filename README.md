# Tutu Core

O "cérebro" do Tutu no WhatsApp. **A IA conversa, o código decide.**

```
mensagem ──▶ 1. ENTENDER   (Claude Haiku 4.5, saída estruturada: lista de intenções)
             2. DECIDIR     (código: travas, conta certa, sem duplicar) ──▶ RECIBO de cada ação
             3. FALAR       (Claude escreve no tom do Tutu, só a partir dos recibos)
             4. CONFERIR    (guardrail: nada de "anotei" sem recibo, nada de JSON/código)
```

- **Dinheiro só é mexido por código** (`src/execucao/`), com as travas aprendidas em produção:
  👍/obrigado não grava · o valor tem que estar na mensagem atual · conta citada tem que existir ·
  a mesma coisa no mesmo turno não grava duas vezes.
- **Modo sombra** (`MODO=sombra`, padrão): nunca grava nem envia; registra em `tutu_sombra` o que faria,
  com o mesmo `execucao_id` do n8n → `vw_tutu_sombra_comparacao` mostra lado a lado com o agente atual.
- O que o Core ainda não executa (editar, apagar, pagar conta, metas, dívidas, fatura…) vira intenção
  `outra` e continua com o agente do n8n.

## Rodar

```bash
cp .env.exemplo .env   # preencher
npm install
npm test               # regras determinísticas
npm run dev            # http://localhost:3000  (POST /v1/turno, GET /saude)
npx tsx scripts/avaliar.ts --rep 2   # banco de casos reais (mesmo do n8n/avaliacao)
```

`POST /v1/turno` — `Authorization: Bearer $CORE_TOKEN`, corpo `{ "phone", "mensagem", "execucao_id"? }`.

## Produção
EasyPanel, projeto **tutu**, serviço **tutu-core**, build pelo `Dockerfile` a cada push na `main`.
Rede interna: o n8n chama `http://tutu_tutu-core:3000`. Modelo: `us.anthropic.claude-haiku-4-5-20251001-v1:0`
(Sonnet não — decisão do Patrick). Cota do Bedrock para Haiku 4.5 é baixa (medido: ~11 chamadas seguidas no
endpoint regional), o cliente tenta de novo sozinho.
