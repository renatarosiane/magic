export function validateSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !value.data || typeof value.data !== 'object' || Array.isArray(value.data)
    || !Array.isArray(value.dailyInvestments) || !Array.isArray(value.yieldHistory)
    || !Array.isArray(value.chatHistoryLog) || !Array.isArray(value.chatMemory)) {
    throw new Error('Escolha um backup completo do Magic, com investimentos e histórico.');
  }
  if (JSON.stringify(value).length > 1500000) throw new Error('O arquivo excede o limite de importação de 1,5 MB.');
  const numeric = n => typeof n === 'number' && Number.isFinite(n);
  const id = s => typeof s === 'string' && /^[A-Za-z0-9_ .À-ÿ-]+$/.test(s);
  const text = s => typeof s === 'string' && s.length <= 2000 && !/[<>"'`\\]/.test(s);
  const money = (item, field) => {
    if (!numeric(item[field])) throw new Error('Há um valor inválido no backup.');
  };
  for (const [key, month] of Object.entries(value.data)) {
    if (!/^[A-ZÀ-Ý ]+(?:20\d{2})?$/.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Mês inválido.');
    for (const list of ['entradas', 'saidas', 'investimentos']) {
      if (!Array.isArray(month[list])) throw new Error('Estrutura mensal incompleta.');
      for (const item of month[list]) {
        if (!id(item.id)) throw new Error('Identificador inválido no backup.');
        money(item, 'valor');
        if (!text(item.nome ?? item.referencia ?? '')) throw new Error('Nome ou referência contém caracteres não suportados.');
        if (item.titulo !== undefined && !text(item.titulo)) throw new Error('Categoria inválida.');
      }
    }
    for (const card of ['mercadopago', 'nubank']) {
      if (!month.cartoes?.[card] || !Array.isArray(month.cartoes[card].items)) throw new Error('Cartão incompleto.');
      money(month.cartoes[card], 'parcelasAnteriores');
      for (const item of month.cartoes[card].items) {
        if (!id(item.id) || !text(item.referencia) || !text(item.titulo)) throw new Error('Compra inválida.');
        if (item.devedor != null && !text(item.devedor)) throw new Error('Nome de devedor inválido.');
        money(item, 'valor');
      }
    }
  }
  for (const item of value.dailyInvestments) {
    if (!id(item.id) || !text(item.nome)) throw new Error('Investimento inválido.');
    money(item, 'valor');
    if (item.valorAnterior !== undefined) money(item, 'valorAnterior');
  }
  for (const item of value.yieldHistory) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !text(item.nome)) throw new Error('Histórico inválido.');
    money(item, 'yieldVal');
  }
  return value;
}

export function emptySnapshot(today = new Date()) {
  const year = today.getFullYear();
  const names = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
  const data = {};
  for (let y = 2026; y <= Math.max(2027, year); y++) {
    names.forEach((name, i) => {
      if (y === 2026 && i < 9) return;
      const key = y === 2026 || (y === 2027 && i < 9) ? name : `${name} ${y}`;
      data[key] = { entradas: [], saidas: [], investimentos: [], investimentoTotalPlanilha: null,
        cartoes: { mercadopago: { parcelasAnteriores: 0, items: [] }, nubank: { parcelasAnteriores: 0, items: [] } } };
    });
  }
  return { version: 'permanente', updatedAt: today.toISOString(), data, dailyInvestments: [], yieldHistory: [], chatHistoryLog: [], chatMemory: [] };
}

export function errorMessage(error) {
  if (String(error?.message).includes('MAGIC_ACCOUNT_CHANGED')) return 'A conta conectada mudou. Sua alteração permanece associada à conta original.';
  if (String(error?.message).includes('MAGIC_CONFLICT')) return 'Os dados foram alterados em outro aparelho. Sua alteração foi preservada neste navegador.';
  if (error?.status === 401) return 'Sua sessão expirou. Entre novamente para sincronizar.';
  return 'Não foi possível sincronizar. Sua alteração permanece neste navegador; tente novamente quando a conexão voltar.';
}

export function isEmptySnapshot(value) {
  if (!value || value.dailyInvestments?.length || value.yieldHistory?.length) return false;
  return Object.values(value.data || {}).every(month => !month.entradas?.length && !month.saidas?.length && !month.investimentos?.length
    && Object.values(month.cartoes || {}).every(card => !card.items?.length && !Number(card.parcelasAnteriores)));
}
