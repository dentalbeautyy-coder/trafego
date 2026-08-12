// Gera sugestões automáticas em cima dos números já calculados — sem inventar dado
// nenhum, só lendo o que já está na tela e apontando padrões que valem uma olhada.
export function generateInsights({ totals, rows }) {
  const insights = [];
  const pct = (a, b) => (b > 0 ? (a / b) * 100 : null);

  // Sem nenhum dado de funil preenchido ainda, mas já com investimento no período.
  if (totals.investment > 0 && totals.leads === 0) {
    insights.push({
      severity: "warning",
      title: "Funil sem preenchimento",
      text: `Foram investidos ${money(totals.investment)} no período, mas nenhum lead foi marcado como "chegou". Confirme com a equipe se o funil está sendo preenchido na aba Campanhas — sem isso, CPL, custo por fechamento e ROI ficam sempre em branco.`,
    });
  }

  // Conversão lead -> agendamento
  const leadToScheduled = pct(totals.scheduled, totals.leads);
  if (leadToScheduled !== null) {
    if (leadToScheduled < 30) {
      insights.push({
        severity: "warning",
        title: "Conversão baixa: lead → agendamento",
        text: `Só ${leadToScheduled.toFixed(0)}% de quem chegou virou agendamento. Vale revisar tempo de resposta no WhatsApp e o roteiro inicial de atendimento — é onde mais se perde gente no funil.`,
      });
    } else if (leadToScheduled >= 60) {
      insights.push({
        severity: "success",
        title: "Boa conversão: lead → agendamento",
        text: `${leadToScheduled.toFixed(0)}% de quem chegou virou agendamento — o primeiro contato está funcionando bem.`,
      });
    }
  }

  // Conversão agendamento -> fechamento
  const scheduledToClosed = pct(totals.closed, totals.scheduled);
  if (scheduledToClosed !== null) {
    if (scheduledToClosed < 20) {
      insights.push({
        severity: "warning",
        title: "Conversão baixa: agendamento → fechamento",
        text: `Só ${scheduledToClosed.toFixed(0)}% dos agendamentos viram fechamento. Pode ser falta de retorno (no-show) ou dificuldade em fechar na consulta — vale olhar os dois separadamente.`,
      });
    } else if (scheduledToClosed >= 40) {
      insights.push({
        severity: "success",
        title: "Boa conversão: agendamento → fechamento",
        text: `${scheduledToClosed.toFixed(0)}% dos agendamentos viram fechamento — a etapa presencial está convertendo bem.`,
      });
    }
  }

  // Campanha com melhor e pior custo por lead (só entre as que têm lead registrado)
  const withLeads = rows.filter((r) => r.leads > 0 && r.costPerLead !== null);
  if (withLeads.length >= 2) {
    const best = withLeads.reduce((a, b) => (b.costPerLead < a.costPerLead ? b : a));
    const worst = withLeads.reduce((a, b) => (b.costPerLead > a.costPerLead ? b : a));
    if (best.campaignId !== worst.campaignId && worst.costPerLead > best.costPerLead * 1.5) {
      insights.push({
        severity: "info",
        title: "Oportunidade de realocar verba",
        text: `"${best.name}" tem o menor custo por lead (${money(best.costPerLead)}), bem abaixo de "${worst.name}" (${money(worst.costPerLead)}). Vale considerar mover parte do orçamento para a campanha mais eficiente.`,
      });
    }
  }

  // Campanha ativa com gasto relevante e zero retorno registrado
  const spendingNoLeads = rows
    .filter((r) => r.status === "ACTIVE" && r.investment > 100 && r.leads === 0)
    .sort((a, b) => b.investment - a.investment)[0];
  if (spendingNoLeads) {
    insights.push({
      severity: "warning",
      title: "Campanha ativa sem retorno registrado",
      text: `"${spendingNoLeads.name}" já gastou ${money(spendingNoLeads.investment)} no período sem nenhum lead marcado como chegado. Ou o anúncio não está performando, ou o funil dela ainda não foi preenchido — vale checar os dois.`,
    });
  }

  // ROI
  if (totals.revenue > 0 && totals.roi !== null) {
    insights.push({
      severity: totals.roi >= 0 ? "success" : "warning",
      title: totals.roi >= 0 ? "ROI positivo no período" : "ROI negativo no período",
      text: `Faturamento de ${money(totals.revenue)} contra ${money(totals.investment)} investidos — ROI de ${(totals.roi * 100).toFixed(0)}%.`,
    });
  }

  if (!insights.length) {
    insights.push({
      severity: "info",
      title: "Ainda sem sinal suficiente",
      text: "Conforme o funil for preenchido (chegaram, agendamentos, fechamentos), as sugestões aparecem aqui automaticamente.",
    });
  }

  return insights;
}

function money(value) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
