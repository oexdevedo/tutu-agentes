// Mesmo texto do workflow "Consultar Cartões" do n8n (fonte: fn_cartao_uso, a mesma da tela Cartão do app).
// Cartões de crédito da conta (mesma fonte da tela Cartão do Tutu Web: fn_cartao_uso).
export function formatarCartoes(cs: any[], hoje: string, conta: string): string {
  const fmt = (v: unknown) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dm = (s: unknown) => `${String(s).slice(8, 10)}/${String(s).slice(5, 7)}`;
  if (!Array.isArray(cs) || !cs.length)
    return `Não achei cartão cadastrado${conta && conta !== 'pessoal' ? ` na conta *${conta}*` : ''}. Dá pra cadastrar no Tutu Web (Cartão) ou me mandar o PDF de uma fatura que eu cadastro na hora. 💳`;
  const linhas = [`💳 *Seus cartões${conta && conta !== 'pessoal' ? ` (${conta})` : ''}:*`];
  const bancosCompart = new Set<string>();
  let totalFaturas = 0;
  for (const c of cs) {
    const f = c.fatura || {};
    const nome = `*${c.nome}*${c.final_principal ? ` (final ${c.final_principal})` : ''}`;
    const perc = Number(c.perc || 0);
    const disp = Number(c.disponivel);
    const alerta = Number(c.limite) > 0 && disp < 0 ? ' 🚨 estourado' : perc >= 90 ? ' ⚠️ quase no limite' : '';
    const partes = [];
    if (Number(c.limite) > 0) partes.push(`usado ${fmt(c.consumido)} de ${fmt(c.limite)} (${perc}%)${alerta}${disp > 0 ? ` · sobra ${fmt(disp)}` : ''}`);
    else partes.push(`usado ${fmt(c.consumido)}`);
    if (f.total != null && f.vencimento) {
      partes.push(`última fatura ${fmt(f.total)} — ${f.vencimento < hoje ? 'venceu' : 'vence'} ${dm(f.vencimento)}`);
      totalFaturas += Number(c.fatura_em_aberto ?? f.total ?? 0);
    }
    if (Number(c.compras_depois) > 0) partes.push(`${fmt(c.compras_depois)} em compras depois do fechamento`);
    if (Number(c.parcelas_futuras) > 0) partes.push(`${fmt(c.parcelas_futuras)} em parcelas futuras`);
    if (Number(c.meta) > 0) partes.push(`meta do mês ${fmt(c.meta)}`);
    if (c.limite_compartilhado) bancosCompart.add(c.banco || c.nome);
    linhas.push(`\n${nome}\n• ` + partes.join('\n• '));
  }
  if (bancosCompart.size) linhas.push(`\nℹ️ Os cartões ${[...bancosCompart].join(', ')} dividem o mesmo limite — o "usado" é somado entre eles.`);
  if (totalFaturas > 0) linhas.push(`\nSoma das últimas faturas: *${fmt(totalFaturas)}*`);
  linhas.push('Detalhes compra a compra: tutu.exdevedor.com/dashboard/cartao');
  return linhas.join('\n');
}
