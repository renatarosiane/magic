// Registro do plugin de labels no gráfico de pizza
if (window.ChartDataLabels) {
  Chart.register(window.ChartDataLabels);
}

const MONTH_ORDER = [
  'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO 2027', 'NOVEMBRO 2027', 'DEZEMBRO 2027'
];

// Rótulos com ano exibidos na tela (as chaves internas dos meses que já existiam foram mantidas para não perder nenhum dado salvo)
const MONTH_LABELS = {
  'OUTUBRO': 'Outubro 2026',
  'NOVEMBRO': 'Novembro 2026',
  'DEZEMBRO': 'Dezembro 2026',
  'JANEIRO': 'Janeiro 2027',
  'FEVEREIRO': 'Fevereiro 2027',
  'MARÇO': 'Março 2027',
  'ABRIL': 'Abril 2027',
  'MAIO': 'Maio 2027',
  'JUNHO': 'Junho 2027',
  'JULHO': 'Julho 2027',
  'AGOSTO': 'Agosto 2027',
  'SETEMBRO': 'Setembro 2027',
  'OUTUBRO 2027': 'Outubro 2027',
  'NOVEMBRO 2027': 'Novembro 2027',
  'DEZEMBRO 2027': 'Dezembro 2027'
};

const BASE_MONTH_NAMES_UPPER = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
];

const BASE_MONTH_NAMES_DISPLAY = {
  'JANEIRO': 'Janeiro',
  'FEVEREIRO': 'Fevereiro',
  'MARÇO': 'Março',
  'ABRIL': 'Abril',
  'MAIO': 'Maio',
  'JUNHO': 'Junho',
  'JULHO': 'Julho',
  'AGOSTO': 'Agosto',
  'SETEMBRO': 'Setembro',
  'OUTUBRO': 'Outubro',
  'NOVEMBRO': 'Novembro',
  'DEZEMBRO': 'Dezembro'
};

const AVAILABLE_YEARS = ['2026', '2027'];

function getMonthsForYear(yearStr) {
  const y = String(yearStr || '2026').trim();
  if (y === '2026') return ['OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
  if (y === '2027') {
    return [
      'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
      'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO 2027', 'NOVEMBRO 2027', 'DEZEMBRO 2027'
    ];
  }
  return BASE_MONTH_NAMES_UPPER.map(m => `${m} ${y}`);
}

function getYearFromMonthKey(monthKey) {
  const k = String(monthKey || '').toUpperCase().trim();
  if (['OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'].includes(k)) return '2026';
  const match = k.match(/\b(20\d{2})\b/);
  if (match) return match[1];
  return '2027';
}

function getShortMonthDisplay(monthKey) {
  const k = String(monthKey || '').toUpperCase().trim().replace(/\s+20\d{2}\b/, '');
  return BASE_MONTH_NAMES_DISPLAY[k] || monthKey;
}

function getMonthLabel(monthKey) {
  if (MONTH_LABELS[monthKey]) return String(MONTH_LABELS[monthKey]).toUpperCase();
  const y = getYearFromMonthKey(monthKey);
  const shortName = getShortMonthDisplay(monthKey);
  return `${shortName} ${y}`.toUpperCase();
}

const BASE_INVESTMENTS = [];
const INITIAL_YIELD_HISTORY = [];
const EMPTY_CARDS_TEMPLATE = (mpAnt = 0, nuAnt = 0) => ({
  mercadopago: { parcelasAnteriores: mpAnt, items: [] },
  nubank: { parcelasAnteriores: nuAnt, items: [] }
});
const INITIAL_DATA = Object.fromEntries(MONTH_ORDER.map(key => [key, {
  entradas: [], saidas: [], investimentos: [], investimentoTotalPlanilha: null,
  cartoes: EMPTY_CARDS_TEMPLATE()
}]));
const PERMANENT_STORAGE_KEY = 'magic:cache:' + window.MAGIC_BOOTSTRAP.userId;
function accountPreferenceKey(name) { return 'magic:preferences:' + window.MAGIC_BOOTSTRAP.userId + ':' + name; }
function getAccountPreference(name, legacyKey, fallback) {
  const server = window.MAGIC_BOOTSTRAP.payload.preferences?.[name];
  if (server !== undefined && server !== null) return server;
  try {
    const own = localStorage.getItem(accountPreferenceKey(name));
    if (own !== null) return own;
    // Somente a proprietária original pode herdar as preferências anteriores.
    if (window.MAGIC_BOOTSTRAP.userId === window.MAGIC_CONFIG.legacyPreferencesOwner) {
      return localStorage.getItem(legacyKey) ?? fallback;
    }
  } catch {}
  return fallback;
}

const LEGACY_KEYS = [
  'planilha_inteligente_pastel_v4',
  'planilha_inteligente_pastel_v3',
  'planilha_inteligente_pastel_v2',
  'planilha_inteligente_pastel_v1'
];

function registerYearInSystem(yearStr, targetDataObj = null) {
  const y = String(yearStr || '').trim();
  if (!/^20\d{2}$/.test(y)) return;
  if (!AVAILABLE_YEARS.includes(y)) {
    AVAILABLE_YEARS.push(y);
    AVAILABLE_YEARS.sort((a, b) => Number(a) - Number(b));
  }
  const monthKeys = getMonthsForYear(y);
  monthKeys.forEach(mKey => {
    if (!MONTH_ORDER.includes(mKey)) {
      MONTH_ORDER.push(mKey);
    }
    if (!MONTH_LABELS[mKey]) {
      MONTH_LABELS[mKey] = `${getShortMonthDisplay(mKey)} ${y}`;
    }
    if (!INITIAL_DATA[mKey]) {
      INITIAL_DATA[mKey] = {
        entradas: [],
        investimentos: JSON.parse(JSON.stringify(BASE_INVESTMENTS)),
        saidas: [],
        cartoes: EMPTY_CARDS_TEMPLATE(0, 0),
        investimentoTotalPlanilha: null
      };
    }
    const store = targetDataObj || (typeof appState !== 'undefined' && appState ? appState.data : null);
    if (store && !store[mKey]) {
      store[mKey] = {
        entradas: [],
        investimentos: JSON.parse(JSON.stringify(BASE_INVESTMENTS)),
        saidas: [],
        cartoes: EMPTY_CARDS_TEMPLATE(0, 0),
        investimentoTotalPlanilha: null
      };
    }
  });
}

/**
 * Mescla de forma não-destrutiva os dados salvos pelo usuário com a estrutura do sistema.
 * Garante que NENHUM item adicionado, editado ou excluído pelo usuário seja perdido
 * quando fizermos novas atualizações no código!
 */
function mergeSavedDataWithDefaults(savedData) {
  if (savedData && typeof savedData === 'object') {
    Object.keys(savedData).forEach(k => {
      const ym = String(k || '').match(/\b(20\d{2})\b/);
      if (ym && Number(ym[1]) >= 2028) {
        registerYearInSystem(ym[1]);
      }
    });
  }
  const base = JSON.parse(JSON.stringify(INITIAL_DATA));
  if (!savedData || typeof savedData !== 'object') return base;

  // Preserva todos os meses que existam no sistema ou que o usuário tenha criado
  const allMonths = new Set([...MONTH_ORDER, ...Object.keys(savedData)]);

  allMonths.forEach(m => {
    if (!savedData[m]) return; // Usa o padrão se o mês for novo no sistema
    if (!base[m]) {
      base[m] = JSON.parse(JSON.stringify(savedData[m]));
      return;
    }

    // Preserva 100% integralmente o que o usuário salvou (adições, edições e exclusões)
    if (Array.isArray(savedData[m].entradas)) {
      base[m].entradas = savedData[m].entradas;
    }
    if (Array.isArray(savedData[m].saidas)) {
      base[m].saidas = savedData[m].saidas;
    }
    if (Array.isArray(savedData[m].investimentos) && savedData[m].investimentos.length > 0) {
      base[m].investimentos = savedData[m].investimentos.map((inv) => ({
        valorAnterior: inv.valorAnterior !== undefined ? inv.valorAnterior : inv.valor,
        ...inv
      }));
    }

    // Preserva fielmente os cartões do usuário
    if (savedData[m].cartoes) {
      if (savedData[m].cartoes.mercadopago) {
        base[m].cartoes.mercadopago = savedData[m].cartoes.mercadopago;
      }
      if (savedData[m].cartoes.nubank) {
        base[m].cartoes.nubank = savedData[m].cartoes.nubank;
      }
    }

    if (savedData[m].investimentoTotalPlanilha !== undefined) {
      base[m].investimentoTotalPlanilha = savedData[m].investimentoTotalPlanilha;
    }
  });

  return base;
}

function sanitizeDailyInvestments(list) { return Array.isArray(list) ? structuredClone(list) : []; }
function sanitizeYieldHistory(list) { return Array.isArray(list) ? structuredClone(list) : []; }
function loadDailyInvestments() { return sanitizeDailyInvestments(window.MAGIC_BOOTSTRAP.payload.dailyInvestments); }
function loadFromStorage() { return mergeSavedDataWithDefaults(structuredClone(window.MAGIC_BOOTSTRAP.payload.data)); }
function loadYieldHistory() { return sanitizeYieldHistory(window.MAGIC_BOOTSTRAP.payload.yieldHistory); }
function loadChatHistoryLog() { return structuredClone(window.MAGIC_BOOTSTRAP.payload.chatHistoryLog); }
function loadChatMemory() { return structuredClone(window.MAGIC_BOOTSTRAP.payload.chatMemory); }

function loadSavedCurrentMonth(dataObj) {
  try {
    const savedM = getAccountPreference('currentMonth', 'planilha_inteligente_current_month', 'OUTUBRO');
    if (savedM && dataObj && dataObj[savedM]) return savedM;
  } catch (e) {}
  return 'OUTUBRO';
}

function loadSavedCurrentView() {
  try {
    const savedV = getAccountPreference('currentView', 'planilha_inteligente_current_view', 'planilha');
    if (savedV && ['planilha', 'cartoes', 'investimentos'].includes(savedV)) return savedV;
  } catch (e) {}
  return 'planilha';
}

let appState;
const initialLoadedData = loadFromStorage();

appState = {
  currentMonth: loadSavedCurrentMonth(initialLoadedData),
  currentView: loadSavedCurrentView(), // 'planilha' | 'cartoes' | 'investimentos'
  filterCategoria: 'all',
  filterCardCategoria: 'all',
  filterCardMarcos: 'all', // 'all' | 'meu' | 'marcos'
  trajectoryFilter: 'ALL',
  yieldRangeStart: null,
  yieldRangeEnd: null,
  voiceMuted: false,
  isListening: false,
  data: initialLoadedData,
  dailyInvestments: loadDailyInvestments(),
  yieldHistory: loadYieldHistory(),
  chatHistoryLog: loadChatHistoryLog(),
  chatMemory: loadChatMemory()
};

let pieChartInstance = null;
let tabInvestmentsPieChartInstance = null;
let trajectoryChartInstance = null;

function updateSaveBadge(statusText, isSaving = false) {
  const badge = document.getElementById('saveStatusBadge');
  if (!badge) return;
  badge.classList.toggle('saving', isSaving);
  badge.title = statusText;
}

/**
 * Salva simultaneamente no Navegador (chave permanente) E no Disco do Computador (dados_usuario.json via /api/data)
 */
function magicSnapshot() {
  return { version: 'permanente', updatedAt: new Date().toISOString(), data: appState.data,
    dailyInvestments: appState.dailyInvestments, yieldHistory: appState.yieldHistory,
    chatHistoryLog: appState.chatHistoryLog, chatMemory: appState.chatMemory,
    preferences: { ...window.MAGIC_BOOTSTRAP.payload.preferences,
      currentMonth: appState.currentMonth, currentView: appState.currentView,
      theme: document.body.classList.contains('dark-theme') ? 'dark' : 'light' } };
}
function saveToStorage() {
  window.MagicCloud.save(magicSnapshot());
}
async function initDiskDatabaseSync() { /* O bootstrap autenticado já carregou os dados. */ }

function formatBRL(val) {
  const num = Number(val) || 0;
  const prefix = num < 0 ? '-R$ ' : 'R$ ';
  return prefix + Math.abs(num).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}



function formatSignedBRL(val) {
  const num = Number(val) || 0;
  const sign = num >= 0 ? '+' : '-';
  return sign + 'R$ ' + Math.abs(num).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}



function getMonthData(monthName = appState.currentMonth) {
  return appState.data[monthName];
}

function getNextMonthName(monthName = appState.currentMonth) {
  const idx = MONTH_ORDER.indexOf(monthName);
  if (idx === -1 || idx + 1 >= MONTH_ORDER.length) return null;
  return MONTH_ORDER[idx + 1];
}

function getPreviousMonthName(monthName = appState.currentMonth) {
  const idx = MONTH_ORDER.indexOf(monthName);
  if (idx <= 0) return null;
  return MONTH_ORDER[idx - 1];
}

function syncMonthScrollSliderUI() {
  const monthTabsEl = document.getElementById('monthTabs');
  const rangeEl = document.getElementById('monthScrollSlider');
  if (!monthTabsEl || !rangeEl) return;

  const maxScroll = Math.max(0, monthTabsEl.scrollWidth - monthTabsEl.clientWidth);
  if (maxScroll > 4) {
    rangeEl.style.display = 'block';
    const pct = Math.round((monthTabsEl.scrollLeft / maxScroll) * 100);
    rangeEl.value = String(Math.max(0, Math.min(100, pct)));
  } else {
    rangeEl.style.display = 'none';
    rangeEl.value = '0';
  }
}

function renderYearAndMonthTabs(scrollToActive = false) {
  const currentYear = getYearFromMonthKey(appState.currentMonth);
  const yearTabsEl = document.getElementById('yearTabs');
  const monthTabsEl = document.getElementById('monthTabs');

  if (yearTabsEl) {
    yearTabsEl.innerHTML = '';
    AVAILABLE_YEARS.forEach(y => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `year-tab${y === currentYear ? ' active' : ''}`;
      btn.setAttribute('data-year', y);
      btn.textContent = y;
      btn.onclick = () => window.selectYear(y);
      yearTabsEl.appendChild(btn);
    });
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'year-tab-add';
    addBtn.id = 'btnAddYear';
    addBtn.title = 'Adicionar próximo ano';
    addBtn.textContent = '+';
    addBtn.onclick = () => window.addNewYearTab();
    yearTabsEl.appendChild(addBtn);
  }

  if (monthTabsEl) {
    const prevYearAttr = monthTabsEl.getAttribute('data-rendered-year');
    const monthsOfYear = getMonthsForYear(currentYear);
    monthTabsEl.innerHTML = '';
    monthTabsEl.setAttribute('data-rendered-year', currentYear);

    monthsOfYear.forEach(mKey => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `month-tab${mKey === appState.currentMonth ? ' active' : ''}`;
      btn.setAttribute('data-month', mKey);
      btn.textContent = getShortMonthDisplay(mKey);
      btn.onclick = () => {
        if (monthTabsEl.getAttribute('data-dragging') === 'true') return;
        setMonth(mKey);
      };
      monthTabsEl.appendChild(btn);
    });

    if (prevYearAttr !== currentYear) {
      monthTabsEl.scrollLeft = 0;
    } else if (scrollToActive) {
      const activeBtn = monthTabsEl.querySelector('.month-tab.active');
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
      }
    }
    requestAnimationFrame(syncMonthScrollSliderUI);
  }
}

window.selectYear = function(yearStr) {
  const y = String(yearStr || '').trim();
  registerYearInSystem(y);
  const months = getMonthsForYear(y);
  if (!months || months.length === 0) return;
  if (getYearFromMonthKey(appState.currentMonth) === y) {
    renderYearAndMonthTabs(true);
    return;
  }
  setMonth(months[0]);
};

window.addNewYearTab = function() {
  const maxYear = Math.max(...AVAILABLE_YEARS.map(y => parseInt(y, 10) || 2027));
  const nextYear = String(maxYear + 1);
  registerYearInSystem(nextYear);
  ensureAllSlashInstallmentsSynced();
  MONTH_ORDER.forEach(m => syncCreditCardsToNextMonth(m));
  saveToStorage();
  const months = getMonthsForYear(nextYear);
  setMonth(months[0]);
};

function setupMonthTabsDragScroll() {
  const slider = document.getElementById('monthTabs');
  const rangeEl = document.getElementById('monthScrollSlider');
  if (!slider) return;

  let isDown = false;
  let startX = 0;
  let scrollLeft = 0;

  slider.addEventListener('scroll', () => {
    syncMonthScrollSliderUI();
  });

  if (rangeEl) {
    rangeEl.addEventListener('input', () => {
      const maxScroll = Math.max(0, slider.scrollWidth - slider.clientWidth);
      const pct = parseFloat(rangeEl.value) || 0;
      slider.scrollLeft = (pct / 100) * maxScroll;
    });
  }

  window.addEventListener('resize', syncMonthScrollSliderUI);

  slider.addEventListener('mousedown', (e) => {
    isDown = true;
    slider.setAttribute('data-dragging', 'false');
    startX = e.pageX - slider.offsetLeft;
    scrollLeft = slider.scrollLeft;
  });

  window.addEventListener('mouseup', () => {
    if (!isDown) return;
    isDown = false;
    setTimeout(() => {
      slider.setAttribute('data-dragging', 'false');
    }, 30);
  });

  slider.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    const x = e.pageX - slider.offsetLeft;
    const walk = x - startX;
    if (Math.abs(walk) > 5) {
      slider.setAttribute('data-dragging', 'true');
      e.preventDefault();
      slider.scrollLeft = scrollLeft - walk * 1.3;
    }
  });

  slider.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      slider.scrollLeft += e.deltaY;
    }
  }, { passive: false });
}

function setMonth(monthName) {
  if (!appState.data[monthName]) return;
  appState.currentMonth = monthName;
  try { localStorage.setItem(accountPreferenceKey('currentMonth'), monthName); } catch (e) {}
  const sel = document.getElementById('monthSelect');
  if (sel) sel.value = monthName;
  renderAll();
  saveToStorage();
}

window.switchView = function(viewName) {
  appState.currentView = viewName;
  try { localStorage.setItem(accountPreferenceKey('currentView'), viewName); } catch (e) {}
  document.querySelectorAll('.view-tab').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
  });
  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === `view-${viewName}`);
  });
  renderAll();
  saveToStorage();
};

// =========================================================================
// MOTOR 1: CARTÕES DE CRÉDITO (MERCADO PAGO & NUBANK) -> MÊS SEGUINTE + DEVEDORES
// =========================================================================
function getItemDebtor(item) {
  if (!item) return null;
  if (item.devedor && typeof item.devedor === 'string') {
    const d = item.devedor.trim();
    if (d && d.toLowerCase() !== 'meu' && d.toLowerCase() !== 'nenhum') {
      return d;
    }
  }
  if (item.isMarcos) return 'Marcos';
  return null;
}

function calculateCardTotals(monthName = appState.currentMonth) {
  const monthObj = appState.data[monthName];
  if (!monthObj || !monthObj.cartoes) {
    return {
      mp: { parcelasAnteriores: 0, gastoMes: 0, marcos: 0, totalDebtors: 0, meu: 0, faturaFinal: 0 },
      nu: { parcelasAnteriores: 0, gastoMes: 0, marcos: 0, totalDebtors: 0, meu: 0, faturaFinal: 0 },
      totalFaturas: 0,
      totalMarcos: 0,
      totalDebtors: 0,
      totalMeu: 0,
      debtors: {}
    };
  }
  const mp = monthObj.cartoes.mercadopago || { items: [], parcelasAnteriores: 0 };
  const nu = monthObj.cartoes.nubank || { items: [], parcelasAnteriores: 0 };

  const debtors = {};

  let mpGastoMes = 0;
  let mpTotalDebtors = 0;
  mp.items.forEach(i => {
    const v = Number(i.valor) || 0;
    mpGastoMes += v;
    const debtor = getItemDebtor(i);
    if (debtor) {
      const key = debtor.toLowerCase();
      if (!debtors[key]) debtors[key] = { name: debtor, mp: 0, nu: 0, total: 0 };
      debtors[key].mp += v;
      debtors[key].total += v;
      mpTotalDebtors += v;
    }
  });
  const mpMeu = mpGastoMes - mpTotalDebtors;
  const mpFaturaFinal = (Number(mp.parcelasAnteriores) || 0) + mpGastoMes;

  let nuGastoMes = 0;
  let nuTotalDebtors = 0;
  nu.items.forEach(i => {
    const v = Number(i.valor) || 0;
    nuGastoMes += v;
    const debtor = getItemDebtor(i);
    if (debtor) {
      const key = debtor.toLowerCase();
      if (!debtors[key]) debtors[key] = { name: debtor, mp: 0, nu: 0, total: 0 };
      debtors[key].nu += v;
      debtors[key].total += v;
      nuTotalDebtors += v;
    }
  });
  const nuMeu = nuGastoMes - nuTotalDebtors;
  const nuFaturaFinal = (Number(nu.parcelasAnteriores) || 0) + nuGastoMes;

  const totalDebtorsAmount = mpTotalDebtors + nuTotalDebtors;
  const marcosTotal = debtors['marcos'] ? debtors['marcos'].total : 0;

  return {
    mp: { parcelasAnteriores: mp.parcelasAnteriores, gastoMes: mpGastoMes, marcos: mpTotalDebtors, totalDebtors: mpTotalDebtors, meu: mpMeu, faturaFinal: mpFaturaFinal },
    nu: { parcelasAnteriores: nu.parcelasAnteriores, gastoMes: nuGastoMes, marcos: nuTotalDebtors, totalDebtors: nuTotalDebtors, meu: nuMeu, faturaFinal: nuFaturaFinal },
    totalFaturas: mpFaturaFinal + nuFaturaFinal,
    totalMarcos: marcosTotal,
    totalDebtors: totalDebtorsAmount,
    totalMeu: mpMeu + nuMeu,
    debtors
  };
}

/**
 * Sincroniza os gastos de Cartão de Crédito do mês `spendMonth` para o mês seguinte (`payMonth`):
 * 1. Atualiza `fatura mercado pago` e `fatura nubank` nas Saídas do mês seguinte.
 * 2. Soma tudo o que foi marcado para cada pessoa (Marcos, Isa, Alguém, etc.) e adiciona/atualiza a linha de cada pessoa nas Entradas do mês seguinte!
 */
function syncCreditCardsToNextMonth(spendMonth = appState.currentMonth) {
  const payMonth = getNextMonthName(spendMonth);
  if (!payMonth) return null;

  const totals = calculateCardTotals(spendMonth);
  const nextMonthObj = appState.data[payMonth];

  // 1. Atualiza Fatura Mercado Pago no mês seguinte (se houver gasto ou parcelas anteriores)
  if (totals.mp.faturaFinal > 0) {
    const existingMP = nextMonthObj.saidas.find(s => s.referencia.toLowerCase().includes('fatura mercado pago'));
    if (existingMP) {
      existingMP.valor = Number(totals.mp.faturaFinal.toFixed(2));
    } else {
      nextMonthObj.saidas.push({
        id: 's_mp_' + Date.now(),
        data: '6',
        referencia: 'fatura mercado pago',
        titulo: 'fatura',
        valor: Number(totals.mp.faturaFinal.toFixed(2))
      });
    }
  }

  // 2. Atualiza Fatura Nubank no mês seguinte
  if (totals.nu.faturaFinal > 0) {
    const existingNu = nextMonthObj.saidas.find(s => s.referencia.toLowerCase().includes('fatura nubank'));
    if (existingNu) {
      existingNu.valor = Number(totals.nu.faturaFinal.toFixed(2));
    } else {
      nextMonthObj.saidas.push({
        id: 's_nu_' + Date.now(),
        data: '13',
        referencia: 'fatura nubank',
        titulo: 'fatura',
        valor: Number(totals.nu.faturaFinal.toFixed(2))
      });
    }
  }

  // 3. Atualiza Entradas de quem deve no mês seguinte (Marcos, Isa, Kauã, Alguém, etc.) sem sobrescrever entradas manuais do usuário
  const activeDebtorKeys = new Set();
  Object.values(totals.debtors).forEach(d => {
    const refKey = d.name.toLowerCase().trim();
    activeDebtorKeys.add(refKey);

    const existing = nextMonthObj.entradas.find(e => {
      if (e.isCardSync && e.debtorKey === refKey) return true;
      // Mantém compatibilidade com a linha inicial 'ne6' do Marcos em Novembro
      if (payMonth === 'NOVEMBRO' && e.id === 'ne6' && refKey === 'marcos') return true;
      return false;
    });

    if (existing) {
      existing.valor = Number(d.total.toFixed(2));
      existing.referencia = d.name.toLowerCase();
      existing.isCardSync = true;
      existing.debtorKey = refKey;
    } else if (d.total > 0) {
      nextMonthObj.entradas.push({
        id: 'e_sync_' + refKey + '_' + Date.now(),
        referencia: d.name.toLowerCase(),
        valor: Number(d.total.toFixed(2)),
        isCardSync: true,
        debtorKey: refKey
      });
    }
  });

  // Remove ou zera entradas sincronizadas de pessoas que não devem mais neste mês
  nextMonthObj.entradas = nextMonthObj.entradas.filter(e => {
    if (e.isCardSync && e.debtorKey && !activeDebtorKeys.has(e.debtorKey)) {
      return false;
    }
    return true;
  });

  return { payMonth, totals };
}

let activeDebtorPopoverEl = null;

function closeDebtorPopover() {
  if (activeDebtorPopoverEl) {
    activeDebtorPopoverEl.remove();
    activeDebtorPopoverEl = null;
  }
}

document.addEventListener('click', (e) => {
  if (activeDebtorPopoverEl && !activeDebtorPopoverEl.contains(e.target) && !e.target.closest('.debtor-pill-opt') && !e.target.closest('.btn-marcos-toggle') && !e.target.closest('.btn-edit-debtor')) {
    closeDebtorPopover();
  }
});

window.setCardItemDebtor = function(cardKey, itemId, newDebtorName) {
  closeDebtorPopover();
  const monthObj = getMonthData();
  const card = monthObj.cartoes[cardKey];
  const item = card.items.find(i => i.id === itemId);
  if (!item) return;

  const cleaned = (newDebtorName || '').trim();
  if (!cleaned || cleaned.toLowerCase() === 'meu' || cleaned.toLowerCase() === 'nenhum') {
    item.devedor = null;
    item.isMarcos = false;
  } else {
    item.devedor = cleaned;
    item.isMarcos = (cleaned.toLowerCase() === 'marcos');
    item.lastDebtor = cleaned;
    if (cleaned.toLowerCase() !== 'marcos') {
      item.lastCustomDebtor = cleaned;
    }
  }

  const syncRes = syncCreditCardsToNextMonth(appState.currentMonth);
  saveToStorage();
  renderAll(itemId);

  const activeD = getItemDebtor(item);
  if (syncRes) {
    const totalD = activeD ? (syncRes.totals.debtors[activeD.toLowerCase()] ? syncRes.totals.debtors[activeD.toLowerCase()].total : 0) : 0;
    addChatBubble(
      'ai',
      `Atualizei <strong>"${escapeHtml(item.referencia)}"</strong> (${formatBRL(item.valor)}) para <strong>${escapeHtml(activeD || 'Meu')}</strong>! ${activeD ? `Total que <strong>${escapeHtml(activeD)}</strong> te deve nas Entradas de <strong>${getMonthLabel(syncRes.payMonth)}</strong>: <strong>${formatBRL(totalD)}</strong>.` : ''}`,
      activeD ? `${activeD}: ${formatBRL(totalD)}` : `Gasto Meu`
    );
  }
};

window.openDebtorPopover = function(ev, cardKey, itemId) {
  if (ev) ev.stopPropagation();
  closeDebtorPopover();

  const monthObj = getMonthData();
  const card = monthObj.cartoes[cardKey];
  const item = card.items.find(i => i.id === itemId);
  if (!item) return;

  const currentDebtor = getItemDebtor(item);
  const currentKey = currentDebtor ? currentDebtor.toLowerCase() : 'meu';

  // Coleta nomes já usados nos cartões do mês + Marcos
  const namesMap = new Map();
  namesMap.set('marcos', 'Marcos');
  ['mercadopago', 'nubank'].forEach(ck => {
    (monthObj.cartoes?.[ck]?.items || []).forEach(it => {
      const d = getItemDebtor(it);
      if (d) namesMap.set(d.toLowerCase(), d);
    });
  });

  const pop = document.createElement('div');
  pop.className = 'debtor-popover';
  pop.onclick = (e) => e.stopPropagation();

  const customVal = currentDebtor || 'Meu';

  let chipsHtml = `<button type="button" class="debtor-chip-btn ${currentKey === 'meu' ? 'active' : ''}" data-pick="Meu">Meu</button>`;
  namesMap.forEach((dispName, key) => {
    chipsHtml += `<button type="button" class="debtor-chip-btn ${currentKey === key ? 'active' : ''}" data-pick="${escapeHtml(dispName)}">${escapeHtml(dispName)}</button>`;
  });

  pop.innerHTML = `
    <div class="debtor-popover-title">Quem deve? (escolha ou digite o nome):</div>
    <div class="debtor-popover-chips">${chipsHtml}</div>
    <div class="debtor-popover-custom">
      <input type="text" class="debtor-popover-input" placeholder="Ou digite outro nome..." value="${escapeHtml(customVal)}" />
      <button type="button" class="debtor-popover-save">Salvar</button>
    </div>
  `;

  document.body.appendChild(pop);
  activeDebtorPopoverEl = pop;

  // Posiciona ao redor do botão clicado
  const btnEl = ev ? ev.currentTarget : null;
  if (btnEl) {
    const rect = btnEl.getBoundingClientRect();
    const topPos = Math.min(window.innerHeight - 135, Math.max(12, rect.bottom + 6));
    const leftPos = Math.min(window.innerWidth - 245, Math.max(12, rect.left - 30));
    pop.style.top = `${topPos}px`;
    pop.style.left = `${leftPos}px`;
  } else {
    pop.style.top = '50%';
    pop.style.left = '50%';
    pop.style.transform = 'translate(-50%, -50%)';
  }

  pop.querySelectorAll('.debtor-chip-btn').forEach(b => {
    b.addEventListener('click', () => {
      window.setCardItemDebtor(cardKey, itemId, b.getAttribute('data-pick'));
    });
  });

  const inp = pop.querySelector('.debtor-popover-input');
  const btnSave = pop.querySelector('.debtor-popover-save');
  const submitCustom = () => {
    const v = inp.value.trim();
    if (v) {
      window.setCardItemDebtor(cardKey, itemId, v);
    } else {
      closeDebtorPopover();
    }
  };
  btnSave.addEventListener('click', submitCustom);
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitCustom();
    } else if (e.key === 'Escape') {
      closeDebtorPopover();
    }
  });
  setTimeout(() => {
    inp.focus();
    inp.select();
  }, 20);
};

window.toggleCardDebtor = function(cardKey, itemId, ev) {
  window.openDebtorPopover(ev, cardKey, itemId);
};
window.toggleCardMarcos = window.toggleCardDebtor;
window.promptChangeCardDebtor = function(cardKey, itemId, ev) {
  window.openDebtorPopover(ev, cardKey, itemId);
};

window.editParcelasAnteriores = function(cardKey) {
  const monthObj = getMonthData();
  const card = monthObj.cartoes[cardKey];
  const input = prompt('Editar valor de Parcelas Anteriores (R$):', card.parcelasAnteriores);
  if (input === null) return;
  const parsed = parseFloat(input.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
  if (!isNaN(parsed) && parsed >= 0) {
    card.parcelasAnteriores = parsed;
    syncCreditCardsToNextMonth(appState.currentMonth);
    saveToStorage();
    renderAll();
  }
};

window.openCardTitlePopover = function(ev, cardKey, itemId) {
  if (ev) ev.stopPropagation();
  closeDebtorPopover();

  const monthObj = getMonthData();
  const card = monthObj.cartoes[cardKey];
  const item = card.items.find(i => i.id === itemId);
  if (!item) return;

  const currentCat = (item.titulo || 'compras').toLowerCase().trim();
  const cats = new Set(['compras', 'contas', 'uber', 'parcelado']);
  ['mercadopago', 'nubank'].forEach(ck => {
    (monthObj.cartoes?.[ck]?.items || []).forEach(it => {
      if (it.titulo) cats.add(it.titulo.toLowerCase().trim());
    });
  });

  const pop = document.createElement('div');
  pop.className = 'debtor-popover';
  pop.onclick = (e) => e.stopPropagation();

  let chipsHtml = '';
  Array.from(cats).forEach(cat => {
    chipsHtml += `<button type="button" class="debtor-chip-btn ${currentCat === cat ? 'active' : ''}" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`;
  });

  pop.innerHTML = `
    <div class="debtor-popover-title">Alterar título (categoria):</div>
    <div class="debtor-popover-chips">${chipsHtml}</div>
    <div class="debtor-popover-custom">
      <input type="text" class="debtor-popover-input" placeholder="Ou digite outro título..." value="${escapeHtml(item.titulo || 'compras')}" />
      <button type="button" class="debtor-popover-save">Salvar</button>
    </div>
  `;

  document.body.appendChild(pop);
  activeDebtorPopoverEl = pop;

  const btnEl = ev ? ev.currentTarget : null;
  if (btnEl) {
    const rect = btnEl.getBoundingClientRect();
    const topPos = Math.min(window.innerHeight - 145, Math.max(12, rect.bottom + 6));
    const leftPos = Math.min(window.innerWidth - 245, Math.max(12, rect.left - 20));
    pop.style.top = `${topPos}px`;
    pop.style.left = `${leftPos}px`;
  } else {
    pop.style.top = '50%';
    pop.style.left = '50%';
    pop.style.transform = 'translate(-50%, -50%)';
  }

  const applyNewTitle = (newTitle) => {
    const clean = String(newTitle || '').trim().toLowerCase();
    if (clean) {
      item.titulo = clean;
      syncCreditCardsToNextMonth(appState.currentMonth);
      saveToStorage();
      closeDebtorPopover();
      renderAll(itemId);
    } else {
      closeDebtorPopover();
    }
  };

  pop.querySelectorAll('.debtor-chip-btn').forEach(b => {
    b.addEventListener('click', () => {
      applyNewTitle(b.getAttribute('data-cat'));
    });
  });

  const inp = pop.querySelector('.debtor-popover-input');
  const btnSave = pop.querySelector('.debtor-popover-save');
  btnSave.addEventListener('click', () => applyNewTitle(inp.value));
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyNewTitle(inp.value);
    } else if (e.key === 'Escape') {
      closeDebtorPopover();
    }
  });
  setTimeout(() => {
    inp.focus();
    inp.select();
  }, 20);
};

window.editCardItemInline = function(cardKey, itemId, field, ev) {
  if (field === 'titulo') {
    window.openCardTitlePopover(ev, cardKey, itemId);
    return;
  }
  const monthObj = getMonthData();
  const item = monthObj.cartoes[cardKey].items.find(i => i.id === itemId);
  if (!item) return;

  const input = prompt(`Editar ${field}:`, item[field]);
  if (input === null) return;

  if (field === 'valor') {
    const parsed = parseFloat(input.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
    if (!isNaN(parsed) && parsed >= 0) item.valor = parsed;
  } else {
    item[field] = input.trim() || item[field];
  }

  syncCreditCardsToNextMonth(appState.currentMonth);
  saveToStorage();
  renderAll(itemId);
};

window.deleteCardItem = function(cardKey, itemId) {
  const monthObj = getMonthData();
  monthObj.cartoes[cardKey].items = monthObj.cartoes[cardKey].items.filter(i => i.id !== itemId);
  syncCreditCardsToNextMonth(appState.currentMonth);
  saveToStorage();
  renderAll();
};

// =========================================================================
// MOTOR 2: ATUALIZAÇÃO DIÁRIA DE INVESTIMENTOS & RENDIMENTOS (DIA/SEM/MÊS)
// =========================================================================

/**
 * Retorna a data local de hoje no formato YYYY-MM-DD (ex: 2026-10-28 hoje, 2026-10-29 amanhã, etc.)
 */
function getTodayLocalISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Sincroniza todos os investimentos da aba de Investimentos & Rendimentos (appState.dailyInvestments)
 * com a tabela de Investimentos da aba Planilha do Mês em todos os meses!
 */
function syncAllMonthsWithDailyInvestments() {
  if (!Array.isArray(appState.dailyInvestments) || !appState.data) return;
  const snapshot = appState.dailyInvestments.map(d => ({
    id: d.id,
    nome: d.nome,
    valorAnterior: Number(d.valorAnterior ?? d.valor),
    valor: Number(d.valor)
  }));
  MONTH_ORDER.forEach(mKey => {
    if (appState.data[mKey]) {
      appState.data[mKey].investimentos = JSON.parse(JSON.stringify(snapshot));
    }
  });
}

/**
 * Atualiza o valor de um investimento hoje NA ABA DE INVESTIMENTOS e sincroniza automaticamente com a Planilha do Mês,
 * descontando qualquer aporte/retirada ("Coloquei / Tirei") para calcular apenas o rendimento real!
 * Exemplo: tinha 81,07 + colocou 100,00 -> base esperada = 181,07. Se o novo total é 181,14, rendeu +0,07.
 */
window.updateSingleInvestmentToday = function(invName, newValNum, dateStr = null, aporteNum = 0, skipRender = false) {
  if (isNaN(newValNum) || newValNum < 0) return null;
  const todayStr = dateStr || document.getElementById('inputDailyDate')?.value || getTodayLocalISO();

  const invItem = appState.dailyInvestments.find(i => i.nome.toLowerCase() === invName.toLowerCase());
  if (!invItem) return null;

  const oldVal = Number(invItem.valor);
  const aporte = isNaN(aporteNum) ? 0 : Number(Number(aporteNum).toFixed(2));
  const baseEsperada = Number(Math.max(0, oldVal + aporte).toFixed(2));
  const diff = Number((newValNum - baseEsperada).toFixed(2));

  invItem.valorAnterior = baseEsperada;
  invItem.valor = Number(newValNum.toFixed(2));
  invItem.ultimoAporte = aporte;

  // Sincroniza imediatamente com todas as planilhas mensais
  syncAllMonthsWithDailyInvestments();

  // Registra no histórico de rendimentos se houve rendimento ou aporte/transferência
  if (diff !== 0 || aporte !== 0) {
    appState.yieldHistory.push({
      id: 'yh_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      date: todayStr,
      nome: invItem.nome,
      oldVal: baseEsperada,
      oldValBeforeAporte: oldVal,
      aporteVal: aporte,
      newVal: invItem.valor,
      yieldVal: diff
    });
  }

  if (!skipRender) {
    saveToStorage();
    renderAll(`daily_${invItem.id}`);
  }
  return { id: invItem.id, nome: invItem.nome, oldVal, aporte, baseEsperada, newVal: invItem.valor, diff, date: todayStr };
};

function updateDailyAporteFooterTotal() {
  const totEl = document.getElementById('totInvAporte');
  const totAntEl = document.getElementById('totInvAnterior');
  const totAtuEl = document.getElementById('totInvAtual');
  const totDiaEl = document.getElementById('totRendeuDia');

  let sumAporte = 0;
  let sumBase = 0;
  let sumTotal = 0;
  let sumDia = 0;
  let anyRowEdited = false;

  (appState.dailyInvestments || []).forEach(inv => {
    const inpAporte = document.getElementById(`dailyAporte_${inv.id}`);
    const inpTotal = document.getElementById(`dailyInput_${inv.id}`);
    const rawAporte = inpAporte && inpAporte.value.trim() !== '' ? parseFloat(inpAporte.value) : 0;
    const aporte = isNaN(rawAporte) ? 0 : Number(rawAporte.toFixed(2));
    const rawTotal = inpTotal && inpTotal.value.trim() !== '' ? parseFloat(inpTotal.value) : Number(inv.valor);
    const newTotal = isNaN(rawTotal) ? Number(inv.valor) : Number(rawTotal.toFixed(2));

    const oldVal = Number(inv.valor);
    const hasChange = Math.abs(aporte) > 0.001 || Math.abs(newTotal - oldVal) > 0.001;
    if (hasChange) {
      anyRowEdited = true;
      const baseEsp = Number(Math.max(0, oldVal + aporte).toFixed(2));
      sumBase += baseEsp;
      sumTotal += newTotal;
      sumDia += Number((newTotal - baseEsp).toFixed(2));
    } else {
      const savedAnt = Number(inv.valorAnterior ?? inv.valor);
      sumBase += savedAnt;
      sumTotal += oldVal;
      sumDia += Number((oldVal - savedAnt).toFixed(2));
    }
    sumAporte += aporte;
  });

  if (totEl) totEl.textContent = sumAporte === 0 ? 'R$ 0,00' : formatSignedBRL(sumAporte);
  if (anyRowEdited) {
    if (totAntEl) totAntEl.textContent = formatBRL(sumBase);
    if (totAtuEl) totAtuEl.textContent = formatBRL(sumTotal);
    if (totDiaEl) totDiaEl.textContent = formatSignedBRL(sumDia);
  }
}

function refreshDailyRowLivePreview(invId) {
  const invItem = appState.dailyInvestments.find(i => i.id === invId);
  if (!invItem) return;
  const inpAporte = document.getElementById(`dailyAporte_${invId}`);
  const inpTotal = document.getElementById(`dailyInput_${invId}`);
  const baseCell = document.getElementById(`dailyBaseCell_${invId}`);
  const diaBadge = document.getElementById(`dailyYieldDiaBadge_${invId}`);

  const rawAporte = inpAporte && inpAporte.value.trim() !== '' ? parseFloat(inpAporte.value) : 0;
  const aporte = isNaN(rawAporte) ? 0 : Number(rawAporte.toFixed(2));
  const rawTotal = inpTotal && inpTotal.value.trim() !== '' ? parseFloat(inpTotal.value) : invItem.valor;
  const newTotal = isNaN(rawTotal) ? invItem.valor : Number(rawTotal.toFixed(2));

  const oldVal = Number(invItem.valor);
  const baseEsperada = Number(Math.max(0, oldVal + aporte).toFixed(2));
  const hasChange = Math.abs(aporte) > 0.001 || Math.abs(newTotal - oldVal) > 0.001;

  if (baseCell) {
    if (Math.abs(aporte) > 0.001) {
      const signStr = aporte > 0 ? `+${formatBRL(aporte)}` : formatBRL(aporte);
      baseCell.innerHTML = `<span class="daily-base-calc" title="Saldo atual (${formatBRL(oldVal)}) ${signStr} = Base esperada (${formatBRL(baseEsperada)})">${formatBRL(baseEsperada)} <small>(${signStr})</small></span>`;
    } else if (hasChange) {
      baseCell.textContent = formatBRL(oldVal);
    } else {
      baseCell.textContent = formatBRL(invItem.valorAnterior ?? invItem.valor);
    }
  }

  if (diaBadge && hasChange) {
    const previewYield = Number((newTotal - baseEsperada).toFixed(2));
    diaBadge.className = previewYield >= 0 ? 'badge-yield-pos' : 'badge-yield-neg';
    diaBadge.textContent = formatSignedBRL(previewYield);
  }
  updateDailyAporteFooterTotal();
}

window.onDailyAporteInput = function(invId) {
  const invItem = appState.dailyInvestments.find(i => i.id === invId);
  if (!invItem) return;
  const inpAporte = document.getElementById(`dailyAporte_${invId}`);
  const inpTotal = document.getElementById(`dailyInput_${invId}`);
  if (!inpAporte || !inpTotal) return;

  const rawAporte = inpAporte.value.trim() !== '' ? parseFloat(inpAporte.value) : 0;
  const aporte = isNaN(rawAporte) ? 0 : Number(rawAporte.toFixed(2));

  // Se o usuário ainda não digitou manualmente um Novo Valor Total diferente, soma automaticamente o aporte ao saldo atual
  if (inpTotal.getAttribute('data-user-typed-total') !== 'true') {
    const autoTotal = Math.max(0, Number((Number(invItem.valor) + aporte).toFixed(2)));
    inpTotal.value = autoTotal.toFixed(2);
  }

  refreshDailyRowLivePreview(invId);
};

window.onDailyNewValInput = function(invId) {
  const invItem = appState.dailyInvestments.find(i => i.id === invId);
  if (!invItem) return;
  const inpTotal = document.getElementById(`dailyInput_${invId}`);
  const inpAporte = document.getElementById(`dailyAporte_${invId}`);
  if (!inpTotal) return;

  const rawAporte = inpAporte && inpAporte.value.trim() !== '' ? parseFloat(inpAporte.value) : 0;
  const aporte = isNaN(rawAporte) ? 0 : Number(rawAporte.toFixed(2));
  const autoExpected = Math.max(0, Number((Number(invItem.valor) + aporte).toFixed(2)));
  const typedVal = parseFloat(inpTotal.value);

  if (!isNaN(typedVal) && Math.abs(typedVal - autoExpected) > 0.001) {
    inpTotal.setAttribute('data-user-typed-total', 'true');
  } else if (isNaN(typedVal)) {
    inpTotal.setAttribute('data-user-typed-total', 'false');
  }

  refreshDailyRowLivePreview(invId);
};

/**
 * Permite editar diretamente o "Valor Anterior (Ontem)" na aba de Investimentos sem mexer na Planilha do Mês
 */
window.editDailyValorAnterior = function(invId) {
  const invItem = appState.dailyInvestments.find(i => i.id === invId);
  if (!invItem) return;

  const input = prompt(`Editar Valor Anterior (Base) de ${invItem.nome}:`, invItem.valorAnterior ?? invItem.valor);
  if (input === null) return;
  const parsed = parseFloat(input.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
  if (!isNaN(parsed) && parsed >= 0) {
    invItem.valorAnterior = Number(parsed.toFixed(2));
    // Atualiza também o último registro do dia no histórico se for do mesmo investimento
    const allDates = [...new Set(appState.yieldHistory.map(h => h.date))].sort();
    const latestDate = allDates[allDates.length - 1];
    const lastLog = [...appState.yieldHistory].reverse().find(h => h.date === latestDate && h.nome.toLowerCase() === invItem.nome.toLowerCase());
    if (lastLog) {
      lastLog.oldVal = invItem.valorAnterior;
      lastLog.newVal = invItem.valor;
      lastLog.yieldVal = Number((invItem.valor - invItem.valorAnterior).toFixed(2));
    }
    saveToStorage();
    renderAll(`daily_${invItem.id}`);
  }
};

window.handleQuickDailyRowBtn = function(invId) {
  const inputEl = document.getElementById(`dailyInput_${invId}`);
  const aporteEl = document.getElementById(`dailyAporte_${invId}`);
  if (!inputEl) return;
  const invItem = appState.dailyInvestments.find(i => i.id === invId);
  if (!invItem) return;

  const newVal = parseFloat(inputEl.value);
  const rawAporte = aporteEl && aporteEl.value.trim() !== '' ? parseFloat(aporteEl.value) : 0;
  const aporteVal = isNaN(rawAporte) ? 0 : rawAporte;

  const res = window.updateSingleInvestmentToday(invItem.nome, newVal, null, aporteVal);
  if (res) {
    let msg = '';
    if (Math.abs(res.aporte) > 0.001) {
      const acaoTxt = res.aporte > 0 ? `adicionou <strong>+${formatBRL(res.aporte)}</strong>` : `retirou/transferiu <strong>${formatBRL(res.aporte)}</strong>`;
      msg = `📈 Atualizei <strong>${escapeHtml(res.nome)}</strong>: você tinha ${formatBRL(res.oldVal)}, ${acaoTxt} (ficando com base de ${formatBRL(res.baseEsperada)}) e o valor total foi para <strong>${formatBRL(res.newVal)}</strong>. Rendimento real identificado: <strong>${formatSignedBRL(res.diff)}</strong>!`;
    } else {
      msg = `📈 Atualizei <strong>${escapeHtml(res.nome)}</strong> na aba de Investimentos de ${formatBRL(res.oldVal)} para <strong>${formatBRL(res.newVal)}</strong>! Seu dinheiro rendeu <strong>${formatSignedBRL(res.diff)}</strong> hoje!`;
    }
    addChatBubble('ai', msg, `Rendeu ${formatSignedBRL(res.diff)}`);
    speakText(msg);
  }
};

window.editDailyInvestmentName = function(invId) {
  const invItem = appState.dailyInvestments.find(i => i.id === invId);
  if (!invItem) return;

  const oldName = invItem.nome;
  const input = prompt('Editar nome do investimento / caixinha:', oldName);
  if (input === null) return;
  const newName = input.trim();
  if (!newName || newName === oldName) return;

  invItem.nome = newName;
  // Atualiza também nas planilhas mensais e no histórico de rendimentos onde tinha o nome antigo
  MONTH_ORDER.forEach(m => {
    (appState.data[m]?.investimentos || []).forEach(it => {
      if ((it.nome || '').toLowerCase() === oldName.toLowerCase()) {
        it.nome = newName;
      }
    });
  });
  (appState.yieldHistory || []).forEach(h => {
    if ((h.nome || '').toLowerCase() === oldName.toLowerCase()) {
      h.nome = newName;
    }
  });

  saveToStorage();
  renderAll(`daily_${invItem.id}`);
};

window.deleteInvestmentItem = function(invId, source = 'planilha') {
  const monthObj = getMonthData();
  let targetItem = null;
  if (source === 'daily') {
    targetItem = appState.dailyInvestments.find(i => i.id === invId);
  } else {
    targetItem = monthObj.investimentos.find(i => i.id === invId) || appState.dailyInvestments.find(i => i.id === invId);
  }
  if (!targetItem) return;

  const targetName = targetItem.nome;
  if (!confirm(`Deseja realmente excluir o investimento "${targetName}"?`)) return;

  // Remove da planilha do mês atual e dos meses seguintes ainda não fechados, e também da aba de investimentos
  const curIdx = Math.max(0, MONTH_ORDER.indexOf(appState.currentMonth));
  MONTH_ORDER.slice(curIdx).forEach(m => {
    if (appState.data[m] && Array.isArray(appState.data[m].investimentos)) {
      appState.data[m].investimentos = appState.data[m].investimentos.filter(
        i => i.id !== invId && (i.nome || '').toLowerCase() !== targetName.toLowerCase()
      );
    }
  });

  appState.dailyInvestments = appState.dailyInvestments.filter(
    i => i.id !== invId && (i.nome || '').toLowerCase() !== targetName.toLowerCase()
  );

  saveToStorage();
  renderAll();
  addChatBubble('ai', `Removi o investimento <strong>${escapeHtml(targetName)}</strong> do sistema!`, `Removido: ${targetName}`);
};

/**
 * Mantém o rendimento diário e soma o histórico na semana e no mês atuais do calendário local.
 * Os períodos independem do mês da planilha e da data escolhida para registrar atualizações.
 */
function calculateYieldMetrics(referenceDate = new Date()) {
  const toLocalISO = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const monday = new Date(year, month, referenceDate.getDate(), 12);
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const weekStart = toLocalISO(monday);
  const weekEnd = toLocalISO(sunday);
  const monthStart = toLocalISO(new Date(year, month, 1, 12));
  const monthEnd = toLocalISO(new Date(year, month + 1, 0, 12));
  const today = toLocalISO(referenceDate);
  const last7 = new Date(year, month, referenceDate.getDate(), 12);
  last7.setDate(last7.getDate() - 6);
  const last30 = new Date(year, month, referenceDate.getDate(), 12);
  last30.setDate(last30.getDate() - 29);
  const last7Start = toLocalISO(last7);
  const last30Start = toLocalISO(last30);
  const allDates = [...new Set(appState.yieldHistory.map(h => h.date))].sort();
  const latestDate = allDates[allDates.length - 1] || today;

  const perInvestment = {};
  let sumDia = 0;
  let sumSemana = 0;
  let sumMes = 0;
  let sumUltimos7 = 0;
  let sumUltimos30 = 0;

  appState.dailyInvestments.forEach(inv => {
    const logs = appState.yieldHistory.filter(h => h.nome.toLowerCase() === inv.nome.toLowerCase());

    // Mantém o cálculo diário existente, incluindo o tratamento de aportes e retiradas.
    const yieldDia = Number((inv.valor - (inv.valorAnterior ?? inv.valor)).toFixed(2));
    // Datas ISO locais permitem comparar os limites inclusivos sem conversão para UTC.
    const yieldSemana = logs
      .filter(h => h.date >= weekStart && h.date <= weekEnd)
      .reduce((a, b) => a + b.yieldVal, 0);
    const yieldMes = logs
      .filter(h => h.date >= monthStart && h.date <= monthEnd)
      .reduce((a, b) => a + b.yieldVal, 0);

    const yieldUltimos7 = logs
      .filter(h => h.date >= last7Start && h.date <= today)
      .reduce((a, b) => a + b.yieldVal, 0);
    const yieldUltimos30 = logs
      .filter(h => h.date >= last30Start && h.date <= today)
      .reduce((a, b) => a + b.yieldVal, 0);

    perInvestment[inv.nome] = {
      valorAnterior: inv.valorAnterior ?? inv.valor,
      valorAtual: inv.valor,
      dia: yieldDia,
      semana: yieldSemana,
      mes: yieldMes,
      ultimos7: yieldUltimos7,
      ultimos30: yieldUltimos30
    };

    sumDia += yieldDia;
    sumSemana += yieldSemana;
    sumMes += yieldMes;
    sumUltimos7 += yieldUltimos7;
    sumUltimos30 += yieldUltimos30;
  });

  return { latestDate, today, weekStart, weekEnd, monthStart, monthEnd, last7Start, last30Start, perInvestment, sumDia, sumSemana, sumMes, sumUltimos7, sumUltimos30 };
}

// =========================================================
// MOTOR 3: INTERLIGAÇÃO DE PARCELAS E SALDO NEGATIVO
// =========================================================
/**
 * Reconhece QUALQUER item que tenha barra "/" indicando parcela (ex: "viagem rj 1/6", "chapinha 9/10", "shein 3/4")
 * Tudo que tiver "X/Y" é automaticamente reconhecido como compra parcelada!
 */
function parseInstallmentRef(referencia) {
  const str = String(referencia || '').trim();
  const match = str.match(/^(.*?)\b(\d{1,2})\s*\/\s*(\d{1,2})\b(.*)$/i);
  if (!match) return null;
  const prefix = match[1].trim();
  const suffix = match[4].trim();
  const baseName = [prefix, suffix].filter(Boolean).join(' ').trim() || 'parcelado';
  const currentParcel = parseInt(match[2], 10);
  const totalParcels = parseInt(match[3], 10);
  if (isNaN(currentParcel) || isNaN(totalParcels) || currentParcel < 1 || totalParcels < currentParcel) {
    return null;
  }
  return { baseName, currentParcel, totalParcels };
}

/**
 * Varre todas as planilhas garantindo que:
 * 1. Tudo que tiver "/" (X/Y) receba automaticamente a categoria "parcelado".
 * 2. Todas as parcelas seguintes (até Y/Y) existam nos meses subsequentes (ex: viagem rj 1/6 em Outubro -> até 6/6 em Março).
 */
function ensureAllSlashInstallmentsSynced() {
  // Garante categoria 'parcelado' em itens com formato X/Y, mas NUNCA ressuscita itens que o usuário excluiu
  MONTH_ORDER.forEach((mName) => {
    const mObj = appState.data[mName];
    if (!mObj || !Array.isArray(mObj.saidas)) return;
    mObj.saidas.forEach((item) => {
      const parsed = parseInstallmentRef(item.referencia);
      if (parsed) {
        item.titulo = 'parcelado';
      }
    });
  });
}



function propagateInstallmentsFrom(startMonth, item) {
  const parsed = parseInstallmentRef(item.referencia);
  if (!parsed) return [];

  const startIdx = MONTH_ORDER.indexOf(startMonth);
  if (startIdx === -1) return [];

  const affectedMonths = [];
  const { baseName, currentParcel, totalParcels } = parsed;

  for (let p = 1; p <= totalParcels; p++) {
    const offset = p - currentParcel;
    const targetMonthIdx = startIdx + offset;
    if (targetMonthIdx < 0 || targetMonthIdx >= MONTH_ORDER.length) continue;
    if (offset === 0) continue;

    const targetMonth = MONTH_ORDER[targetMonthIdx];
    const targetData = appState.data[targetMonth];
    const expectedRef = `${baseName} ${p}/${totalParcels}`;

    const existing = targetData.saidas.find(s => {
      const sp = parseInstallmentRef(s.referencia);
      return sp && sp.baseName.toLowerCase() === baseName.toLowerCase() && sp.totalParcels === totalParcels && sp.currentParcel === p;
    });

    if (existing) {
      existing.referencia = expectedRef;
      existing.valor = item.valor;
      existing.data = item.data;
      existing.titulo = item.titulo || 'parcelado';
    } else {
      targetData.saidas.push({
        id: 's_auto_' + Date.now() + '_' + p,
        data: item.data,
        referencia: expectedRef,
        titulo: item.titulo || 'parcelado',
        valor: item.valor
      });
    }
    affectedMonths.push(`${targetMonth} (${expectedRef})`);
  }

  return affectedMonths;
}

function removeLinkedInstallments(baseName, totalParcels) {
  const removedFrom = [];
  MONTH_ORDER.forEach(m => {
    const before = appState.data[m].saidas.length;
    appState.data[m].saidas = appState.data[m].saidas.filter(s => {
      const sp = parseInstallmentRef(s.referencia);
      return !(sp && sp.baseName.toLowerCase() === baseName.toLowerCase() && sp.totalParcels === totalParcels);
    });
    if (appState.data[m].saidas.length < before) removedFrom.push(m);
  });
  return removedFrom;
}


/**
 * Calcula a linha do tempo completa de Reposição do Investimento de Outubro até Março:
 * - Quando o mês é negativo (ex: Outubro -854,59 e Novembro -197,98), soma no "Falta Repor" (1.052,57).
 * - Quando o mês é positivo (ex: Dezembro +481,34), devolve automaticamente para abater o "Falta Repor".
 * - Se sobrar mais do que deve ao investimento (ex: sobrar 2.000), devolve tudo o que deve (1.052,57) e o que sobrar (947,43) entra como Novo Investimento!
 */
function calculateFullReplenishmentTimeline() {
  const timeline = {};
  let dividaAcumulada = 0; // Quanto ainda falta repor pro investimento
  let totalBrutoRetirado = 0; // Soma histórica de tudo que já precisou tirar
  let totalJaDevolvido = 0; // Soma histórica do que já foi devolvido
  let novoInvestimentoAcumulado = 0; // Soma do que sobrou além da reposição e virou investimento novo

  const outInvs = appState.data['OUTUBRO']?.investimentos || [];
  const sumOutCaixinhas = Number(outInvs.reduce((a, b) => a + (Number(b.valor) || 0), 0).toFixed(2));
  const outEntradas = (appState.data['OUTUBRO']?.entradas || []).reduce((a, b) => a + (Number(b.valor) || 0), 0);
  const outSaidas = (appState.data['OUTUBRO']?.saidas || []).reduce((a, b) => a + (Number(b.valor) || 0), 0);
  const outFluxo = Number((outEntradas - outSaidas).toFixed(2));

  // Se em Outubro o Mercado Pago já estiver com R$ 0,00 (soma ~ R$ 0,00), significa que os R$ 0,00 já foram descontados do saldo de R$ 0,00!
  const mpOut = outInvs.find(i => (i.nome || '').toLowerCase() === 'mercado pago');
  const outAlreadyDeducted = mpOut && Number(mpOut.valor) < 900 && outFluxo < 0;
  let patrimonioCorrente = outAlreadyDeducted
    ? Number((sumOutCaixinhas + Math.abs(outFluxo)).toFixed(2))
    : sumOutCaixinhas;

  MONTH_ORDER.forEach((mName) => {
    const mObj = appState.data[mName];
    const baseCaixinhas = Number(mObj.investimentos.reduce((a, b) => a + (Number(b.valor) || 0), 0).toFixed(2));
    const totalEntradas = mObj.entradas.reduce((a, b) => a + (Number(b.valor) || 0), 0);
    const totalSaidas = mObj.saidas.reduce((a, b) => a + (Number(b.valor) || 0), 0);
    const fluxoMesAtual = Number((totalEntradas - totalSaidas).toFixed(2));

    const investimentoInicioMes = Number(patrimonioCorrente.toFixed(2));
    const dividaInicioMes = Number(dividaAcumulada.toFixed(2));

    let retiradoNoMes = 0;
    let devolvidoNoMes = 0;
    let novoInvestimentoNoMes = 0;

    if (fluxoMesAtual < 0) {
      // Mês ficou negativo -> precisa tirar do investimento e soma na dívida a repor!
      retiradoNoMes = Number(Math.abs(fluxoMesAtual).toFixed(2));
      dividaAcumulada = Number((dividaAcumulada + retiradoNoMes).toFixed(2));
      totalBrutoRetirado = Number((totalBrutoRetirado + retiradoNoMes).toFixed(2));
    } else if (fluxoMesAtual > 0) {
      // Mês ficou positivo -> 1º devolve tudo que deve pro investimento; 2º o que sobrar vira novo investimento!
      if (dividaAcumulada > 0) {
        devolvidoNoMes = Number(Math.min(fluxoMesAtual, dividaAcumulada).toFixed(2));
        dividaAcumulada = Number((dividaAcumulada - devolvidoNoMes).toFixed(2));
        totalJaDevolvido = Number((totalJaDevolvido + devolvidoNoMes).toFixed(2));
        novoInvestimentoNoMes = Number(Math.max(0, fluxoMesAtual - devolvidoNoMes).toFixed(2));
      } else {
        devolvidoNoMes = 0;
        novoInvestimentoNoMes = Number(fluxoMesAtual.toFixed(2));
      }
      novoInvestimentoAcumulado = Number((novoInvestimentoAcumulado + novoInvestimentoNoMes).toFixed(2));
    }

    patrimonioCorrente = Number(Math.max(0, investimentoInicioMes + fluxoMesAtual).toFixed(2));

    timeline[mName] = {
      month: mName,
      baseCaixinhas,
      investimentoInicioMes,
      totalEntradas,
      totalSaidas,
      fluxoMesAtual,
      dividaInicioMes,
      retiradoNoMes,
      devolvidoNoMes,
      novoInvestimentoNoMes,
      faltaReporFimMes: Number(dividaAcumulada.toFixed(2)),
      totalBrutoRetiradoAteAqui: Number(totalBrutoRetirado.toFixed(2)),
      totalJaDevolvidoAteAqui: Number(totalJaDevolvido.toFixed(2)),
      novoInvestimentoAcumulado: Number(novoInvestimentoAcumulado.toFixed(2)),
      investimentoLiquidoFimMes: patrimonioCorrente
    };
  });

  return timeline;
}

function calculateCascadingFinancials(targetMonth) {
  const timeline = calculateFullReplenishmentTimeline();
  return timeline[targetMonth] || timeline[appState.currentMonth];
}

window.deductDeficitFromCaixinha = function(caixinhaId) {
  const monthObj = getMonthData();
  const fin = calculateCascadingFinancials(appState.currentMonth);
  if (fin.fluxoMesAtual >= 0) {
    alert('Este mês não está negativo!');
    return;
  }

  const deficit = Math.abs(fin.fluxoMesAtual);
  const item = monthObj.investimentos.find(i => i.id === caixinhaId);
  if (!item) return;

  // Se em Outubro o mercado pago já está em 714,16 (já descontado os 854,59 de 1.568,75), não desconta duas vezes!
  if (appState.currentMonth === 'OUTUBRO' && item.nome.toLowerCase() === 'mercado pago' && item.valor < 900) {
    const msgAlready = `O valor de <strong>${formatBRL(deficit)}</strong> já está descontado no saldo de hoje do <strong>${escapeHtml(item.nome)} (${formatBRL(item.valor)})</strong>, mantendo seu Investimento Líquido em <strong>${formatBRL(fin.investimentoLiquidoFimMes)}</strong>!`;
    addChatBubble('ai', msgAlready, 'Já Atualizado');
    speakText(msgAlready);
    return;
  }

  const novoValor = Math.max(0, Number((item.valor - deficit).toFixed(2)));
  item.valorAnterior = item.valor;
  item.valor = novoValor;

  saveToStorage();
  renderAll(item.id);

  const msg = `Reconhecido! Retirei <strong>${formatBRL(deficit)}</strong> da caixinha <strong>${escapeHtml(item.nome)}</strong> (novo saldo: <strong>${formatBRL(novoValor)}</strong>) para cobrir o saldo negativo de ${appState.currentMonth}!`;
  addChatBubble('ai', msg, 'Resgate Aplicado');
  speakText(msg);
};

function getCategoryClass(titulo) {
  const t = (titulo || '').toLowerCase().trim();
  if (t === 'uber') return 'cat-uber';
  if (t === 'fatura') return 'cat-fatura';
  if (t === 'contas') return 'cat-contas';
  if (t === 'parcelado') return 'cat-parcelado';
  if (t === 'compras') return 'cat-compras';
  return 'cat-default';
}

function getCategoryColorHex(titulo) {
  const t = (titulo || '').toLowerCase().trim();
  if (t === 'fatura') return '#F28FB1';
  if (t === 'contas') return '#7EC4FA';
  if (t === 'parcelado') return '#F8CE6B';
  if (t === 'uber') return '#B892F6';
  if (t === 'compras') return '#6FD9B3';
  return '#C4B7D9';
}

function sortOrderDay(d) {
  const n = parseInt(d, 10);
  if (!isNaN(n)) return n;
  if (d === '-') return 98;
  return 99;
}

// ==========================================
// RENDERIZAÇÃO DE TODAS AS ABAS
// ==========================================
function renderAll(highlightId = null) {
  syncAllMonthsWithDailyInvestments();
  const monthObj = getMonthData();
  const fin = calculateCascadingFinancials(appState.currentMonth);
  const yields = calculateYieldMetrics();

  const titleEl = document.getElementById('currentMonthTitle');
  if (titleEl) titleEl.textContent = getMonthLabel(appState.currentMonth);
  document.querySelectorAll('.lbl-cur-month').forEach(el => { el.textContent = getMonthLabel(appState.currentMonth); });
  renderYearAndMonthTabs();

  // KPIs Superiores
  document.getElementById('kpiTotalEntradas').textContent = formatBRL(fin.totalEntradas);
  document.getElementById('kpiTotalGastos').textContent = formatBRL(fin.totalSaidas);
  document.getElementById('kpiTotalInvestido').textContent = formatBRL(fin.investimentoLiquidoFimMes);
  document.getElementById('kpiSaldoMes').textContent =
    fin.fluxoMesAtual < 0
      ? `${formatBRL(fin.fluxoMesAtual)} (tirar do inv.)`
      : `+${formatBRL(fin.fluxoMesAtual)}`;
  document.getElementById('kpiRendimentoMes').textContent = formatSignedBRL(yields.sumMes);

  // Renderizar Aba 1: Planilha Mensal
  renderPlanilhaTab(monthObj, fin, highlightId);

  // Renderizar Aba 2: Cartões de Crédito (Mercado Pago & Nubank + Marcos)
  renderCartoesTab(monthObj, highlightId);

  // Renderizar Aba 3: Investimentos, Rendimentos Diários & Gráfico de Trajetória
  renderInvestimentosTab(monthObj, yields, highlightId);
}

function renderPlanilhaTab(monthObj, fin, highlightId) {
  // 1. Entradas
  const tbodyEntradas = document.getElementById('tbodyEntradas');
  tbodyEntradas.innerHTML = '';

  monthObj.entradas.forEach((item) => {
    const isDebtorSync = Boolean(item.isCardSync || item.referencia.toLowerCase().trim() === 'marcos');
    const badgeMarcos = isDebtorSync
      ? `<span class="cat-tag cat-compras" style="margin-left:6px;font-size:0.68rem;" title="Sincronizado automaticamente dos cartões do mês anterior">💳 Cartões</span>`
      : '';
    const tr = document.createElement('tr');
    tr.setAttribute('data-row-id', item.id);
    if (item.id === highlightId) tr.classList.add('luna-spotlight-3s');
    tr.innerHTML = `
      <td class="editable-cell" onclick="editInline('entradas', '${item.id}', 'referencia')">${escapeHtml(item.referencia)}${badgeMarcos}</td>
      <td class="text-right editable-cell" onclick="editInline('entradas', '${item.id}', 'valor')">${formatBRL(item.valor)}</td>
      <td class="col-actions">
        <button type="button" class="btn-edit-row" onclick="openEditItemModal('entradas', '${item.id}')" title="Editar entrada">✎</button>
        <button type="button" class="btn-delete-row" onclick="deleteItem('entradas', '${item.id}')" title="Excluir">✕</button>
      </td>
    `;
    tbodyEntradas.appendChild(tr);
  });

  document.getElementById('totalEntradasFooter').textContent = formatBRL(fin.totalEntradas);

  // 2. Resumo Investimentos na Planilha
  const tbodyInvestimentos = document.getElementById('tbodyInvestimentos');
  tbodyInvestimentos.innerHTML = '';

  monthObj.investimentos.forEach((item) => {
    const pct = fin.baseCaixinhas > 0 ? ((item.valor / fin.baseCaixinhas) * 100).toFixed(1).replace('.', ',') : '0,0';
    const tr = document.createElement('tr');
    tr.setAttribute('data-row-id', item.id);
    if (item.id === highlightId) tr.classList.add('luna-spotlight-3s');
    tr.innerHTML = `
      <td class="editable-cell" onclick="editInline('investimentos', '${item.id}', 'nome')" title="Clique para editar o nome"><strong>${escapeHtml(item.nome)}</strong></td>
      <td class="text-right editable-cell" onclick="editInline('investimentos', '${item.id}', 'valor')" title="Clique para editar o valor">${formatBRL(item.valor)}</td>
      <td class="text-right">${pct}%</td>
      <td class="inv-actions-cell">
        <button type="button" class="btn-edit-row" onclick="openInvestmentModal('${item.id}', 'planilha')" title="Editar investimento">Editar</button>
        <button type="button" class="btn-delete-row" onclick="deleteInvestmentItem('${item.id}', 'planilha')" title="Remover investimento">✕</button>
      </td>
    `;
    tbodyInvestimentos.appendChild(tr);
  });

  document.getElementById('totalInvestimentosFooter').textContent = formatBRL(fin.baseCaixinhas);

  const rowDeficit = document.getElementById('rowDeficitInvestimento');
  const labelDeficit = document.getElementById('labelDeficitInvestimento');
  const valDeficit = document.getElementById('valDeficitInvestimento');
  const valNetInv = document.getElementById('valNetInvestimento');

  if (fin.fluxoMesAtual < 0) {
    if (rowDeficit) rowDeficit.classList.remove('positive-flow');
    if (labelDeficit) labelDeficit.innerHTML = `🔻 <strong>Retirada p/ cobrir gastos (${getMonthLabel(appState.currentMonth)})</strong>`;
    if (valDeficit) valDeficit.textContent = formatBRL(fin.fluxoMesAtual);
    if (valNetInv) valNetInv.textContent = formatBRL(fin.investimentoLiquidoFimMes);
  } else {
    if (rowDeficit) rowDeficit.classList.add('positive-flow');
    if (labelDeficit) {
      if (fin.devolvidoNoMes > 0 && fin.novoInvestimentoNoMes > 0) {
        labelDeficit.innerHTML = `🎉 <strong>Reposição Quitada (+${formatBRL(fin.devolvidoNoMes)}) + Novo Aporte (+${formatBRL(fin.novoInvestimentoNoMes)})</strong>`;
      } else if (fin.devolvidoNoMes > 0) {
        labelDeficit.innerHTML = `🔄 <strong>Devolvido Automático p/ Repor Investimento (${getMonthLabel(appState.currentMonth)})</strong>`;
      } else {
        labelDeficit.innerHTML = `🟢 <strong>Novo Investimento do Mês (${getMonthLabel(appState.currentMonth)})</strong>`;
      }
    }
    if (valDeficit) valDeficit.textContent = '+' + formatBRL(fin.fluxoMesAtual);
    if (valNetInv) valNetInv.textContent = formatBRL(fin.investimentoLiquidoFimMes);
  }
// Registro do plugin de labels no gráfico de pizza

  // Atualiza o Painel de Reposição do Investimento na Planilha
  const elFaltaRepor = document.getElementById('repFaltaRepor');
  const elDevolvido = document.getElementById('repDevolvidoMes');
  const elNovoAporte = document.getElementById('repNovoAporte');
  const elStatusLbl = document.getElementById('repStatusLabel');
  const elPctLbl = document.getElementById('repPctLabel');
  const elBarFill = document.getElementById('repBarFill');

  if (elFaltaRepor) {
    elFaltaRepor.textContent = formatBRL(fin.faltaReporFimMes);
    elDevolvido.textContent = (fin.devolvidoNoMes > 0 ? '+' : '') + formatBRL(fin.devolvidoNoMes);
    elNovoAporte.textContent = (fin.novoInvestimentoNoMes > 0 ? '+' : '') + formatBRL(fin.novoInvestimentoNoMes);

    const pctReposto = fin.totalBrutoRetiradoAteAqui > 0
      ? Math.min(100, Math.round((fin.totalJaDevolvidoAteAqui / fin.totalBrutoRetiradoAteAqui) * 100))
      : 100;

    elStatusLbl.textContent = `Total retirado acumulado: ${formatBRL(fin.totalBrutoRetiradoAteAqui)} | Já devolvido: ${formatBRL(fin.totalJaDevolvidoAteAqui)}`;
    elPctLbl.textContent = `${pctReposto}% reposto`;
    elBarFill.style.width = `${pctReposto}%`;
  }

  // GrÃ¡fico de pizza movido exclusivamente para a Aba de Investimentos

  // 3. Saídas
  const tbodySaidas = document.getElementById('tbodySaidas');
  if (tbodySaidas) {
    tbodySaidas.innerHTML = '';
    const sortedSaidas = [...monthObj.saidas].sort((a, b) => sortOrderDay(a.data) - sortOrderDay(b.data));
    const totalFaturasCredito = monthObj.saidas
      .filter(s => (s.titulo || '').toLowerCase().trim() === 'fatura')
      .reduce((acc, cur) => acc + (Number(cur.valor) || 0), 0);

    updateFilterDropdown(monthObj.saidas);

    sortedSaidas.forEach((item) => {
      if (appState.filterCategoria !== 'all' && item.titulo.toLowerCase() !== appState.filterCategoria.toLowerCase()) {
        return;
      }
      const parsedParcel = parseInstallmentRef(item.referencia);
      const linkedBadge = parsedParcel
        ? `<span title="Parcela sincronizada entre os meses" style="font-size:0.72rem;margin-left:5px;">🔗</span>`
        : '';

      const tr = document.createElement('tr');
      tr.setAttribute('data-row-id', item.id);
      if (item.id === highlightId) tr.classList.add('luna-spotlight-3s');
      tr.innerHTML = `
        <td class="text-center editable-cell" onclick="editInline('saidas', '${item.id}', 'data')">${escapeHtml(item.data)}</td>
        <td class="editable-cell" onclick="editInline('saidas', '${item.id}', 'referencia')">${escapeHtml(item.referencia)}${linkedBadge}</td>
        <td class="editable-cell" onclick="editInline('saidas', '${item.id}', 'titulo')">
          <span class="cat-tag ${getCategoryClass(item.titulo)}" onclick="event.stopPropagation(); setSpreadsheetCategoryFilter('${escapeHtml(item.titulo)}')" title="Clique para filtrar por esta categoria">${escapeHtml(item.titulo)}</span>
        </td>
        <td class="text-right editable-cell" onclick="editInline('saidas', '${item.id}', 'valor')">${formatBRL(item.valor)}</td>
        <td class="col-actions">
          <button type="button" class="btn-edit-row" onclick="openEditItemModal('saidas', '${item.id}')" title="Editar gasto">✎</button>
          <button type="button" class="btn-delete-row" onclick="deleteItem('saidas', '${item.id}')" title="Excluir">✕</button>
        </td>
      `;
      tbodySaidas.appendChild(tr);
    });

    renderPivotTable(monthObj.saidas, fin.totalSaidas, monthObj.cartoes);

    const elSumGastos = document.getElementById('sumTodosOsGastos');
    if (elSumGastos) elSumGastos.textContent = formatBRL(fin.totalSaidas);

    const elSumFaturas = document.getElementById('sumFaturasCredito');
    if (elSumFaturas) elSumFaturas.textContent = formatBRL(totalFaturasCredito);

    const elSumFluxo = document.getElementById('sumFluxoInvestimento');
    if (elSumFluxo) {
      elSumFluxo.textContent =
        fin.fluxoMesAtual < 0 ? `${formatBRL(fin.fluxoMesAtual)} (retirado)` : `+${formatBRL(fin.fluxoMesAtual)} (sobra)`;
    }

    const elSumFaltaRepor = document.getElementById('sumFaltaReporTotal');
    if (elSumFaltaRepor) elSumFaltaRepor.textContent = formatBRL(fin.faltaReporFimMes);

    const elSumDevolvido = document.getElementById('sumDevolvidoInv');
    if (elSumDevolvido) elSumDevolvido.textContent = (fin.devolvidoNoMes > 0 ? '+' : '') + formatBRL(fin.devolvidoNoMes);

    const elSumSobra = document.getElementById('sumSobra');
    if (elSumSobra) elSumSobra.textContent = (fin.novoInvestimentoNoMes > 0 ? '+' : '') + formatBRL(fin.novoInvestimentoNoMes);

    const elSumInvFin = document.getElementById('sumInvestimentoFinal');
    if (elSumInvFin) elSumInvFin.textContent = formatBRL(fin.investimentoLiquidoFimMes);

    const elSumInvRef = document.getElementById('sumInvestimentoPlanilhaRef');
    if (elSumInvRef) {
      elSumInvRef.textContent =
        `Início: ${formatBRL(fin.investimentoInicioMes)} → Fim: ${formatBRL(fin.investimentoLiquidoFimMes)} (Falta repor: ${formatBRL(fin.faltaReporFimMes)})`;
    }
  }

  requestAnimationFrame(() => {
    const cardEntradas = document.getElementById('cardEntradasPlanilha');
    const cardSaidas = document.getElementById('cardSaidasPlanilha');
    if (cardEntradas && cardSaidas) {
      cardSaidas.style.height = '';
      if (window.innerWidth > 960) {
        cardEntradas.style.height = `${cardSaidas.offsetHeight}px`;
      } else {
        cardEntradas.style.height = '';
      }
    }

    const cardInvest = document.getElementById('cardInvestimentosPlanilha');
    const cardDinamica = document.getElementById('cardDinamicaPlanilha');
    if (cardInvest && cardDinamica) {
      cardDinamica.style.height = '';
      if (window.innerWidth > 960) {
        cardInvest.style.height = `${cardDinamica.offsetHeight}px`;
      } else {
        cardInvest.style.height = '';
      }
    }
  });
}

// =========================================================
// CONTROLES DE FILTRO DOS CARTÕES DE CRÉDITO E PLANILHA
// =========================================================
window.setSpreadsheetCategoryFilter = function(cat) {
  appState.filterCategoria = cat;
  const sel = document.getElementById('filterCategoria');
  if (sel) sel.value = cat;
  renderAll();
};

window.setCardCategoryFilter = function(cat) {
  appState.filterCardCategoria = cat;
  const sel = document.getElementById('filterCardCategoria');
  if (sel) sel.value = cat;
  renderAll();
};

window.setCardMarcosFilter = function(type) {
  appState.filterCardMarcos = type; // 'all' | 'meu' | 'marcos'
  const sel = document.getElementById('filterCardMarcos');
  if (sel) sel.value = type;
  renderAll();
};

window.clearCardFilters = function() {
  appState.filterCardCategoria = 'all';
  appState.filterCardMarcos = 'all';
  const selCat = document.getElementById('filterCardCategoria');
  if (selCat) selCat.value = 'all';
  const selMarcos = document.getElementById('filterCardMarcos');
  if (selMarcos) selMarcos.value = 'all';
  renderAll();
};

function updateCardFilterUI(monthObj) {
  const container = document.getElementById('chipsCardCategoria');
  if (!container) return;

  const currentCat = (appState.filterCardCategoria || 'all').toLowerCase().trim();
  const currentMarcos = (appState.filterCardMarcos || 'all').toLowerCase().trim();

  // Coleta todas as categorias presentes nos cartões deste mês
  const cats = new Set(['compras', 'contas', 'parcelado', 'uber']);
  ['mercadopago', 'nubank'].forEach(ck => {
    (monthObj.cartoes?.[ck]?.items || []).forEach(i => {
      if (i.titulo) cats.add(i.titulo.toLowerCase().trim());
    });
  });

  // Atualiza select se existir
  const selCat = document.getElementById('filterCardCategoria');
  if (selCat) {
    selCat.innerHTML = `<option value="all">Todas categorias</option>`;
    Array.from(cats).sort().forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      if (c === currentCat) opt.selected = true;
      selCat.appendChild(opt);
    });
  }

  // Atualiza chips de categorias
  container.innerHTML = '';
  const btnAll = document.createElement('button');
  btnAll.type = 'button';
  btnAll.className = 'chip-filter' + (currentCat === 'all' ? ' active' : '');
  btnAll.textContent = 'Todas';
  btnAll.onclick = () => window.setCardCategoryFilter('all');
  container.appendChild(btnAll);

  Array.from(cats).sort().forEach(c => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `chip-filter chip-cat-${c}` + (currentCat === c ? ' active' : '');
    btn.textContent = c;
    btn.onclick = () => window.setCardCategoryFilter(c);
    container.appendChild(btn);
  });

  // Atualiza chips dinâmicos de devedores / divisão (Todos, Apenas Meu, Apenas Marcos, Apenas Fulano...)
  const marcosChips = document.getElementById('chipsCardMarcos');
  const selMarcos = document.getElementById('filterCardMarcos');
  if (marcosChips) {
    marcosChips.innerHTML = '';

    const debtorsFound = new Map();
    debtorsFound.set('marcos', 'Marcos');
    const allCardItems = [...(monthObj.cartoes?.mercadopago?.items || []), ...(monthObj.cartoes?.nubank?.items || [])];
    allCardItems.forEach(i => {
      const d = getItemDebtor(i);
      if (d) {
        debtorsFound.set(d.toLowerCase(), d);
      }
    });

    const btnAll = document.createElement('button');
    btnAll.type = 'button';
    btnAll.className = 'chip-filter' + (currentMarcos === 'all' ? ' active' : '');
    btnAll.textContent = 'Todos';
    btnAll.onclick = () => window.setCardMarcosFilter('all');
    marcosChips.appendChild(btnAll);

    const btnMeu = document.createElement('button');
    btnMeu.type = 'button';
    btnMeu.className = 'chip-filter' + (currentMarcos === 'meu' ? ' active' : '');
    btnMeu.textContent = 'Apenas Meu';
    btnMeu.onclick = () => window.setCardMarcosFilter('meu');
    marcosChips.appendChild(btnMeu);

    debtorsFound.forEach((dispName, key) => {
      const btnD = document.createElement('button');
      btnD.type = 'button';
      btnD.className = 'chip-filter' + (currentMarcos === key ? ' active' : '');
      btnD.textContent = `Apenas ${dispName}`;
      btnD.onclick = () => window.setCardMarcosFilter(key);
      marcosChips.appendChild(btnD);
    });

    if (selMarcos) {
      selMarcos.innerHTML = `
        <option value="all">Todos</option>
        <option value="meu">Apenas Meu</option>
      `;
      debtorsFound.forEach((dispName, key) => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = `Apenas ${dispName}`;
        if (currentMarcos === key) opt.selected = true;
        selMarcos.appendChild(opt);
      });
      if (currentMarcos === 'all' || currentMarcos === 'meu') selMarcos.value = currentMarcos;
    }
  }

  // Aviso de filtro ativo
  const notice = document.getElementById('cardFilterNotice');
  const noticeText = document.getElementById('cardFilterNoticeText');
  if (notice && noticeText) {
    const isFiltered = currentCat !== 'all' || currentMarcos !== 'all';
    notice.style.display = isFiltered ? 'flex' : 'none';
    if (isFiltered) {
      const parts = [];
      if (currentCat !== 'all') parts.push(`Categoria: <strong>${escapeHtml(currentCat)}</strong>`);
      if (currentMarcos === 'meu') {
        parts.push(`Divisão: <strong>Apenas Meu</strong>`);
      } else if (currentMarcos !== 'all') {
        parts.push(`Divisão: <strong>Apenas ${escapeHtml(currentMarcos.toUpperCase())}</strong>`);
      }
      noticeText.innerHTML = `🔍 Filtrando por: ${parts.join(' &bull; ')}`;
    }
  }

  if (window.lucide) lucide.createIcons();
}

// =========================================================
// RENDERIZAR ABA 2: CARTÕES DE CRÉDITO (MP & NUBANK + DEVEDORES)
// =========================================================
function buildCardDebtorButtonsHtml(cardKey, item) {
  const itemDebtor = getItemDebtor(item);
  const itemDebtorKey = itemDebtor ? itemDebtor.toLowerCase() : null;
  const isMeu = !itemDebtor;
  const isMarcos = itemDebtorKey === 'marcos';
  const activeClass = isMeu ? 'active-meu' : (isMarcos ? 'active-marcos' : 'active-other');
  const displayName = itemDebtor || 'Meu';

  return `
    <div class="debtor-row-group">
      <button type="button" class="debtor-pill-opt ${activeClass}" onclick="openDebtorPopover(event, '${cardKey}', '${item.id}')" title="Clique para alterar quem deve">${escapeHtml(displayName)} ✎</button>
    </div>
  `;
}

function renderCardDebtorsFooter(containerId, fallbackStrongId, cardKey, totals) {
  const container = document.getElementById(containerId);
  if (!container) {
    const el = document.getElementById(fallbackStrongId);
    if (el) el.textContent = formatBRL(totals[cardKey].marcos);
    return;
  }
  const debtorsList = Object.values(totals.debtors).filter(d => (cardKey === 'mp' ? d.mp : d.nu) > 0);
  if (debtorsList.length === 0) {
    container.innerHTML = `
      <div class="invoice-row row-marcos-highlight">
        <span>a cobrar (vai p/ entrada do mês seguinte)</span>
        <strong id="${fallbackStrongId}">R$ 0,00</strong>
      </div>
    `;
    return;
  }
  container.innerHTML = debtorsList.map((d, idx) => {
    const val = cardKey === 'mp' ? d.mp : d.nu;
    return `
      <div class="invoice-row row-marcos-highlight">
        <span><strong>${escapeHtml(d.name.toLowerCase())}</strong> (vai p/ entrada do mês seguinte)</span>
        <strong ${idx === 0 ? `id="${fallbackStrongId}"` : ''}>${formatBRL(val)}</strong>
      </div>
    `;
  }).join('');
}

function renderCartoesTab(monthObj, highlightId) {
  const nextM = getNextMonthName(appState.currentMonth) || 'MÊS SEGUINTE';
  document.getElementById('lblCardSpendMonth').textContent = getMonthLabel(appState.currentMonth);
  document.getElementById('lblCardPayMonth').textContent = getMonthLabel(nextM);
  document.querySelectorAll('.lblCardPayMonthText').forEach(el => { el.textContent = getMonthLabel(nextM); });

  const totals = calculateCardTotals(appState.currentMonth);

  document.getElementById('cardBannerTotalFaturas').textContent = formatBRL(totals.totalFaturas);
  document.getElementById('cardBannerTotalMarcos').textContent = formatBRL(totals.totalDebtors);
  document.getElementById('cardBannerTotalMeu').textContent = formatBRL(totals.totalMeu);

  const titleEl = document.getElementById('cardBannerDebtorsTitle');
  if (titleEl) {
    const dList = Object.values(totals.debtors).map(d => `${d.name}: ${formatBRL(d.total)}`);
    if (dList.length > 0) {
      titleEl.textContent = `Total a Cobrar (${dList.join(' | ')})`;
    } else {
      titleEl.textContent = `Total a Cobrar (MP + Nubank)`;
    }
  }

  // 1. Mercado Pago
  document.getElementById('mpParcelasAnteriores').textContent = formatBRL(totals.mp.parcelasAnteriores);
  const tbodyMP = document.getElementById('tbodyCardMP');
  tbodyMP.innerHTML = '';

  const filterCat = (appState.filterCardCategoria || 'all').toLowerCase().trim();
  const filterMarcos = (appState.filterCardMarcos || 'all').toLowerCase().trim();

  updateCardFilterUI(monthObj);

  let mpFilteredCount = 0;
  monthObj.cartoes.mercadopago.items.forEach(item => {
    const itemCat = (item.titulo || 'compras').toLowerCase().trim();
    const itemDebtor = getItemDebtor(item);
    const itemDebtorKey = itemDebtor ? itemDebtor.toLowerCase() : null;

    if (filterCat !== 'all' && itemCat !== filterCat) return;
    if (filterMarcos === 'meu' && itemDebtor) return;
    if (filterMarcos !== 'all' && filterMarcos !== 'meu' && itemDebtorKey !== filterMarcos) return;

    mpFilteredCount++;
    const tr = document.createElement('tr');
    tr.setAttribute('data-row-id', item.id);
    if (itemDebtor) tr.classList.add('row-is-marcos');
    if (item.id === highlightId) tr.classList.add('luna-spotlight-3s');

    tr.innerHTML = `
      <td class="text-center editable-cell" onclick="editCardItemInline('mercadopago', '${item.id}', 'data')">${escapeHtml(item.data)}</td>
      <td class="editable-cell" onclick="editCardItemInline('mercadopago', '${item.id}', 'referencia')">${escapeHtml(item.referencia)}${parseInstallmentRef(item.referencia) ? '<span title="Parcela sincronizada automaticamente entre os meses" style="font-size:0.75rem;margin-left:5px;">🔗</span>' : ''}</td>
      <td class="editable-cell" onclick="editCardItemInline('mercadopago', '${item.id}', 'titulo', event)" title="Clique para alterar o título">
        <span class="cat-tag ${getCategoryClass(item.titulo)}">${escapeHtml(item.titulo)}</span>
      </td>
      <td class="text-center">
        ${buildCardDebtorButtonsHtml('mercadopago', item)}
      </td>
      <td class="text-right editable-cell" onclick="editCardItemInline('mercadopago', '${item.id}', 'valor')">${formatBRL(item.valor)}</td>
      <td class="col-actions">
        <button type="button" class="btn-edit-row" onclick="openEditCardModal('mercadopago', '${item.id}')" title="Editar gasto">✎</button>
        <button type="button" class="btn-delete-row" onclick="deleteCardItem('mercadopago', '${item.id}')" title="Excluir">✕</button>
      </td>
    `;
    tbodyMP.appendChild(tr);
  });

  if (mpFilteredCount === 0 && monthObj.cartoes.mercadopago.items.length > 0) {
    const trEmpty = document.createElement('tr');
    trEmpty.innerHTML = `<td colspan="6" class="text-center" style="padding:16px; color:var(--text-muted); font-size:0.82rem;">Nenhum gasto com este filtro no Mercado Pago. <a href="javascript:void(0)" onclick="clearCardFilters()" style="color:var(--pastel-lavender-deep);font-weight:700;">Ver todos</a></td>`;
    tbodyMP.appendChild(trEmpty);
  }

  document.getElementById('mpTotalMes').textContent = formatBRL(totals.mp.gastoMes);
  renderCardDebtorsFooter('mpDebtorsFooterList', 'mpTotalMarcos', 'mp', totals);
  document.getElementById('mpTotalMeu').textContent = formatBRL(totals.mp.meu);
  document.getElementById('mpFaturaFinal').textContent = formatBRL(totals.mp.faturaFinal);

  // 2. Nubank
  document.getElementById('nuParcelasAnteriores').textContent = formatBRL(totals.nu.parcelasAnteriores);
  const tbodyNu = document.getElementById('tbodyCardNubank');
  tbodyNu.innerHTML = '';

  let nuFilteredCount = 0;
  monthObj.cartoes.nubank.items.forEach(item => {
    const itemCat = (item.titulo || 'compras').toLowerCase().trim();
    const itemDebtor = getItemDebtor(item);
    const itemDebtorKey = itemDebtor ? itemDebtor.toLowerCase() : null;

    if (filterCat !== 'all' && itemCat !== filterCat) return;
    if (filterMarcos === 'meu' && itemDebtor) return;
    if (filterMarcos !== 'all' && filterMarcos !== 'meu' && itemDebtorKey !== filterMarcos) return;

    nuFilteredCount++;
    const tr = document.createElement('tr');
    tr.setAttribute('data-row-id', item.id);
    if (itemDebtor) tr.classList.add('row-is-marcos');
    if (item.id === highlightId) tr.classList.add('luna-spotlight-3s');

    tr.innerHTML = `
      <td class="text-center editable-cell" onclick="editCardItemInline('nubank', '${item.id}', 'data')">${escapeHtml(item.data)}</td>
      <td class="editable-cell" onclick="editCardItemInline('nubank', '${item.id}', 'referencia')">${escapeHtml(item.referencia)}${parseInstallmentRef(item.referencia) ? '<span title="Parcela sincronizada automaticamente entre os meses" style="font-size:0.75rem;margin-left:5px;">🔗</span>' : ''}</td>
      <td class="editable-cell" onclick="editCardItemInline('nubank', '${item.id}', 'titulo', event)" title="Clique para alterar o título">
        <span class="cat-tag ${getCategoryClass(item.titulo)}">${escapeHtml(item.titulo)}</span>
      </td>
      <td class="text-center">
        ${buildCardDebtorButtonsHtml('nubank', item)}
      </td>
      <td class="text-right editable-cell" onclick="editCardItemInline('nubank', '${item.id}', 'valor')">${formatBRL(item.valor)}</td>
      <td class="col-actions">
        <button type="button" class="btn-edit-row" onclick="openEditCardModal('nubank', '${item.id}')" title="Editar gasto">✎</button>
        <button type="button" class="btn-delete-row" onclick="deleteCardItem('nubank', '${item.id}')" title="Excluir">✕</button>
      </td>
    `;
    tbodyNu.appendChild(tr);
  });

  if (nuFilteredCount === 0 && monthObj.cartoes.nubank.items.length > 0) {
    const trEmpty = document.createElement('tr');
    trEmpty.innerHTML = `<td colspan="6" class="text-center" style="padding:16px; color:var(--text-muted); font-size:0.82rem;">Nenhum gasto com este filtro no Nubank. <a href="javascript:void(0)" onclick="clearCardFilters()" style="color:var(--pastel-lavender-deep);font-weight:700;">Ver todos</a></td>`;
    tbodyNu.appendChild(trEmpty);
  }

  document.getElementById('nuTotalMes').textContent = formatBRL(totals.nu.gastoMes);
  renderCardDebtorsFooter('nuDebtorsFooterList', 'nuTotalMarcos', 'nu', totals);
  document.getElementById('nuTotalMeu').textContent = formatBRL(totals.nu.meu);
  document.getElementById('nuFaturaFinal').textContent = formatBRL(totals.nu.faturaFinal);
}

// =========================================================
// RENDERIZAR ABA 3: INVESTIMENTOS, RENDIMENTOS & TRAJETÓRIA
// =========================================================
// Consulta somente leitura do histórico: os limites incluem os dois dias selecionados.
function calculateYieldRange(startDate, endDate) {
  const isValidDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  };
  if (!isValidDate(startDate) || !isValidDate(endDate)) return { error: 'Escolha as datas inicial e final.' };
  if (startDate > endDate) return { error: 'A data inicial deve ser anterior ou igual à data final.' };
  const cents = new Map();
  appState.yieldHistory.forEach(log => {
    if (log.date < startDate || log.date > endDate) return;
    const value = Number(log.yieldVal);
    if (!Number.isFinite(value)) return;
    const key = String(log.nome || '').toLowerCase();
    cents.set(key, (cents.get(key) || 0) + Math.round(value * 100));
  });
  const perInvestment = appState.dailyInvestments.map(inv => ({
    id: inv.id, value: (cents.get(inv.nome.toLowerCase()) || 0) / 100
  }));
  const total = perInvestment.reduce((sum, inv) => sum + Math.round(inv.value * 100), 0) / 100;
  return { startDate, endDate, total, perInvestment };
}

function renderYieldRange() {
  const today = getTodayLocalISO();
  const from = document.getElementById('yieldRangeStart');
  const to = document.getElementById('yieldRangeEnd');
  from.value = appState.yieldRangeStart ?? (today.slice(0, 7) + '-01');
  to.value = appState.yieldRangeEnd ?? today;
  const result = calculateYieldRange(from.value, to.value);
  const status = document.getElementById('yieldRangeStatus');
  const total = document.getElementById('totRendeuIntervalo');
  if (result.error) {
    status.textContent = result.error;
    total.textContent = '—';
    appState.dailyInvestments.forEach(inv => {
      const cell = document.getElementById('dailyYieldRange_' + inv.id);
      if (cell) cell.textContent = '—';
    });
    return;
  }
  const displayDate = iso => iso.split('-').reverse().join('/');
  status.textContent = 'De ' + displayDate(result.startDate) + ' a ' + displayDate(result.endDate) + ' · Rendimento total: ' + formatSignedBRL(result.total);
  total.textContent = formatSignedBRL(result.total);
  result.perInvestment.forEach(inv => {
    const cell = document.getElementById('dailyYieldRange_' + inv.id);
    if (cell) {
      cell.textContent = formatSignedBRL(inv.value);
      cell.className = inv.value >= 0 ? 'badge-yield-pos' : 'badge-yield-neg';
    }
  });
}

function renderInvestimentosTab(monthObj, yields, highlightId) {
  document.getElementById('yieldTotalDia').textContent = formatSignedBRL(yields.sumDia);
  document.getElementById('yieldTotalSemana').textContent = formatSignedBRL(yields.sumSemana);
  document.getElementById('yieldTotalMes').textContent = formatSignedBRL(yields.sumMes);
  const displayPeriodDate = iso => iso.split('-').reverse().join('/');
  document.getElementById('yieldSubSemana').textContent = `De ${displayPeriodDate(yields.weekStart)} a ${displayPeriodDate(yields.weekEnd)} (segunda a domingo)`;
  document.getElementById('yieldSubMes').textContent = `De ${displayPeriodDate(yields.monthStart)} a ${displayPeriodDate(yields.monthEnd)} (mês atual)`;
  const activeDateStr = document.getElementById('inputDailyDate')?.value || getTodayLocalISO();
  document.getElementById('yieldSubDia').textContent = `Referente a ${activeDateStr.split('-').reverse().join('/')} (${appState.dailyInvestments.length} investimentos)`;

  // Atualiza filtro do gráfico de trajetória dinamicamente com todos os investimentos atuais
  const selTraj = document.getElementById('selectTrajectoryFilter');
  if (selTraj) {
    const curVal = appState.trajectoryFilter || 'ALL';
    selTraj.innerHTML = `
      <option value="ALL">Somando Todos (Patrimônio Total)</option>
      <option value="SEPARATED">Separados por Cada Investimento</option>
    `;
    appState.dailyInvestments.forEach(inv => {
      const opt = document.createElement('option');
      opt.value = inv.nome;
      opt.textContent = `Apenas ${inv.nome}`;
      if (inv.nome === curVal) opt.selected = true;
      selTraj.appendChild(opt);
    });
    if (curVal === 'ALL' || curVal === 'SEPARATED') selTraj.value = curVal;
  }

  const tbodyDaily = document.getElementById('tbodyDailyInvestments');
  tbodyDaily.innerHTML = '';

  let sumAnt = 0;
  let sumAtu = 0;

  appState.dailyInvestments.forEach(inv => {
    const m = yields.perInvestment[inv.nome] || { valorAnterior: inv.valor, valorAtual: inv.valor, dia: 0, semana: 0, mes: 0 };
    sumAnt += m.valorAnterior;
    sumAtu += m.valorAtual;

    const badgeClass = (v) => (v >= 0 ? 'badge-yield-pos' : 'badge-yield-neg');

    const tr = document.createElement('tr');
    tr.setAttribute('data-row-id', `daily_${inv.id}`);
    if (inv.id === highlightId || `daily_${inv.id}` === highlightId) tr.classList.add('luna-spotlight-3s');
    tr.innerHTML = `
      <td class="editable-cell" onclick="editDailyInvestmentName('${inv.id}')" title="Clique para renomear este investimento"><strong>${escapeHtml(inv.nome)}</strong></td>
      <td id="dailyBaseCell_${inv.id}" class="text-right editable-cell" onclick="editDailyValorAnterior('${inv.id}')" title="Clique para editar o Valor Anterior (Base)">${formatBRL(m.valorAnterior)}</td>
      <td class="text-right">
        <input type="number" step="0.01" id="dailyAporte_${inv.id}" class="daily-val-input daily-aporte-input" placeholder="+0,00 / -0,00" value="" oninput="onDailyAporteInput('${inv.id}')" title="Coloque positivo se adicionou dinheiro (ex: 100) ou negativo se retirou/transferiu (ex: -20). Esse valor não soma como rendimento!" />
      </td>
      <td class="text-right">
        <input type="number" step="0.01" id="dailyInput_${inv.id}" class="daily-val-input" value="${m.valorAtual.toFixed(2)}" data-user-typed-total="false" oninput="onDailyNewValInput('${inv.id}')" />
      </td>
      <td class="text-right"><span id="dailyYieldDiaBadge_${inv.id}" class="${badgeClass(m.dia)}">${formatSignedBRL(m.dia)}</span></td>
      <td class="text-right"><span class="${badgeClass(m.semana)}">${formatSignedBRL(m.semana)}</span></td>
      <td class="text-right"><span class="${badgeClass(m.mes)}">${formatSignedBRL(m.mes)}</span></td>
      <td class="text-right"><span id="dailyYieldRange_${inv.id}">—</span></td>
      <td class="col-actions">
        <button type="button" class="btn-delete-row" onclick="deleteInvestmentItem('${inv.id}', 'daily')" title="Excluir investimento">✕</button>
      </td>
    `;
    tbodyDaily.appendChild(tr);
  });

  document.getElementById('totInvAnterior').textContent = formatBRL(sumAnt);
  const totInvAporteEl = document.getElementById('totInvAporte');
  if (totInvAporteEl) totInvAporteEl.textContent = 'R$ 0,00';
  document.getElementById('totInvAtual').textContent = formatBRL(sumAtu);
  document.getElementById('totRendeuDia').textContent = formatSignedBRL(yields.sumDia);
  document.getElementById('totRendeuSemana').textContent = formatSignedBRL(yields.sumSemana);
  document.getElementById('totRendeuMes').textContent = formatSignedBRL(yields.sumMes);
  renderYieldRange();

  // Histórico de Atualizações Diárias
  const tbodyHist = document.getElementById('tbodyYieldHistory');
  tbodyHist.innerHTML = '';
  const sortedHist = [...appState.yieldHistory].reverse();
  sortedHist.forEach(h => {
    const tr = document.createElement('tr');
    const hasAporte = typeof h.aporteVal === 'number' && Math.abs(h.aporteVal) > 0.001;
    const baseInitial = h.oldValBeforeAporte !== undefined ? h.oldValBeforeAporte : h.oldVal;
    const aporteTag = hasAporte
      ? ` <span class="hist-aporte-tag ${h.aporteVal > 0 ? 'pos' : 'neg'}">(${h.aporteVal > 0 ? '+' : ''}${formatBRL(h.aporteVal)} ${h.aporteVal > 0 ? 'aporte' : 'retirada'})</span>`
      : '';
    tr.innerHTML = `
      <td>${h.date.split('-').reverse().join('/')}</td>
      <td><strong>${escapeHtml(h.nome)}</strong></td>
      <td class="text-right"><small>${formatBRL(baseInitial)}${aporteTag} ➔ ${formatBRL(h.newVal)}</small></td>
      <td class="text-right"><span class="${h.yieldVal >= 0 ? 'badge-yield-pos' : 'badge-yield-neg'}">${formatSignedBRL(h.yieldVal)}</span></td>
    `;
    tbodyHist.appendChild(tr);
  });

  renderTrajectoryChart(appState.dailyInvestments);
  renderInvestimentosPieChart(appState.dailyInvestments);

  // Tabela Completa de Reposição do Investimento e Sobra p/ Investir (Outubro até Março)
  const tbodyRep = document.getElementById('tbodyReplenishTimeline');
  if (tbodyRep) {
    tbodyRep.innerHTML = '';
    const timeline = calculateFullReplenishmentTimeline();

    // Mostra no máximo 3 meses (o mês selecionado + os 2 seguintes); "Visualizar mais" mostra todos
    const REPLENISH_VISIBLE = 3;
    const highlightMonth = typeof highlightId === 'string' && highlightId.startsWith('rep_') ? highlightId.slice(4) : null;
    let visibleMonths = MONTH_ORDER;
    if (!replenishShowAll) {
      const curIdx = Math.max(0, MONTH_ORDER.indexOf(appState.currentMonth));
      const start = Math.min(curIdx, Math.max(0, MONTH_ORDER.length - REPLENISH_VISIBLE));
      visibleMonths = MONTH_ORDER.slice(start, start + REPLENISH_VISIBLE);
      // Se a Sailor pedir para destacar um mês que está escondido, inclui ele também
      if (highlightMonth && MONTH_ORDER.includes(highlightMonth) && !visibleMonths.includes(highlightMonth)) {
        visibleMonths = MONTH_ORDER.filter(m => visibleMonths.includes(m) || m === highlightMonth);
      }
    }

    const btnToggleRep = document.getElementById('btnToggleReplenish');
    if (btnToggleRep) {
      btnToggleRep.style.display = MONTH_ORDER.length > REPLENISH_VISIBLE ? '' : 'none';
      btnToggleRep.textContent = replenishShowAll
        ? 'Visualizar menos ▲'
        : `Visualizar mais (${MONTH_ORDER.length} meses) ▼`;
    }

    const isDarkTheme = document.body.classList.contains('dark-theme');
    const zeroColor = isDarkTheme ? '#D4B2C2' : '#64748B';
    const negColor = isDarkTheme ? '#FB7185' : '#E11D48';
    const posColor = isDarkTheme ? '#4ADE80' : '#059669';
    const devColor = isDarkTheme ? '#60A5FA' : '#0284C7';
    const faltaColor = isDarkTheme ? '#FDA4AF' : '#B91C1C';

    visibleMonths.forEach((mName) => {
      const t = timeline[mName];
      const tr = document.createElement('tr');
      tr.setAttribute('data-row-id', `rep_${mName}`);
      if (`rep_${mName}` === highlightId) tr.classList.add('luna-spotlight-3s');
      if (mName === appState.currentMonth) tr.style.background = isDarkTheme ? 'rgba(236, 72, 153, 0.16)' : 'rgba(139, 92, 246, 0.08)';
      const saldoColor = t.fluxoMesAtual < 0 ? negColor : posColor;
      tr.innerHTML = `
        <td><strong>${getMonthLabel(mName)}</strong></td>
        <td class="text-right" style="color:${saldoColor};font-weight:700;">
          ${t.fluxoMesAtual < 0 ? formatBRL(t.fluxoMesAtual) : '+' + formatBRL(t.fluxoMesAtual)}
        </td>
        <td class="text-right" style="color:${t.retiradoNoMes > 0 ? negColor : zeroColor};font-weight:${t.retiradoNoMes > 0 ? '700' : '400'};">
          ${t.retiradoNoMes > 0 ? '-' + formatBRL(t.retiradoNoMes) : 'R$ 0,00'}
        </td>
        <td class="text-right" style="color:${t.devolvidoNoMes > 0 ? devColor : zeroColor};font-weight:${t.devolvidoNoMes > 0 ? '700' : '400'};">
          ${t.devolvidoNoMes > 0 ? '+' + formatBRL(t.devolvidoNoMes) : 'R$ 0,00'}
        </td>
        <td class="text-right" style="color:${t.faltaReporFimMes > 0 ? faltaColor : posColor};font-weight:800;">
          ${t.faltaReporFimMes > 0 ? formatBRL(t.faltaReporFimMes) : 'R$ 0,00 (Quitado! 🎉)'}
        </td>
        <td class="text-right" style="color:${t.novoInvestimentoNoMes > 0 ? posColor : zeroColor};font-weight:${t.novoInvestimentoNoMes > 0 ? '800' : '400'};">
          ${t.novoInvestimentoNoMes > 0 ? '+' + formatBRL(t.novoInvestimentoNoMes) : 'R$ 0,00'}
        </td>
      `;
      tbodyRep.appendChild(tr);
    });
  }
}

/**
 * Leva a usuária imediatamente até a aba, mês e linha/seção pedida,
 * rola a tela suavemente e deixa o elemento destacado por exatos 3 segundos (3000ms) com selo indicador!
 */
let currentSpotlightTimer = null;
let currentFloatingPointerEl = null;

window.navigateToAndSpotlight = function({ view = null, month = null, rowId = null, rowIds = null, selector = null, pointerLabel = '✨ Aqui está, miga!' }) {
  if (currentSpotlightTimer) {
    clearTimeout(currentSpotlightTimer);
    currentSpotlightTimer = null;
  }
  if (currentFloatingPointerEl) {
    currentFloatingPointerEl.remove();
    currentFloatingPointerEl = null;
  }
  document.querySelectorAll('.luna-spotlight-3s').forEach(el => el.classList.remove('luna-spotlight-3s'));

  const targetIds = Array.isArray(rowIds) && rowIds.length > 0
    ? rowIds
    : (rowId ? [rowId] : []);

  // 1. Se tiver filtro de categoria bloqueando a visualização, limpa para 'all'
  if (appState.filterCategoria !== 'all') {
    appState.filterCategoria = 'all';
    const sel = document.getElementById('filterCategoria');
    if (sel) sel.value = 'all';
  }
  if (appState.filterCardCategoria !== 'all' || appState.filterCardMarcos !== 'all') {
    appState.filterCardCategoria = 'all';
    appState.filterCardMarcos = 'all';
    const selCat = document.getElementById('filterCardCategoria');
    if (selCat) selCat.value = 'all';
    const selMarcos = document.getElementById('filterCardMarcos');
    if (selMarcos) selMarcos.value = 'all';
  }

  // 2. Troca a aba (planilha, cartoes, investimentos) se necessário
  if (view && appState.currentView !== view) {
    window.switchView(view);
  }

  // 3. Troca o mês se necessário e re-renderiza destacando o primeiro rowId
  if (month && MONTH_ORDER.includes(month)) {
    appState.currentMonth = month;
  }
  renderAll(targetIds[0] || null);

  // 4. Localiza o(s) elemento(s) no DOM, faz scroll suave e aplica o destaque de 3 segundos
  setTimeout(() => {
    const matchedEls = [];
    targetIds.forEach(id => {
      const el = document.querySelector(`[data-row-id="${id}"]`);
      if (el) matchedEls.push(el);
    });

    if (matchedEls.length === 0 && selector) {
      const selEl = document.querySelector(selector);
      if (selEl) matchedEls.push(selEl);
    }

    if (matchedEls.length === 0) return;

    matchedEls.forEach(el => {
      el.classList.remove('luna-spotlight-3s');
      void el.offsetWidth; // Reflow para reiniciar animação de 3s
      el.classList.add('luna-spotlight-3s');
    });

    const primaryEl = matchedEls[0];
    primaryEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Cria etiqueta flutuante apontando para o item por 3 segundos
    const pointer = document.createElement('div');
    pointer.className = 'luna-pointer-FloatingTag';
    pointer.innerHTML = `${pointerLabel} 👇`;
    document.body.appendChild(pointer);
    currentFloatingPointerEl = pointer;

    const updatePointerPos = () => {
      if (!currentFloatingPointerEl || !document.body.contains(primaryEl)) return;
      const rect = primaryEl.getBoundingClientRect();
      pointer.style.left = `${Math.max(90, Math.min(window.innerWidth - 90, rect.left + rect.width / 2))}px`;
      pointer.style.top = `${Math.max(40, rect.top - 6)}px`;
    };
    updatePointerPos();
    const posInterval = setInterval(updatePointerPos, 60);

    currentSpotlightTimer = setTimeout(() => {
      clearInterval(posInterval);
      matchedEls.forEach(el => el.classList.remove('luna-spotlight-3s'));
      if (currentFloatingPointerEl) {
        currentFloatingPointerEl.remove();
        currentFloatingPointerEl = null;
      }
    }, 3000);
  }, 50);
};

function renderTrajectoryChart(investimentos) {
  const canvas = document.getElementById('trajectoryLineChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Coletar todas as datas do histórico em ordem cronológica
  const dates = [...new Set(appState.yieldHistory.map(h => h.date))].sort();
  const labels = dates.map(d => d.split('-').reverse().slice(0, 2).join('/'));

  const filter = appState.trajectoryFilter || 'ALL';
  const palette = {
    'nubank 120': '#B86DF5',
    'nubank 130': '#6D35B5',
    'XP': '#D4A338',
    'mercado livre': '#F59E0B',
    'mercado pago': '#10B981'
  };

  let datasets = [];

  if (filter === 'ALL') {
    // Soma todos os investimentos em cada data
    const totalPoints = dates.map(d => {
      return investimentos.reduce((acc, inv) => {
        const logsUpToD = appState.yieldHistory.filter(h => h.nome.toLowerCase() === inv.nome.toLowerCase() && h.date <= d);
        const valAtD = logsUpToD.length > 0 ? logsUpToD[logsUpToD.length - 1].newVal : inv.valor;
        return acc + valAtD;
      }, 0);
    });

    datasets = [{
      label: 'Patrimônio Total Investido (Somando Todos)',
      data: totalPoints,
      borderColor: '#7C3AED',
      backgroundColor: 'rgba(124, 58, 237, 0.14)',
      borderWidth: 3,
      fill: true,
      tension: 0.35,
      pointRadius: 5,
      pointBackgroundColor: '#FFFFFF',
      pointBorderColor: '#7C3AED',
      pointBorderWidth: 2.5
    }];
  } else if (filter === 'SEPARATED') {
    datasets = investimentos.map(inv => {
      const pts = dates.map(d => {
        const logsUpToD = appState.yieldHistory.filter(h => h.nome.toLowerCase() === inv.nome.toLowerCase() && h.date <= d);
        return logsUpToD.length > 0 ? logsUpToD[logsUpToD.length - 1].newVal : inv.valor;
      });
      const color = palette[inv.nome] || '#EC4899';
      return {
        label: inv.nome,
        data: pts,
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2.5,
        fill: false,
        tension: 0.3,
        pointRadius: 4
      };
    });
  } else {
    const inv = investimentos.find(i => i.nome.toLowerCase() === filter.toLowerCase());
    if (inv) {
      const pts = dates.map(d => {
        const logsUpToD = appState.yieldHistory.filter(h => h.nome.toLowerCase() === inv.nome.toLowerCase() && h.date <= d);
        return logsUpToD.length > 0 ? logsUpToD[logsUpToD.length - 1].newVal : inv.valor;
      });
      const color = palette[inv.nome] || '#8B5CF6';
      datasets = [{
        label: `Trajetória: ${inv.nome}`,
        data: pts,
        borderColor: color,
        backgroundColor: 'rgba(139, 92, 246, 0.14)',
        borderWidth: 3,
        fill: true,
        tension: 0.35,
        pointRadius: 5
      }];
    }
  }

  const isDark = document.body.classList.contains('dark-theme');
  const legendTextColor = isDark ? '#FFF5F9' : '#3A3347';
  const tickTextColor = isDark ? '#F5D0E3' : '#6E657F';
  const gridLineColor = isDark ? 'rgba(236, 72, 153, 0.16)' : 'rgba(111, 66, 193, 0.08)';

  if (trajectoryChartInstance) {
    trajectoryChartInstance.data.labels = labels;
    trajectoryChartInstance.data.datasets = datasets;
    if (trajectoryChartInstance.options?.plugins?.legend?.labels) {
      trajectoryChartInstance.options.plugins.legend.labels.color = legendTextColor;
    }
    if (trajectoryChartInstance.options?.scales?.y) {
      trajectoryChartInstance.options.scales.y.ticks.color = tickTextColor;
      trajectoryChartInstance.options.scales.y.grid.color = gridLineColor;
    }
    if (trajectoryChartInstance.options?.scales?.x) {
      trajectoryChartInstance.options.scales.x.ticks.color = tickTextColor;
    }
    trajectoryChartInstance.update();
    return;
  }

  trajectoryChartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: legendTextColor,
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '600' }
          }
        },
        datalabels: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => ` ${context.dataset.label}: ${formatBRL(context.parsed.y)}`
          }
        }
      },
      scales: {
        y: {
          ticks: {
            color: tickTextColor,
            callback: (val) => formatBRL(val),
            font: { size: 10 }
          },
          grid: { color: gridLineColor }
        },
        x: {
          ticks: {
            color: tickTextColor,
            font: { size: 10 }
          },
          grid: { display: false }
        }
      }
    }
  });
}



function renderPivotTable(saidas, totalSaidas, cartoes) {
  const tbodyDinamica = document.getElementById('tbodyDinamica');
  const barsContainer = document.getElementById('categoryBars');
  tbodyDinamica.innerHTML = '';
  barsContainer.innerHTML = '';

  const baseCategories = ['compras', 'contas', 'fatura', 'parcelado', 'uber'];
  const groups = {};
  baseCategories.forEach(c => { groups[c] = 0; });

  // 1. Saídas da planilha do mês (inclui a linha "fatura" = faturas pagas neste mês, referentes aos gastos do cartão no mês anterior)
  saidas.forEach((s) => {
    const key = (s.titulo || 'outros').toLowerCase().trim();
    groups[key] = (groups[key] || 0) + (Number(s.valor) || 0);
  });

  // 2. Compras feitas no cartão de crédito neste mês (Mercado Pago + Nubank), sem os gastos de outras pessoas (Marcos, etc.)
  ['mercadopago', 'nubank'].forEach((cardKey) => {
    const items = cartoes && cartoes[cardKey] && Array.isArray(cartoes[cardKey].items) ? cartoes[cardKey].items : [];
    items.forEach((item) => {
      if (getItemDebtor(item)) return;
      const key = (item.titulo || 'outros').toLowerCase().trim();
      groups[key] = (groups[key] || 0) + (Number(item.valor) || 0);
    });
  });

  // Total geral da tabela dinâmica = soma das categorias acima
  totalSaidas = Object.values(groups).reduce((a, b) => a + b, 0);

  Object.keys(groups).sort().forEach((cat) => {
    const val = groups[cat];
    const pct = totalSaidas > 0 ? (val / totalSaidas) * 100 : 0;

    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.title = `Clique para filtrar os gastos por "${cat}"`;
    if (appState.filterCategoria === cat) {
      tr.style.background = 'rgba(111, 66, 193, 0.12)';
      tr.style.fontWeight = 'bold';
    }
    tr.onclick = () => {
      if (appState.filterCategoria === cat) {
        window.setSpreadsheetCategoryFilter('all');
      } else {
        window.setSpreadsheetCategoryFilter(cat);
      }
    };
    tr.innerHTML = `
      <td><span class="cat-tag ${getCategoryClass(cat)}">${escapeHtml(cat)}</span></td>
      <td class="text-right"><strong>${formatBRL(val)}</strong></td>
      <td class="text-right">${pct.toFixed(1).replace('.', ',')}%</td>
    `;
    tbodyDinamica.appendChild(tr);

    const barDiv = document.createElement('div');
    barDiv.className = 'cat-bar-item';
    barDiv.style.cursor = 'pointer';
    barDiv.title = `Clique para filtrar por "${cat}"`;
    barDiv.onclick = () => {
      if (appState.filterCategoria === cat) {
        window.setSpreadsheetCategoryFilter('all');
      } else {
        window.setSpreadsheetCategoryFilter(cat);
      }
    };
    barDiv.innerHTML = `
      <div class="cat-bar-head">
        <span>${escapeHtml(cat)}</span>
        <span>${formatBRL(val)} (${pct.toFixed(1).replace('.', ',')}%)</span>
      </div>
      <div class="cat-bar-track">
        <div class="cat-bar-fill" style="width: ${Math.min(100, pct)}%; background: ${getCategoryColorHex(cat)};"></div>
      </div>
    `;
    barsContainer.appendChild(barDiv);
  });

  document.getElementById('totalDinamicaFooter').textContent = formatBRL(totalSaidas);
}

// Controle de Reposição: false = mostra só 3 meses; true = mostra todos
var replenishShowAll = false;

window.toggleReplenishView = function() {
  replenishShowAll = !replenishShowAll;
  renderAll();
};

function renderInvestmentsChart(investimentos, totalInvestimentos) {
  const el = document.getElementById('investmentsPieChart');
  if (!el) return;
  const ctx = el.getContext('2d');
  const labels = investimentos.map(i => i.nome);
  const values = investimentos.map(i => i.valor);

  const colors = ['#DDA0F8', '#8E54D1', '#D4A338', '#FFCA4B', '#FFF185', '#A8E6CF', '#FFAAA5'];

  if (pieChartInstance) {
    pieChartInstance.data.labels = labels;
    pieChartInstance.data.datasets[0].data = values;
    pieChartInstance.update();
    return;
  }

  pieChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: '#FFFFFF',
        borderWidth: 2.5,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '600' }, color: '#3A3347', usePointStyle: true, padding: 10 }
        },
        datalabels: {
          color: '#2E1F47',
          font: { family: "'Plus Jakarta Sans', sans-serif", weight: '700', size: 10 },
          formatter: (value, ctx) => {
            const sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
            const pct = sum > 0 ? (value / sum) * 100 : 0;
            if (pct < 8) return `${pct.toFixed(1).replace('.', ',')}%`;
            return `${formatBRL(value)}\n(${pct.toFixed(1).replace('.', ',')}%)`;
          }
        }
      }
    }
  });
}




function renderInvestimentosPieChart(investimentos) {
  const canvas = document.getElementById('tabInvestmentsPieChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const rawInvestments = (investimentos && investimentos.length > 0)
    ? investimentos
    : (appState.dailyInvestments || []);

  // Ordena do maior valor / maior porcentagem primeiro para o menor
  const validInvestments = [...rawInvestments].sort((a, b) => (Number(b.valor) || 0) - (Number(a.valor) || 0));

  const labels = validInvestments.map(i => i.nome || i.instituicao);
  const values = validInvestments.map(i => Number(i.valor) || 0);

  // Paleta harmoniosa em tons pastel marcantes para os bancos
  const paletteMap = {
    'nubank 120': '#A855F7',
    'nubank 130': '#C084FC',
    'mercado livre': '#FBBF24',
    'mercado pago': '#10B981',
    'xp': '#3B82F6'
  };

  const defaultColors = ['#A855F7', '#C084FC', '#FBBF24', '#10B981', '#3B82F6', '#EC4899', '#F97316'];
  const backgroundColors = labels.map((name, idx) => {
    const key = (name || '').toLowerCase().trim();
    return paletteMap[key] || defaultColors[idx % defaultColors.length];
  });

  const isDark = document.body.classList.contains('dark-theme');
  const legendColor = isDark ? '#FFFFFF' : '#3A3347';
  const dlColor = isDark ? '#FFFFFF' : '#2E1F47';
  const dlBg = isDark ? 'rgba(20, 13, 18, 0.92)' : 'rgba(255, 255, 255, 0.85)';
  const dlBorderColor = isDark ? 'rgba(236, 72, 153, 0.65)' : 'transparent';
  const dlBorderWidth = isDark ? 1 : 0;
  const dlDisplay = isDark ? 'auto' : true;
  const sliceBorderColor = isDark ? '#181116' : '#FFFFFF';

  if (tabInvestmentsPieChartInstance) {
    tabInvestmentsPieChartInstance.data.labels = labels;
    tabInvestmentsPieChartInstance.data.datasets[0].data = values;
    tabInvestmentsPieChartInstance.data.datasets[0].backgroundColor = backgroundColors;
    tabInvestmentsPieChartInstance.data.datasets[0].borderColor = sliceBorderColor;
    if (tabInvestmentsPieChartInstance.options?.plugins?.legend?.labels) {
      tabInvestmentsPieChartInstance.options.plugins.legend.labels.color = legendColor;
    }
    if (tabInvestmentsPieChartInstance.options?.plugins?.datalabels) {
      tabInvestmentsPieChartInstance.options.plugins.datalabels.color = dlColor;
      tabInvestmentsPieChartInstance.options.plugins.datalabels.backgroundColor = dlBg;
      tabInvestmentsPieChartInstance.options.plugins.datalabels.borderColor = dlBorderColor;
      tabInvestmentsPieChartInstance.options.plugins.datalabels.borderWidth = dlBorderWidth;
      tabInvestmentsPieChartInstance.options.plugins.datalabels.display = dlDisplay;
    }
    tabInvestmentsPieChartInstance.update();
    return;
  }

  tabInvestmentsPieChartInstance = new Chart(ctx, {
    type: 'pie',
    plugins: typeof ChartDataLabels !== 'undefined' ? [ChartDataLabels] : [],
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: backgroundColors,
        borderColor: sliceBorderColor,
        borderWidth: 3,
        hoverBorderColor: '#FFFFFF',
        hoverBorderWidth: 4,
        hoverOffset: 26 // Efeito de ir pra frente ao passar o mouse!
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 850,
        easing: 'easeOutQuart'
      },
      layout: {
        padding: 16
      },
      plugins: {
        // Legenda na parte inferior: exibe os nomes dos bancos + porcentagem e as cores correspondentes
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 14,
            boxWidth: 8,
            boxHeight: 8,
            color: legendColor,
            font: {
              family: "'Plus Jakarta Sans', sans-serif",
              size: 11,
              weight: '700'
            },
            generateLabels: function(chart) {
              const darkNow = document.body.classList.contains('dark-theme');
              const data = chart.data;
              if (data.labels.length && data.datasets.length) {
                const dataArr = data.datasets[0].data;
                const sum = dataArr.reduce((a, b) => a + (Number(b) || 0), 0);
                return data.labels.map((label, i) => {
                  const bg = data.datasets[0].backgroundColor[i];
                  const val = Number(dataArr[i]) || 0;
                  const pct = sum > 0 ? ((val / sum) * 100).toFixed(1).replace('.', ',') : '0,0';
                  return {
                    text: `${label} (${pct}%)`,
                    fillStyle: bg,
                    strokeStyle: bg,
                    fontColor: darkNow ? '#FFFFFF' : '#3A3347',
                    lineWidth: 0,
                    hidden: isNaN(dataArr[i]) || chart.getDatasetMeta(0).data[i].hidden,
                    index: i
                  };
                });
              }
              return [];
            }
          }
        },
        // Na fatia: SOMENTE A PORCENTAGEM APARENTE
        datalabels: {
          display: dlDisplay,
          color: dlColor,
          backgroundColor: dlBg,
          borderColor: dlBorderColor,
          borderWidth: dlBorderWidth,
          borderRadius: 6,
          padding: { top: 3, bottom: 3, left: 6, right: 6 },
          font: {
            family: "'Plus Jakarta Sans', sans-serif",
            weight: '800',
            size: 11
          },
          formatter: (value, context) => {
            const dataArr = context.chart.data.datasets[0].data;
            const sum = dataArr.reduce((a, b) => a + (Number(b) || 0), 0);
            if (!sum || sum === 0) return '';
            const pct = (value / sum) * 100;
            if (pct < 2.5) return '';
            return pct.toFixed(1).replace('.', ',') + '%';
          }
        },
        // Ao passar o mouse: Abre todas as informaÃ§Ãµes detalhadas (Nome do Banco, Saldo e Porcentagem)
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(46, 31, 71, 0.94)',
          titleColor: '#FFFFFF',
          titleFont: {
            family: "'Plus Jakarta Sans', sans-serif",
            size: 13,
            weight: '700'
          },
          bodyColor: '#F3E8FF',
          bodyFont: {
            family: "'Plus Jakarta Sans', sans-serif",
            size: 12,
            weight: '500'
          },
          padding: 12,
          cornerRadius: 10,
          boxPadding: 4,
          displayColors: true,
          callbacks: {
            title: function(tooltipItems) {
              return tooltipItems[0].label;
            },
            label: function(context) {
              const val = Number(context.raw) || 0;
              const dataArr = context.chart.data.datasets[0].data;
              const sum = dataArr.reduce((a, b) => a + (Number(b) || 0), 0);
              const pct = sum > 0 ? ((val / sum) * 100).toFixed(1).replace('.', ',') : '0,0';
              return [
                "Valor: " + formatBRL(val),
                "Porcentagem: " + pct + "% do total investido"
              ];
            }
          }
        }
      }
    }
  });
}

function updateFilterDropdown(saidas) {
  const select = document.getElementById('filterCategoria');
  const currentVal = appState.filterCategoria;
  const cats = new Set(['uber', 'fatura', 'contas', 'parcelado', 'compras']);
  saidas.forEach(s => {
    if (s.titulo) cats.add(s.titulo.toLowerCase().trim());
  });

  select.innerHTML = `<option value="all">Todas categorias</option>`;
  Array.from(cats).sort().forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    if (c === currentVal) opt.selected = true;
    select.appendChild(opt);
  });
}



// ==========================================
// EDIÇÃO INLINE, ADIÇÃO E EXCLUSÃO
// ==========================================
window.deleteItem = function(listName, id) {
  const monthObj = getMonthData();
  const target = monthObj[listName].find(item => item.id === id);
  if (!target) return;

  if (listName === 'saidas') {
    const parsed = parseInstallmentRef(target.referencia);
    if (parsed) {
      const removeAll = confirm(`"${target.referencia}" é uma compra parcelada interligada. Deseja remover de todos os meses?`);
      if (removeAll) {
        removeLinkedInstallments(parsed.baseName, parsed.totalParcels);
        saveToStorage();
        renderAll();
        return;
      }
    }
  }

  monthObj[listName] = monthObj[listName].filter(item => item.id !== id);
  saveToStorage();
  renderAll();
};

window.editInline = function(listName, id, field) {
  const monthObj = getMonthData();
  const item = monthObj[listName].find(i => i.id === id);
  if (!item) return;

  const oldName = item.nome;
  const input = prompt(`Editar ${field}:`, item[field]);
  if (input === null) return;

  if (field === 'valor') {
    const parsed = parseFloat(input.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
    if (!isNaN(parsed) && parsed >= 0) {
      item.valor = parsed;
      if (listName === 'investimentos') {
        const dInv = appState.dailyInvestments.find(d => d.id === id || (d.nome || '').toLowerCase() === (item.nome || '').toLowerCase());
        if (dInv) {
          const delta = Number((parsed - Number(dInv.valor || 0)).toFixed(2));
          dInv.valorAnterior = Number(Math.max(0, (dInv.valorAnterior ?? dInv.valor) + delta).toFixed(2));
          dInv.valor = parsed;
        }
      }
    }
  } else {
    const newValStr = input.trim() || item[field];
    item[field] = newValStr;
    if (listName === 'investimentos' && field === 'nome' && oldName && newValStr !== oldName) {
      appState.dailyInvestments.forEach(d => {
        if (d.id === id || (d.nome || '').toLowerCase() === oldName.toLowerCase()) {
          d.nome = newValStr;
        }
      });
      (appState.yieldHistory || []).forEach(h => {
        if ((h.nome || '').toLowerCase() === oldName.toLowerCase()) {
          h.nome = newValStr;
        }
      });
    }
  }

  if (listName === 'saidas') {
    const parsedP = parseInstallmentRef(item.referencia);
    if (parsedP) {
      item.titulo = 'parcelado';
      propagateInstallmentsFrom(appState.currentMonth, item);
    }
  }

  saveToStorage();
  renderAll(id);
};

// ====================================================
// IA FINANCEIRA ("LUNA") — CONTROLE TOTAL DA PLANILHA
// ====================================================
function addChatBubble(sender, htmlContent, actionBadge = null, skipPersist = false) {
  const feed = document.getElementById('aiChatFeed');
  if (!feed) return;
  const div = document.createElement('div');
  div.className = `chat-bubble ${sender === 'ai' ? 'bubble-ai' : 'bubble-user'}`;

  let inner = '';
  if (actionBadge) {
    inner += `<div class="bubble-action-badge">✓ ${escapeHtml(actionBadge)}</div><br>`;
  }
  inner += htmlContent;
  div.innerHTML = window.MagicCloud.safeMarkup(inner);

  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;

  if (!skipPersist) {
    appState.chatHistoryLog.push({
      sender,
      htmlContent,
      actionBadge,
      timestamp: new Date().toISOString()
    });
    saveToStorage();
  }
}

function addDefaultWelcomeBubble() {
  addChatBubble(
    'ai',
    `Oiii migaaa!! Sou a <strong>Sailor</strong>, sua melhor amiga e fada sensata das finanças! 💖💅<br><br>
    Já deixei tudo no esquema pra gente arrasar:<br>
    • 📈 <strong>Aba "Investimentos & Rendimentos":</strong> Pra você atualizar todo dia e ver seu dindim brilhando por dia, semana e mês!<br>
    • 💳 <strong>Aba "Cartões (MP & Nubank)":</strong> Separei tudinho que é seu e os <strong>R$ 0,00 do Marcos</strong> (que já entram automático em Novembro!).<br><br>
    Pode falar comigo por áudio ou texto como se estivesse mandando áudio no WhatsApp, viu miga? Me conta: como tá seu dia hoje? ✨`,
    'Sua Miga Financeira 💖'
  );
}

function renderSavedChatHistory() {
  const feed = document.getElementById('aiChatFeed');
  if (!feed) return;
  feed.innerHTML = '';
  appState.chatHistoryLog.forEach(entry => addChatBubble(entry.sender, entry.htmlContent, entry.actionBadge, true));
  if (!appState.chatHistoryLog.length) addChatBubble('ai', 'Oiii! Sou a <strong>Sailor</strong>. Posso ajudar com seus lançamentos, cartões e investimentos. ✨', 'Sua assistente', true);
}

let currentAudioPlayer = null;
let currentSpeechQueueId = 0;

/**
 * Transforma texto com formatação de planilha (R$ 0,00, emojis, frações 1/5, símbolos)
 * em português falado natural, fluido e sem pausas robóticas!
 */
function formatTextForNaturalSpeech(rawText) {
  let text = String(rawText || '')
    // Troca quebras de linha HTML por pontuação fluida
    .replace(/<br\s*\/?>/gi, '. ')
    // Remove todas as tags HTML
    .replace(/<[^>]*>?/gm, ' ')
    // Remove emojis e símbolos gráficos que travam a leitura
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}•➔→🔗📈💳⚠️🚨🟢🔻✨🌸🎉💡🏆🟨🟪🎙️]/gu, ' ')
    // Converte valores monetários R$ 0,00 -> "1351 reais e 35 centavos" (ou "566 reais" se ,00)
    .replace(/([+-]?)\s*R\$\s*(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})/gi, (_, sign, intPart, centsPart) => {
      const cleanInt = intPart.replace(/\./g, '');
      const cents = parseInt(centsPart, 10);
      const prefix = sign === '-' ? 'menos ' : '';
      if (cents === 0) {
        return `${prefix}${cleanInt} reais`;
      }
      return `${prefix}${cleanInt} reais e ${cents} centavos`;
    })
    // Converte porcentagens 41,8% -> "41 vírgula 8 por cento" (ou 100% -> "100 por cento")
    .replace(/(\d+),0%/g, '$1 por cento')
    .replace(/(\d+),(\d+)%/g, '$1 vírgula $2 por cento')
    // Converte frações de parcelas 1/5 -> "1 de 5"
    .replace(/\b(\d{1,2})\/(\d{1,2})\b/g, '$1 de $2')
    // Remove parênteses longos explicativos para manter a fala direta e conversacional
    .replace(/\([^)]{18,}\)/g, '')
    // Limpa múltiplos espaços e pontos repetidos
    .replace(/\s+/g, ' ')
    .replace(/\.\s*\./g, '.')
    .trim();

  return text;
}

function stopCurrentSpeech() {
  currentSpeechQueueId++;
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  if (currentAudioPlayer) {
    try {
      currentAudioPlayer.pause();
      currentAudioPlayer.src = '';
    } catch (e) {}
    currentAudioPlayer = null;
  }
}

/**
 * Seleciona SEMPRE uma voz feminina em português (excluindo vozes masculinas como Antonio, Daniel, Humberto, etc.)
 */
function getBestFemalePortugueseVoice() {
  if (!('speechSynthesis' in window)) return { voice: null, isNaturalNeural: false };
  const voices = window.speechSynthesis.getVoices() || [];
  if (voices.length === 0) return { voice: null, isNaturalNeural: false };

  const maleVoiceRegex = /\b(antonio|antônio|daniel|humberto|julio|júlio|nicolau|valerio|valério|fabio|fábio|carlos|ricardo|duarte|male|masculin[oa])\b/i;
  const femaleNamesRegex = /\b(francisca|thalita|maria|luciana|leticia|letícia|leila|brenda|giovanna|manuela|yara|camila|vitoria|vitória|hel[oó]isa|fernanda|raquel|female|feminin[oa]|google\s+portugu[eê]s)\b/i;

  const ptVoices = voices.filter(v => /^pt/i.test(v.lang || '') && !maleVoiceRegex.test(v.name || ''));

  // 1. Prioridade máxima: Vozes Neurais Naturais explicitamente femininas (ex: Microsoft Francisca / Thalita Online Natural)
  const naturalFemale = ptVoices.find(v =>
    /francisca|thalita|leila|brenda|giovanna|manuela|yara/i.test(v.name || '') ||
    (v.name.includes('Natural') && femaleNamesRegex.test(v.name || ''))
  );
  if (naturalFemale) {
    return { voice: naturalFemale, isNaturalNeural: true };
  }

  // 2. Vozes femininas conhecidas em pt-BR (Google português do Brasil, Microsoft Maria, Luciana, etc.)
  const knownFemale = ptVoices.find(v => femaleNamesRegex.test(v.name || ''));
  if (knownFemale) {
    return { voice: knownFemale, isNaturalNeural: false };
  }

  // 3. Qualquer voz em português que não seja masculina
  if (ptVoices.length > 0) {
    return { voice: ptVoices[0], isNaturalNeural: false };
  }

  return { voice: null, isNaturalNeural: false };
}

if ('speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }
}

/**
 * Reproduz a voz FEMININA da Sailor com máxima naturalidade e fluidez:
 * 1. Se o navegador tiver uma voz Neural Online Feminina real (Microsoft Francisca/Thalita Natural), usa com ritmo dinâmico.
 * 2. Caso contrário, usa o streaming Neural Cloud Feminino (/api/tts) com pré-carregamento paralelo entre frases.
 * 3. No fallback offline, força a seleção de voz feminina (Maria/Google pt-BR) e nunca usa vozes masculinas (Antonio/Daniel).
 */
async function speakText(rawText) {
  if (appState.voiceMuted || !('speechSynthesis' in window)) return;
  stopCurrentSpeech();
  const text = formatTextForNaturalSpeech(rawText);
  if (!text) return;
  const utterance = new SpeechSynthesisUtterance(text);
  const { voice } = getBestFemalePortugueseVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || 'pt-BR';
  utterance.rate = parseFloat(document.getElementById('voiceSpeedSelect')?.value) || 1.28;
  utterance.pitch = 1.08;
  window.speechSynthesis.speak(utterance);
}

function findMatchingItem(monthObj, searchStr) {
  const cleanSearch = searchStr.toLowerCase().trim();
  if (!cleanSearch) return null;

  for (const s of (monthObj.saidas || [])) {
    const refLow = (s.referencia || '').toLowerCase();
    const titLow = (s.titulo || '').toLowerCase();
    const baseRef = refLow.replace(/\s+\d+\/\d+$/, '').trim();
    if (refLow === cleanSearch || baseRef === cleanSearch || refLow.includes(cleanSearch) || titLow === cleanSearch || cleanSearch.includes(baseRef && baseRef.length > 2 ? baseRef : '___')) {
      return { listName: 'saidas', item: s };
    }
  }
  if (monthObj.cartoes) {
    for (const cKey of ['mercadopago', 'nubank']) {
      const card = monthObj.cartoes[cKey];
      if (card && Array.isArray(card.items)) {
        for (const item of card.items) {
          const refLow = (item.referencia || '').toLowerCase();
          const titLow = (item.titulo || '').toLowerCase();
          if (refLow === cleanSearch || refLow.includes(cleanSearch) || titLow === cleanSearch) {
            return { listName: 'cartao_' + cKey, item: item, cardKey: cKey };
          }
        }
      }
    }
  }
  for (const e of (monthObj.entradas || [])) {
    const refLow = (e.referencia || '').toLowerCase();
    if (refLow === cleanSearch || refLow.includes(cleanSearch) || cleanSearch.includes(refLow)) {
      return { listName: 'entradas', item: e };
    }
  }
  for (const i of (monthObj.investimentos || [])) {
    const nomeLow = (i.nome || '').toLowerCase();
    if (nomeLow === cleanSearch || nomeLow.includes(cleanSearch) || cleanSearch.includes(nomeLow)) {
      return { listName: 'investimentos', item: i };
    }
  }
  return null;
}


// ============================================================================
// MOTOR AGÊNTICO DA SAILOR IA — INTERPRETAÇÃO INTELIGENTE + TOOL EXECUTION
// ============================================================================
const MONTHS_2026_KEYS = ['OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
const MONTHS_2027_KEYS = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO 2027', 'NOVEMBRO 2027', 'DEZEMBRO 2027'
];

function normalizeMonthKeywordToKey(rawWord, yearHint = null) {
  const w = String(rawWord || '').toLowerCase().trim()
    .replace('marco', 'março')
    .replace(/\s+/g, ' ');
  if (!w) return null;
  if (w.includes('outubro') && (w.includes('2027') || yearHint === '2027')) return 'OUTUBRO 2027';
  if (w.includes('novembro') && (w.includes('2027') || yearHint === '2027')) return 'NOVEMBRO 2027';
  if (w.includes('dezembro') && (w.includes('2027') || yearHint === '2027')) return 'DEZEMBRO 2027';
  if (w.includes('outubro')) return 'OUTUBRO';
  if (w.includes('novembro')) return 'NOVEMBRO';
  if (w.includes('dezembro')) return 'DEZEMBRO';
  if (w.includes('janeiro')) return 'JANEIRO';
  if (w.includes('fevereiro')) return 'FEVEREIRO';
  if (w.includes('março')) return 'MARÇO';
  if (w.includes('abril')) return 'ABRIL';
  if (w.includes('maio')) return 'MAIO';
  if (w.includes('junho')) return 'JUNHO';
  if (w.includes('julho')) return 'JULHO';
  if (w.includes('agosto')) return 'AGOSTO';
  if (w.includes('setembro')) return 'SETEMBRO';
  return null;
}

/**
 * Identifica com precisão todos os meses ou períodos mencionados na frase:
 * - "todas as entradas de 2027", "todos os meses de 2027", "em 2027", "ano que vem" -> todos os 12 meses de 2027
 * - "todas as entradas de 2026", "todos os meses de 2026", "em 2026" -> todos os 3 meses de 2026
 * - "todos os meses", "todas as entradas", "na planilha toda" -> todos os 15 meses
 * - "de janeiro até junho", "de abril a agosto" -> intervalo de meses
 * - "em abril", "em maio e junho", "outubro de 2027" -> meses específicos mencionados
 */
function resolveTargetMonthsFromText(rawText) {
  const low = String(rawText || '').toLowerCase();

  // 1. Intervalo explícito: "de <mês A> (de 202X) a/até <mês B> (de 202X)"
  const rangeRegex = /\bde\s+(outubro(?:\s+(?:de\s+)?202[67])?|novembro(?:\s+(?:de\s+)?202[67])?|dezembro(?:\s+(?:de\s+)?202[67])?|janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro)\s+(?:at[eé]|a)\s+(outubro(?:\s+(?:de\s+)?202[67])?|novembro(?:\s+(?:de\s+)?202[67])?|dezembro(?:\s+(?:de\s+)?202[67])?|janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro)(?:\s+(?:de\s+)?(202[67]))?\b/i;
  const rangeMatch = low.match(rangeRegex);
  if (rangeMatch) {
    const endYearHint = rangeMatch[3] || (low.includes('2027') ? '2027' : null);
    const startKey = normalizeMonthKeywordToKey(rangeMatch[1], null);
    const endKey = normalizeMonthKeywordToKey(rangeMatch[2], endYearHint);
    const sIdx = MONTH_ORDER.indexOf(startKey);
    const eIdx = MONTH_ORDER.indexOf(endKey);
    if (sIdx !== -1 && eIdx !== -1 && eIdx >= sIdx) {
      return { months: MONTH_ORDER.slice(sIdx, eIdx + 1), explicit: true, isMulti: eIdx > sIdx, label: `${getMonthLabel(startKey)} até ${getMonthLabel(endKey)}` };
    }
  }

  // 2. Verifica meses nomeados individualmente na frase
  const explicitMonths = [];
  const monthScanRegex = /\b(outubro\s+(?:de\s+)?2027|novembro\s+(?:de\s+)?2027|dezembro\s+(?:de\s+)?2027|outubro(?:\s+(?:de\s+)?2026)?|novembro(?:\s+(?:de\s+)?2026)?|dezembro(?:\s+(?:de\s+)?2026)?|janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro)\b/gi;
  let mMatch;
  const globalYearHint = /\b2027\b/.test(low) ? '2027' : null;
  while ((mMatch = monthScanRegex.exec(low)) !== null) {
    const mKey = normalizeMonthKeywordToKey(mMatch[1], globalYearHint);
    if (mKey && !explicitMonths.includes(mKey)) {
      explicitMonths.push(mKey);
    }
  }

  if (explicitMonths.length > 0) {
    const lbl = explicitMonths.length === 1
      ? getMonthLabel(explicitMonths[0])
      : explicitMonths.map(k => getMonthLabel(k)).join(', ');
    return { months: explicitMonths, explicit: true, isMulti: explicitMonths.length > 1, label: lbl };
  }

  // 3. Semestres ou anos inteiros ("todas as entradas de 2027", "todos os meses de 2027", "em 2027")
  if (/(primeiro\s+semestre|1[ºo°]\s+semestre)/.test(low)) {
    const sem1 = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO'];
    return { months: sem1, explicit: true, isMulti: true, label: '1º Semestre de 2027 (Janeiro a Junho)' };
  }
  if (/(segundo\s+semestre|2[ºo°]\s+semestre)/.test(low)) {
    const sem2 = ['JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO 2027', 'NOVEMBRO 2027', 'DEZEMBRO 2027'];
    return { months: sem2, explicit: true, isMulti: true, label: '2º Semestre de 2027 (Julho a Dezembro)' };
  }
  if (/\b2027\b|ano\s+que\s+vem|pr[oó]ximo\s+ano/.test(low)) {
    return { months: [...MONTHS_2027_KEYS], explicit: true, isMulti: true, label: ' todos os 12 meses de 2027 (Janeiro a Dezembro 2027)' };
  }
  if (/\b2026\b/.test(low)) {
    return { months: [...MONTHS_2026_KEYS], explicit: true, isMulti: true, label: 'todos os meses de 2026 (Outubro a Dezembro 2026)' };
  }
  if (/(todos\s+os\s+meses|todas\s+as\s+planilhas|na\s+planilha\s+toda|em\s+todas\s+as\s+entrad[aeo]s|em\s+todas\s+as\s+sa[ií]das|em\s+todos\s+os\s+gastos)/.test(low)) {
    return { months: [...MONTH_ORDER], explicit: true, isMulti: true, label: 'todos os meses da planilha (Outubro 2026 a Dezembro 2027)' };
  }
  if (/(m[eê]s\s+que\s+vem|pr[oó]ximo\s+m[eê]s|proximo\s+mes)/.test(low)) {
    const nextM = getNextMonthName(appState.currentMonth) || appState.currentMonth;
    return { months: [nextM], explicit: true, isMulti: false, label: getMonthLabel(nextM) };
  }
  if (/(m[eê]s\s+passado|m[eê]s\s+anterior|mes\s+passado)/.test(low)) {
    const idx = MONTH_ORDER.indexOf(appState.currentMonth);
    const prevM = idx > 0 ? MONTH_ORDER[idx - 1] : appState.currentMonth;
    return { months: [prevM], explicit: true, isMulti: false, label: getMonthLabel(prevM) };
  }

  return { months: [appState.currentMonth], explicit: false, isMulti: false, label: getMonthLabel(appState.currentMonth) };
}

/**
 * Normaliza números falados por voz (Web Speech API) em português:
 * Ex: "32 e 27" -> "32,27", "15 e r$ 26" -> "15,26",
 *     "dia 27 e 13 também de Uber" -> "27,13 também de Uber",
 *     "Clube iFood 795" -> "Clube iFood 7,95"
 */
function preprocessSpokenFinancialText(rawText) {
  let s = String(rawText || '');

  // Caso o ditado por voz transcreva "27 e 13 também de Uber" como "dia 27 e 13 também de Uber"
  s = s.replace(/\bdia\s+(\d{1,3})\s+e\s+(?:r\$\s*)?(\d{2})\b/gi, '$1,$2');

  // "15 e r$ 26", "32 e 27", "15 reais e 26 centavos" -> "15,26", "32,27"
  s = s.replace(/\b(\d{1,4})\s*(?:reais\s+)?e\s*(?:r\$\s*)?(\d{2})\b(?!\s*(?:de\s+(?:janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)|horas|dias|meses|vezes|parcelas))/gi, '$1,$2');

  // "Clube iFood 795" -> "Clube iFood 7,95" (quando o ditado omite a vírgula em centavos de assinatura)
  s = s.replace(/\b(clube\s+ifood|ifood|uber|assinatura|spotify|netflix|meli|apple)\s+([1-9])(95|90|99|50)\b/gi, '$1 $2,$3');

  return s;
}

/**
 * Extrai valores monetários com segurança, sem confundir o ano (2026/2027), o dia (dia 15),
 * frações de parcela (1/6) ou o nome "nubank 120 / 130" com o valor em reais!
 */
function extractSafeMonetaryValues(rawText) {
  const normalizedSpeech = preprocessSpokenFinancialText(rawText);
  const cleaned = String(normalizedSpeech || '')
    .toLowerCase()
    .replace(/\bnubank\s*120\b/g, ' nubank_cento_vinte ')
    .replace(/\bnubank\s*130\b/g, ' nubank_cento_trinta ')
    .replace(/\b99\b/g, ' app_noventa_nove ')
    .replace(/\b\d{1,2}\s*\/\s*\d{1,2}\b/g, ' ')
    .replace(/\bdia\s+\d{1,2}\b/g, ' ')
    .replace(/(?:parcelado\s+em|em)\s+\d{1,2}\s*(?:vezes|x|parcelas)\b/g, ' ')
    .replace(/\b202[4-9]\b/g, ' ')
    .replace(/\b203[0-9]\b/g, ' ');

  const results = [];
  const numRegex = /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:[.,](\d{1,2}))?\s*(?:reais|real|conto|pilas|centavos)?/gi;
  let m;
  while ((m = numRegex.exec(cleaned)) !== null) {
    const intPart = m[1].replace(/\./g, '');
    const decPart = m[2] ? '.' + m[2] : '';
    const val = parseFloat(intPart + decPart);
    if (!isNaN(val) && val >= 0) {
      results.push(val);
    }
  }
  return results;
}

/**
 * Extrai apenas o nome limpo do item (ex: "freela", "salário", "academia", "internet"),
 * removendo todos os verbos de comando, meses, anos (2026/2027), "em todas as entradas", "o valor de", etc.
 */
function extractCleanReferenceName(rawText, defaultFallback = 'entrada') {
  const raw = preprocessSpokenFinancialText(String(rawText || '').trim());

  // 0. Se o usuário disse explicitamente "sem referência" / "não tem referência"
  if (/\b(?:n[aã]o\s+tem\s+refer[eê]ncia|sem\s+refer[eê]ncia|sem\s+ref)\b/i.test(raw)) {
    return '-';
  }

  // 0.1 Se o usuário disse "a referência é X" ou "referência é X" ou "referência X"
  const explicitRefMatch = raw.match(/\b(?:a\s+)?refer[eê]ncia\s+(?:[eé]\s+)?([a-záéíóúâêôãõç0-9\s]{2,35}?)(?=\s+(?:no\s+valor|de\s+r\$|r\$|\d+(?:[.,]\d+)?|e\s+dia|e\s+tamb[eé]m|tamb[eé]m|$))/i);
  if (explicitRefMatch) {
    const cleanExplicit = explicitRefMatch[1].trim().toLowerCase();
    if (cleanExplicit && !/^(?:por\s+enquanto|ainda|n[aã]o|sem)$/.test(cleanExplicit)) {
      return cleanExplicit;
    }
  }

  // 1. Se o usuário colocou entre aspas ou disse "chamado X" / "com nome X"
  const quoted = raw.match(/["“”'']([^"“”'']{2,40})["“”'']/);
  if (quoted) return quoted[1].trim();

  const namedMatch = raw.match(/(?:chamad[oa]|com\s+o\s+nome(?:\s+de)?|nome\s+de)\s+([a-záéíóúâêôãõç0-9\s]{2,35}?)(?=\s+(?:no\s+valor|de\s+r\$|de\s+\d|em\s+|nos?\s+mes|para\s+|$))/i);
  if (namedMatch) return namedMatch[1].trim();

  let str = raw.toLowerCase()
    // Preserva nubank 120 / 130 caso seja investimento
    .replace(/\b\d{1,2}\s*\/\s*\d{1,2}\b/g, ' ')
    .replace(/\bdia\s+\d{1,2}\b/g, ' ')
    .replace(/(?:parcelado\s+em|em)\s+\d{1,2}\s*(?:vezes|x|parcelas)\b/g, ' ')
    // Remove expressões de período e meses
    .replace(/\b(?:outubro|novembro|dezembro|janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro)(?:\s+(?:de\s+)?202[67])?\b/g, ' ')
    .replace(/\b(?:de\s+|em\s+|no\s+ano\s+de\s+|ano\s+de\s+|ano\s+)?202[4-9]\b/g, ' ')
    .replace(/\b(?:todos\s+os\s+meses|todas\s+as\s+planilhas|planilha\s+toda|m[eê]s\s+que\s+vem|pr[oó]ximo\s+m[eê]s|m[eê]s\s+passado|nesse\s+m[eê]s|este\s+m[eê]s|esse\s+m[eê]s|primeiro\s+semestre|segundo\s+semestre|ano\s+que\s+vem)\b/g, ' ')
    // Remove referências à tabela (ex: "em todas as entradas", "todas as entrades", "nas entradas", "nos gastos", "nas compras", "no cartão nubank")
    .replace(/\b(?:em\s+)?(?:todas?\s+as?\s+|todos?\s+os?\s+)?(?:entrad[aeo]s?|entrdas?|sa[ií]das?|gastos?|despesas?|planilhas?|investimentos?|caixinhas?|compras?)\b/g, ' ')
    .replace(/\b(?:no\s+cart[aã]o|na\s+fatura|fatura\s+de\s+cr[eé]dito|no\s+cr[eé]dito|cart[aã]o\s+de\s+cr[eé]dito|cr[eé]dito|fatura|mercado\s+pago|nubank)\b/g, ' ')
    .replace(/\b(?:pro\s+marcos|para\s+o\s+marcos|do\s+marcos)\b/g, ' ')
    .replace(/\b(?:por\s+enquanto|tamb[eé]m|e\s+tamb[eé]m|a\s+refer[eê]ncia\s+[eé]|refer[eê]ncia)\b/g, ' ')
    // Remove expressões de valor monetário
    .replace(/(?:no\s+valor\s+de|o\s+valor\s+de|com\s+o\s+valor\s+de|com\s+valor\s+de|valor\s+de|valor)\s*(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:[.,]\d{1,2})?\s*(?:reais|real|conto|pilas)?/g, ' ')
    .replace(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:[.,]\d{1,2})?\s*(?:reais|real|conto|pilas)?/g, ' ')
    // Remove verbos de comando (conjugados e infinitivos) e vocativos da Sailor
    .replace(/\b(?:oi+|ol[aá]|miga|amiga|mulher|luna|sailor|fada|por\s+favor|pfv|pfvr|pra\s+mim|me\s+ajuda|preciso|quero\s+que\s+voc[eê]|quero\s+que|quero|pode\s+colocar|pode|vou|tem\s+que|coloca|coloque|colocar|adiciona|adicione|adicionar|anota|anote|anotar|lan[cç]a|lance|lan[cç]ar|insere|insira|inserir|registra|registre|registrar|bota|bote|botar|p[oõ]e|ponha|p[oô]r|cria|crie|criar|inclui|inclua|incluir|gastei|paguei|comprei|passei|recebi|ganhei|entrou|depositaram|atualiza|atualize|atualizar|muda|mude|mudar|altera|altere|alterar|edita|edite|editar|corrige|corrija|corrigir|apaga|apague|apagar|remove|remova|remover|exclui|exclua|excluir|tira|tire|tirar|deleta|delete|deletar)\b/g, ' ')
    .replace(/\b(?:novo|nova|novos|novas|valor|reais|real|conto|pilas|r\$|hoje|ontem|agora|l[aá]|aqui)\b/g, ' ')
    .replace(/[?!.,;:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove preposições/artigos soltos no início e no fim repetidamente
  const edgeStopwords = /^(?:de|da|do|das|dos|em|no|na|nos|nas|para|pra|pro|com|por|pelo|pela|o|a|os|as|um|uma|uns|umas|e|ou|que)\s+|\s+(?:de|da|do|das|dos|em|no|na|nos|nas|para|pra|pro|com|por|pelo|pela|o|a|os|as|um|uma|uns|umas|e|ou|que)$/gi;
  for (let i = 0; i < 5; i++) {
    str = str.replace(edgeStopwords, '').trim();
  }

  if (!str || str.length < 2 || /^(?:todas?|todos?|mes|m[eê]s|ano|valor|reais)$/.test(str)) {
    return defaultFallback;
  }
  return str;
}

/**
 * Divide um comando longo (ex: ditado por voz com vários gastos/itens de cartão ou planilha)
 * em múltiplos itens estruturados ({ data, valor, titulo, referencia }).
 */
function parseMultiItemsFromCommand(rawText, isCreditCard = false) {
  const normalized = preprocessSpokenFinancialText(rawText);

  // Divide nos conectores típicos de lista falada: "e também", ";", "e dia X", ou antes de um novo "dia X" após já ter dito um valor
  const parts = normalized
    .replace(/\s+e\s+tamb[eé]m\s+/gi, ' ||| ')
    .replace(/\s*;\s*/g, ' ||| ')
    .replace(/(\d+(?:[.,]\d{1,2})?(?:\s*reais)?)\s+(?:e\s+)?(?=dia\s+\d{1,2}\b)/gi, '$1 ||| ')
    .replace(/(refer[eê]ncia(?:\s+por\s+enquanto)?|uber|ifood|compras|contas)\s+(?:e\s+)?(?=dia\s+\d{1,2}\b)/gi, '$1 ||| ')
    .split('|||')
    .map(p => p.trim())
    .filter(Boolean);

  const items = [];
  let lastDay = String(new Date().getDate());

  parts.forEach(part => {
    const vals = extractSafeMonetaryValues(part);
    if (vals.length === 0) return;

    const dayMatch = part.match(/\bdia\s+(\d{1,2})\b/i);
    if (dayMatch) {
      lastDay = String(Math.min(31, Math.max(1, parseInt(dayMatch[1], 10))));
    }

    const partLow = part.toLowerCase();
    let cat = 'compras';
    if (/\b(uber|99|passagem|ida|volta|corrida|t[aá]xi|transporte)\b/i.test(partLow)) {
      cat = 'uber';
    } else if (/\b(conta|apple|meli|laricel|internet|luz|[aá]gua|energia|faculdade|aluguel|academia)\b/i.test(partLow)) {
      cat = 'contas';
    } else if (/\b(parcela|parcelado|livro|\d+\/\d+)\b/i.test(partLow)) {
      cat = 'parcelado';
    }

    let ref = extractCleanReferenceName(part, cat === 'uber' ? (isCreditCard ? '-' : 'passagem') : 'compra');
    if (cat === 'uber' && /^uber$/i.test(ref)) {
      ref = isCreditCard ? '-' : 'uber';
    }

    // Se o segmento tiver apenas 1 valor, cria 1 item; se tiver múltiplos valores claros, cria 1 para cada
    vals.forEach(v => {
      if (v > 0) {
        items.push({
          data: lastDay,
          valor: v,
          titulo: cat,
          referencia: ref
        });
      }
    });
  });

  return items;
}

/**
 * Resolve uma lista de meses vinda do JSON da IA (ex: ["ALL_2027"], ["JANEIRO", "FEVEREIRO"], etc.)
 */
function resolveActionMonthsList(rawMonths) {
  if (!rawMonths) return [appState.currentMonth];
  const arr = Array.isArray(rawMonths) ? rawMonths : [rawMonths];
  const out = [];
  arr.forEach(item => {
    const s = String(item || '').toUpperCase().trim();
    if (s === 'ALL_2027' || s === '2027') {
      MONTHS_2027_KEYS.forEach(m => { if (!out.includes(m)) out.push(m); });
    } else if (s === 'ALL_2026' || s === '2026') {
      MONTHS_2026_KEYS.forEach(m => { if (!out.includes(m)) out.push(m); });
    } else if (s === 'ALL' || s === 'TODOS') {
      MONTH_ORDER.forEach(m => { if (!out.includes(m)) out.push(m); });
    } else if (MONTH_ORDER.includes(s)) {
      if (!out.includes(s)) out.push(s);
    } else {
      const mapped = normalizeMonthKeywordToKey(s);
      if (mapped && !out.includes(mapped)) out.push(mapped);
    }
  });
  return out.length > 0 ? out : [appState.currentMonth];
}

/**
 * Executor Universal de Ações da Sailor (usado tanto pelo Interpretador Instantâneo quanto pelo JSON Tool-Calling da IA):
 * Executa qualquer criação, edição, exclusão ou filtro em Entradas, Saídas, Cartões e Investimentos em 1 ou vários meses!
 */
window.executeSailorActions = function(actions) {
  if (!Array.isArray(actions) || actions.length === 0) return null;

  let targetView = null;
  let targetMonthToShow = null;
  let spotlightRowIds = [];
  let summaryBadges = [];
  let totalAffectedMonths = new Set();

  actions.forEach((act, idx) => {
    if (!act || !act.type) return;
    const type = String(act.type).toLowerCase().trim();
    const months = resolveActionMonthsList(act.months || act.month);

    if (type === 'navigate') {
      if (act.month) {
        const m = resolveActionMonthsList([act.month])[0];
        if (m) targetMonthToShow = m;
      }
      if (act.view) targetView = act.view;
      if (act.filterCategoria) {
        if (act.view === 'cartoes') window.setCardCategoryFilter(act.filterCategoria);
        else window.setSpreadsheetCategoryFilter(act.filterCategoria);
      }
      if (act.filterDevedor) {
        window.setCardMarcosFilter(act.filterDevedor);
      }
      return;
    }

    if (type === 'add_entrada') {
      const val = Number(act.valor);
      if (isNaN(val) || val <= 0) return;
      const ref = String(act.referencia || 'entrada').trim() || 'entrada';
      months.forEach((mKey, mIdx) => {
        const mObj = appState.data[mKey];
        if (!mObj) return;
        const newId = `e_${Date.now()}_${idx}_${mIdx}`;
        mObj.entradas.push({ id: newId, referencia: ref, valor: Number(val.toFixed(2)) });
        totalAffectedMonths.add(mKey);
        if (!targetMonthToShow) targetMonthToShow = mKey;
        if (mKey === targetMonthToShow) spotlightRowIds.push(newId);
      });
      targetView = 'planilha';
      summaryBadges.push(months.length > 1 ? `Entrada em ${months.length} meses` : `Entrada em ${getMonthLabel(months[0])}`);
    }

    else if (type === 'update_entrada') {
      const val = act.valor !== undefined ? Number(act.valor) : null;
      const targetSearch = String(act.target || act.referencia || '').toLowerCase().trim();
      const targetVal = act.targetValor !== undefined ? Number(act.targetValor) : null;
      months.forEach(mKey => {
        const mObj = appState.data[mKey];
        if (!mObj) return;
        mObj.entradas.forEach(e => {
          const matchByName = targetSearch && (targetSearch === 'all' || targetSearch === 'todas' || e.referencia.toLowerCase().includes(targetSearch) || targetSearch.includes(e.referencia.toLowerCase()));
          const matchByVal = targetVal !== null && !isNaN(targetVal) && Math.abs(Number(e.valor) - targetVal) < 0.01;
          if (matchByName || matchByVal) {
            if (val !== null && !isNaN(val)) e.valor = Number(val.toFixed(2));
            if (act.newReferencia) e.referencia = String(act.newReferencia).trim();
            totalAffectedMonths.add(mKey);
            if (!targetMonthToShow) targetMonthToShow = mKey;
            if (mKey === targetMonthToShow) spotlightRowIds.push(e.id);
          }
        });
      });
      targetView = 'planilha';
      summaryBadges.push('Entrada Atualizada');
    }

    else if (type === 'delete_entrada') {
      const targetSearch = String(act.target || act.referencia || '').toLowerCase().trim();
      const targetVal = act.valor !== undefined ? Number(act.valor) : null;
      months.forEach(mKey => {
        const mObj = appState.data[mKey];
        if (!mObj) return;
        const beforeLen = mObj.entradas.length;
        mObj.entradas = mObj.entradas.filter(e => {
          const matchByName = targetSearch && (e.referencia.toLowerCase().includes(targetSearch) || targetSearch.includes(e.referencia.toLowerCase()));
          const matchByVal = targetVal !== null && !isNaN(targetVal) && Math.abs(Number(e.valor) - targetVal) < 0.01;
          return !(matchByName || matchByVal);
        });
        if (mObj.entradas.length !== beforeLen) {
          totalAffectedMonths.add(mKey);
          if (!targetMonthToShow) targetMonthToShow = mKey;
        }
      });
      targetView = 'planilha';
      summaryBadges.push('Entrada Removida');
    }

    else if (type === 'add_saida') {
      const val = Number(act.valor);
      if (isNaN(val) || val <= 0) return;
      const dayStr = String(act.data || new Date().getDate());
      const cat = String(act.titulo || 'compras').toLowerCase().trim();
      let ref = String(act.referencia || cat).trim();
      const parcelas = act.parcelas ? parseInt(act.parcelas, 10) : 1;

      if (parcelas > 1 && !parseInstallmentRef(ref)) {
        ref = `${ref} 1/${parcelas}`;
      }

      months.forEach((mKey, mIdx) => {
        const mObj = appState.data[mKey];
        if (!mObj) return;
        const newId = `s_${Date.now()}_${idx}_${mIdx}`;
        const parsedP = parseInstallmentRef(ref);
        const finalTitulo = parsedP ? 'parcelado' : cat;
        const newItem = { id: newId, data: dayStr, referencia: ref, titulo: finalTitulo, valor: Number(val.toFixed(2)) };
        mObj.saidas.push(newItem);
        if (parsedP && months.length === 1) {
          propagateInstallmentsFrom(mKey, newItem);
        }
        totalAffectedMonths.add(mKey);
        if (!targetMonthToShow) targetMonthToShow = mKey;
        if (mKey === targetMonthToShow) spotlightRowIds.push(newId);
      });
      targetView = 'planilha';
      summaryBadges.push(months.length > 1 ? `Gasto em ${months.length} meses` : `Gasto em ${getMonthLabel(months[0])}`);
    }

    else if (type === 'update_saida') {
      const val = act.valor !== undefined ? Number(act.valor) : null;
      const targetSearch = String(act.target || act.referencia || '').toLowerCase().trim();
      const targetVal = act.targetValor !== undefined ? Number(act.targetValor) : null;
      months.forEach(mKey => {
        const mObj = appState.data[mKey];
        if (!mObj) return;
        mObj.saidas.forEach(s => {
          const refLow = s.referencia.toLowerCase();
          const baseRef = refLow.replace(/\s+\d+\/\d+$/, '').trim();
          const matchByName = targetSearch && (refLow.includes(targetSearch) || targetSearch.includes(baseRef && baseRef.length > 2 ? baseRef : '___'));
          const matchByVal = targetVal !== null && !isNaN(targetVal) && Math.abs(Number(s.valor) - targetVal) < 0.01;
          if (matchByName || matchByVal) {
            if (val !== null && !isNaN(val)) s.valor = Number(val.toFixed(2));
            if (act.newReferencia) s.referencia = String(act.newReferencia).trim();
            if (act.newData) s.data = String(act.newData).trim();
            if (act.newTitulo) s.titulo = String(act.newTitulo).toLowerCase().trim();
            const parsedP = parseInstallmentRef(s.referencia);
            if (parsedP) propagateInstallmentsFrom(mKey, s);
            totalAffectedMonths.add(mKey);
            if (!targetMonthToShow) targetMonthToShow = mKey;
            if (mKey === targetMonthToShow) spotlightRowIds.push(s.id);
          }
        });
      });
      targetView = 'planilha';
      summaryBadges.push('Gasto Atualizado');
    }

    else if (type === 'delete_saida') {
      const targetSearch = String(act.target || act.referencia || '').toLowerCase().trim();
      const targetVal = act.valor !== undefined && act.valor !== null ? Number(act.valor) : null;
      months.forEach(mKey => {
        const mObj = appState.data[mKey];
        if (!mObj) return;
        const beforeLen = mObj.saidas.length;
        mObj.saidas = mObj.saidas.filter(s => {
          const refLow = (s.referencia || '').toLowerCase();
          const baseRef = refLow.replace(/\s+\d+\/\d+$/, '').trim();
          const titLow = (s.titulo || '').toLowerCase();
          const matchByName = targetSearch && (
            refLow.includes(targetSearch) ||
            targetSearch.includes(baseRef && baseRef.length > 2 ? baseRef : '___') ||
            titLow === targetSearch
          );
          const matchByVal = targetVal !== null && !isNaN(targetVal) && Math.abs(Number(s.valor) - targetVal) < 0.01;
          if (targetSearch && targetVal !== null) {
            return !(matchByName && matchByVal);
          }
          return !(matchByName || matchByVal);
        });
        if (mObj.saidas.length !== beforeLen) {
          totalAffectedMonths.add(mKey);
          if (!targetMonthToShow) targetMonthToShow = mKey;
        }
      });
      targetView = 'planilha';
      summaryBadges.push('Gasto Removido');
    }

    else if (type === 'delete_cartao') {
      const targetSearch = String(act.target || act.referencia || '').toLowerCase().trim();
      const targetVal = act.valor !== undefined && act.valor !== null ? Number(act.valor) : null;
      const targetCard = act.cartao ? (String(act.cartao).toLowerCase().includes('mercado') ? 'mercadopago' : 'nubank') : null;
      months.forEach(mKey => {
        const mObj = appState.data[mKey];
        if (!mObj || !mObj.cartoes) return;
        const cardKeys = targetCard ? [targetCard] : ['mercadopago', 'nubank'];
        cardKeys.forEach(ck => {
          if (!mObj.cartoes[ck] || !Array.isArray(mObj.cartoes[ck].items)) return;
          const beforeLen = mObj.cartoes[ck].items.length;
          mObj.cartoes[ck].items = mObj.cartoes[ck].items.filter(item => {
            const refLow = (item.referencia || '').toLowerCase();
            const titLow = (item.titulo || '').toLowerCase();
            const matchByName = targetSearch && (refLow.includes(targetSearch) || titLow === targetSearch);
            const matchByVal = targetVal !== null && !isNaN(targetVal) && Math.abs(Number(item.valor) - targetVal) < 0.01;
            if (targetSearch && targetVal !== null) {
              return !(matchByName && matchByVal);
            }
            return !(matchByName || matchByVal);
          });
          if (mObj.cartoes[ck].items.length !== beforeLen) {
            totalAffectedMonths.add(mKey);
            if (!targetMonthToShow) targetMonthToShow = mKey;
          }
        });
        syncCreditCardsToNextMonth(mKey);
      });
      targetView = 'cartoes';
      summaryBadges.push('Gasto do Cartão Removido');
    }

    else if (type === 'add_cartao') {
      const val = Number(act.valor);
      if (isNaN(val) || val <= 0) return;
      const cardKey = String(act.cartao || 'nubank').toLowerCase().includes('mercado') ? 'mercadopago' : 'nubank';
      const dayStr = String(act.data || new Date().getDate());
      const cat = String(act.titulo || 'compras').toLowerCase().trim();
      const ref = String(act.referencia || 'compra').trim();
      const rawDebtor = act.devedor ? String(act.devedor).trim() : null;
      const isMeu = !rawDebtor || rawDebtor.toLowerCase() === 'meu' || rawDebtor.toLowerCase() === 'eu';
      const debtorName = isMeu ? null : rawDebtor;
      const isMarcos = Boolean(debtorName && debtorName.toLowerCase() === 'marcos');

      months.forEach((mKey, mIdx) => {
        const mObj = appState.data[mKey];
        if (!mObj || !mObj.cartoes || !mObj.cartoes[cardKey]) return;
        const newId = `c_${Date.now()}_${idx}_${mIdx}`;
        mObj.cartoes[cardKey].items.push({
          id: newId,
          data: dayStr,
          referencia: ref,
          titulo: cat,
          valor: Number(val.toFixed(2)),
          isMarcos,
          devedor: debtorName
        });
        syncCreditCardsToNextMonth(mKey);
        totalAffectedMonths.add(mKey);
        if (!targetMonthToShow) targetMonthToShow = mKey;
        if (mKey === targetMonthToShow) spotlightRowIds.push(newId);
      });
      targetView = 'cartoes';
      summaryBadges.push(cardKey === 'nubank' ? 'Cartão Nubank' : 'Cartão Mercado Pago');
    }

    else if (type === 'update_investimento') {
      const invName = String(act.nome || act.referencia || '').trim();
      const newVal = Number(act.novoValorTotal ?? act.valor);
      const aporte = act.aporte !== undefined ? Number(act.aporte) : 0;
      if (invName && !isNaN(newVal) && newVal >= 0) {
        const res = window.updateSingleInvestmentToday(invName, newVal, null, isNaN(aporte) ? 0 : aporte);
        if (res) {
          targetView = 'investimentos';
          summaryBadges.push(`Rendeu ${formatSignedBRL(res.diff)}`);
        }
      }
    }

    else if (type === 'add_investimento') {
      const invName = String(act.nome || act.referencia || '').trim();
      const val = Number(act.valor || 0);
      if (invName && !isNaN(val) && val >= 0) {
        const cleanVal = Number(val.toFixed(2));
        const newId = 'inv_' + Date.now() + '_' + idx;
        MONTH_ORDER.forEach(mName => {
          const mData = appState.data[mName];
          if (!mData || !Array.isArray(mData.investimentos)) return;
          if (!mData.investimentos.some(i => (i.nome || '').toLowerCase() === invName.toLowerCase())) {
            mData.investimentos.push({ id: `${newId}_${mName}`, nome: invName, valor: cleanVal, valorAnterior: cleanVal });
          }
        });
        const existingDaily = appState.dailyInvestments.find(i => (i.nome || '').toLowerCase() === invName.toLowerCase());
        if (existingDaily) {
          existingDaily.valorAnterior = cleanVal;
          existingDaily.valor = cleanVal;
        } else {
          appState.dailyInvestments.push({ id: newId, nome: invName, valor: cleanVal, valorAnterior: cleanVal });
        }
        targetView = 'investimentos';
        summaryBadges.push(`Novo Investimento: ${invName}`);
      }
    }
  });

  saveToStorage();

  if (targetMonthToShow && appState.currentMonth !== targetMonthToShow) {
    appState.currentMonth = targetMonthToShow;
  }
  if (targetView) {
    window.switchView(targetView);
  }
  renderAll(spotlightRowIds[0] || null);

  if (spotlightRowIds.length > 0 && window.navigateToAndSpotlight) {
    window.navigateToAndSpotlight({
      view: targetView || appState.currentView,
      month: targetMonthToShow || appState.currentMonth,
      rowIds: spotlightRowIds,
      pointerLabel: `✨ Atualizado pela Sailor (${summaryBadges[0] || 'Pronto'})`
    });
  }

  return {
    badge: summaryBadges[0] || 'Sailor IA ✨',
    affectedMonthsCount: totalAffectedMonths.size,
    targetMonthShown: targetMonthToShow || appState.currentMonth
  };
};

/**
 * Interpretador Agêntico Local Instantâneo:
 * Entende comandos em português natural (incluindo múltiplos meses, "todas as entradas de 2027",
 * aportes em investimentos sem contar como rendimento, gastos em meses específicos e cartões com devedores).
 */
function tryExecuteSmartCommand(rawText) {
  const text = preprocessSpokenFinancialText(rawText.trim());
  const lower = text.toLowerCase();
  const norm = normalizeWhatsappText(lower);

  // Ignora perguntas puras (sem verbo de comando no início)
  const startsWithCommand = /^(?:oi+\s+|ol[aá]\s+)?(?:miga\s+|amiga\s+|mulher\s+|luna\s+|sailor\s+|por\s+favor\s+)?(?:(?:preciso|quero|pode|vou|tem\s+que|me\s+ajuda\s+a)\s+)?(coloca|coloque|colocar|adiciona|adicione|adicionar|anota|anote|anotar|lan[cç]a|lance|lan[cç]ar|insere|insira|inserir|registra|registre|registrar|bota|bote|botar|p[oõ]e|ponha|p[oô]r|cria|crie|criar|inclui|inclua|incluir|gastei|paguei|comprei|passei|recebi|ganhei|entrou|depositaram|atualiza|atualize|atualizar|muda|mude|mudar|altera|altere|alterar|edita|edite|editar|corrige|corrija|corrigir|apaga|apague|apagar|remove|remova|remover|exclui|exclua|excluir|tira|tire|tirar|deleta|delete|deletar|transferi|coloquei|tirei|abrir|abre|mostrar|mostra|ver|ir\s+para|vai\s+para|mudar\s+para|muda\s+para)\b/i.test(lower);
  const hasExplicitActionVerb = /\b(coloca|coloque|colocar|adiciona|adicione|adicionar|anota|anote|anotar|lan[cç]a|lance|lan[cç]ar|insere|insira|inserir|registra|registre|registrar|bota|bote|botar|p[oõ]e|ponha|p[oô]r|cria|crie|criar|inclui|inclua|incluir|gastei|paguei|comprei|passei\s+no\s+cart[aã]o|passei\s+no\s+nubank|passei\s+no\s+mercado\s+pago|recebi|ganhei|atualiza|atualize|atualizar|muda|mude|mudar|altera|altere|alterar|edita|edite|editar|corrige|corrija|corrigir|apaga|apague|apagar|remove|remova|remover|exclui|exclua|excluir|tira|tire|tirar|deleta|delete|deletar)\b/i.test(lower);

  if (!startsWithCommand && !hasExplicitActionVerb) return false;
  if (/\?$/.test(text) && !startsWithCommand) return false;

  // 0. Navegar entre Abas ou Meses
  if (/(?:abrir|abre|mostrar|mostra|ver|ir\s+para|vai\s+para)\s+(?:a\s+aba\s+de\s+|os\s+)?cart[oõ]es/i.test(lower) && extractSafeMonetaryValues(lower).length === 0) {
    window.switchView('cartoes');
    const reply = `Abri a aba dos seus <strong>Cartões (Mercado Pago & Nubank)</strong>, miga! 💅 Aqui tá tudo separadinho por categoria e por quem te deve!`;
    addChatBubble('ai', reply, 'Aba: Cartões');
    speakText('Abri a aba dos cartões pra você, miga!');
    return true;
  }

  if (/(?:abrir|abre|mostrar|mostra|ver|ir\s+para|vai\s+para)\s+(?:a\s+aba\s+de\s+|os\s+)?investimentos/i.test(lower) && extractSafeMonetaryValues(lower).length === 0) {
    window.switchView('investimentos');
    const reply = `Chegamos na aba da riqueza, miga! ✨ Aqui em <strong>Investimentos & Rendimentos</strong> você vê a distribuição com porcentagem e quanto seu dindim tá rendendo!`;
    addChatBubble('ai', reply, 'Aba: Investimentos');
    speakText('Chegamos na aba de investimentos, miga!');
    return true;
  }

  const pureMonthSwitch = lower.match(/^(?:miga\s+|amiga\s+|luna\s+|sailor\s+)?(?:mudar|muda|ir|vai|abrir|abre|mostrar|mostra|ver)\s+(?:para\s+|o\s+m[eê]s\s+de\s+|a\s+planilha\s+de\s+)?(outubro(?:\s+202[67])?|novembro(?:\s+202[67])?|dezembro(?:\s+202[67])?|janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro)$/i);
  if (pureMonthSwitch) {
    const mKey = normalizeMonthKeywordToKey(pureMonthSwitch[1]);
    if (mKey) {
      setMonth(mKey);
      const fin = calculateCascadingFinancials(mKey);
      const reply = `Prontinho, miga! Já abri <strong>${getMonthLabel(mKey)}</strong> pra gente ver! 💖 Nesse mês suas entradas são <strong>${formatBRL(fin.totalEntradas)}</strong> e os gastos estão em <strong>${formatBRL(fin.totalSaidas)}</strong>.`;
      addChatBubble('ai', reply, `Mês: ${getMonthLabel(mKey)}`);
      speakText(`Prontinho, miga! Já abri ${getMonthLabel(mKey)}!`);
      return true;
    }
  }

  const monthResolution = resolveTargetMonthsFromText(lower);
  const targetMonths = monthResolution.months;
  const nums = extractSafeMonetaryValues(lower);

  // 1. INVESTIMENTOS: Aporte/Retirada + Novo Total ("coloquei mais 100 no nubank 120 e foi para 181,14" ou "atualiza nubank 120 para 5035")
  const matchedInv = (appState.dailyInvestments || []).find(inv => lower.includes(inv.nome.toLowerCase()));
  if (matchedInv && (/(investimento|caixinha|rendeu|atualiza|atualize|atualizar|coloquei|adicionei|tirei|transferi|passou\s+para|foi\s+para|hoje\s+tenho)/i.test(lower))) {
    if (nums.length >= 2 && /(coloquei|adicionei|tirei|retirei|transferi|aporte)/i.test(lower)) {
      const isWithdraw = /(tirei|retirei|transferi\s+do|saquei)/i.test(lower);
      const aporteVal = isWithdraw ? -Math.abs(nums[0]) : Math.abs(nums[0]);
      const finalVal = nums[nums.length - 1];
      const res = window.updateSingleInvestmentToday(matchedInv.nome, finalVal, null, aporteVal);
      if (res) {
        window.switchView('investimentos');
        const reply = `Perfeito, miga! ✨ Em <strong>${escapeHtml(res.nome)}</strong> você tinha ${formatBRL(res.oldVal)}, ${res.aporte >= 0 ? 'adicionou' : 'retirou'} <strong>${formatSignedBRL(res.aporte)}</strong> (base esperada: ${formatBRL(res.baseEsperada)}) e o total ficou em <strong>${formatBRL(res.newVal)}</strong>. Identifiquei que seu dinheiro rendeu de verdade <strong>${formatSignedBRL(res.diff)}</strong>! 💖`;
        addChatBubble('ai', reply, `Rendeu ${formatSignedBRL(res.diff)}`);
        speakText(`Prontinho, miga! Atualizei o ${res.nome} descontando os ${formatBRL(Math.abs(res.aporte))} que você movimentou. O rendimento real foi de ${formatBRL(res.diff)}!`);
        return true;
      }
    } else if (nums.length === 1) {
      const isPureAporte = /(coloquei\s+mais|adicionei\s+mais|transferi\s+mais|guardei\s+mais|tirei|retirei)/i.test(lower) && !/(para|total|ficou)/i.test(lower);
      if (isPureAporte) {
        const isWithdraw = /(tirei|retirei|saquei)/i.test(lower);
        const aporteVal = isWithdraw ? -Math.abs(nums[0]) : Math.abs(nums[0]);
        const newTotal = Math.max(0, Number((matchedInv.valor + aporteVal).toFixed(2)));
        const res = window.updateSingleInvestmentToday(matchedInv.nome, newTotal, null, aporteVal);
        if (res) {
          window.switchView('investimentos');
          const reply = `Prontinho, miga! 💰 ${aporteVal >= 0 ? 'Adicionei' : 'Retirei'} <strong>${formatBRL(Math.abs(aporteVal))}</strong> em <strong>${escapeHtml(res.nome)}</strong>! O saldo foi de ${formatBRL(res.oldVal)} para <strong>${formatBRL(res.newVal)}</strong> sem somar nada como rendimento (<strong>R$ 0,00</strong> de rendimento falso)!`;
          addChatBubble('ai', reply, `Saldo: ${formatBRL(res.newVal)}`);
          speakText(`Prontinho, miga! Atualizei o saldo de ${res.nome} para ${formatBRL(res.newVal)} sem alterar o seu rendimento!`);
          return true;
        }
      } else {
        const res = window.updateSingleInvestmentToday(matchedInv.nome, nums[0], null, 0);
        if (res) {
          window.switchView('investimentos');
          const reply = `Anotado, miga! 💖 Atualizei <strong>${escapeHtml(res.nome)}</strong> de ${formatBRL(res.oldVal)} para <strong>${formatBRL(res.newVal)}</strong>! Rendeu <strong>${formatSignedBRL(res.diff)}</strong> hoje!`;
          addChatBubble('ai', reply, `Rendimento: ${formatSignedBRL(res.diff)}`);
          speakText(`Anotado, miga! Atualizei o ${res.nome} para ${formatBRL(res.newVal)}. Rendeu ${formatBRL(res.diff)} hoje!`);
          return true;
        }
      }
    }
  }

  // 2. EXCLUIR / REMOVER / APAGAR (suporta 1 mês, vários meses ou todos os meses de 2027)
  const isDeleteIntent = /^(?:oi+\s+|miga\s+|amiga\s+|luna\s+|sailor\s+|por\s+favor\s+)?(?:(?:preciso|quero|pode|vou)\s+)?(apaga|apague|apagar|remove|remova|remover|exclui|exclua|excluir|deleta|delete|deletar|tira|tire|tirar)\b/i.test(lower);
  if (isDeleteIntent) {
    const isTargetEntrada = /\b(entrad[aeo]s?|entrdas?|sal[aá]rio|freela|b[oô]nus)\b/i.test(lower);
    const targetVal = nums.length > 0 ? nums[0] : undefined;
    const cleanTargetName = extractCleanReferenceName(text, '');

    if (isTargetEntrada) {
      const execRes = window.executeSailorActions([{
        type: 'delete_entrada',
        months: targetMonths,
        target: cleanTargetName,
        valor: targetVal
      }]);
      if (execRes && execRes.affectedMonthsCount > 0) {
        const reply = `Prontinho, miga! ✨ Removi a entrada ${cleanTargetName ? `<strong>"${escapeHtml(cleanTargetName)}"</strong> ` : ''}${targetVal ? `(${formatBRL(targetVal)}) ` : ''}de <strong>${monthResolution.label}</strong>!`;
        addChatBubble('ai', reply, 'Entrada Removida');
        speakText(`Prontinho, miga! Removi essa entrada de ${monthResolution.label}!`);
        return true;
      }
    } else {
      // Tenta localizar no primeiro mês alvo
      const firstMObj = appState.data[targetMonths[0]];
      const found = firstMObj ? findMatchingItem(firstMObj, cleanTargetName) : null;
      if (found || targetVal !== undefined || cleanTargetName === 'compras' || lower.includes('compras')) {
        let actionType = 'delete_saida';
        let cardKey = undefined;
        if (found) {
          if (found.listName === 'entradas') actionType = 'delete_entrada';
          else if (found.listName.startsWith('cartao_')) {
            actionType = 'delete_cartao';
            cardKey = found.listName.replace('cartao_', '');
          }
        } else if (lower.includes('cartao') || lower.includes('cartão') || lower.includes('fatura') || lower.includes('nubank') || lower.includes('mercado pago')) {
          actionType = 'delete_cartao';
        }

        const parsedParcel = (found && found.listName === 'saidas') ? parseInstallmentRef(found.item.referencia) : null;
        if (parsedParcel && !monthResolution.explicit) {
          const removedMonths = removeLinkedInstallments(parsedParcel.baseName, parsedParcel.totalParcels);
          saveToStorage();
          renderAll();
          const reply = `Sumiu daqui, miga! ✨ Apaguei a compra parcelada <strong>"${escapeHtml(parsedParcel.baseName)}"</strong> de todos os meses interligados (<strong>${removedMonths.join(', ')}</strong>)!`;
          addChatBubble('ai', reply, 'Parcelas Removidas');
          speakText(`Prontinho, miga! Tirei ${parsedParcel.baseName} de todos os meses pra você!`);
          return true;
        }
        const execRes = window.executeSailorActions([{
          type: actionType,
          months: targetMonths,
          target: cleanTargetName || (found ? (found.item.referencia || found.item.nome) : ''),
          valor: targetVal,
          cartao: cardKey
        }]);
        if (execRes && execRes.affectedMonthsCount > 0) {
          const disp = found ? (found.item.referencia || found.item.nome || cleanTargetName) : (cleanTargetName || (targetVal ? formatBRL(targetVal) : 'compras'));
          const reply = `Feito, miga! Já tirei <strong>"${escapeHtml(disp)}"</strong> de <strong>${monthResolution.label}</strong>! 🎉`;
          addChatBubble('ai', reply, 'Item Excluído');
          speakText(`Feito, miga! Já tirei ${disp} de ${monthResolution.label}!`);
          return true;
        }
      }
    }
  }

  // 3. EDITAR / MUDAR / ALTERAR VALOR OU DIA (suporta 1 ou vários meses)
  const isModifyIntent = /^(?:oi+\s+|miga\s+|amiga\s+|luna\s+|sailor\s+|por\s+favor\s+)?(?:(?:preciso|quero|pode|vou)\s+)?(muda|mude|mudar|altera|altere|alterar|edita|edite|editar|atualiza|atualize|atualizar|corrige|corrija|corrigir|passa|passar)\b/i.test(lower);
  if (isModifyIntent) {
    const changeDayMatch = lower.match(/(?:dia|data)\s+(?:de|da|do)\s+(.+?)\s+(?:para|pra)\s+(?:o\s+)?(?:dia\s+)?(\d{1,2}|\?)/i);
    if (changeDayMatch) {
      const targetSearch = extractCleanReferenceName(changeDayMatch[1], changeDayMatch[1].trim());
      const newDay = changeDayMatch[2].trim();
      const execRes = window.executeSailorActions([{
        type: 'update_saida',
        months: targetMonths,
        target: targetSearch,
        newData: newDay
      }]);
      if (execRes && execRes.affectedMonthsCount > 0) {
        const reply = `Anotadíssimo, miga! Mudei o dia de pagamento de <strong>${escapeHtml(targetSearch)}</strong> pro dia <strong>${newDay}</strong> em <strong>${monthResolution.label}</strong>! 💖`;
        addChatBubble('ai', reply, 'Data Alterada');
        speakText(`Pronto, miga! Mudei o dia de ${targetSearch} para o dia ${newDay}!`);
        return true;
      }
    }

    if (nums.length >= 1) {
      const newVal = nums[nums.length - 1];
      const oldValFilter = nums.length >= 2 ? nums[0] : undefined;
      const isTargetEntrada = /\b(entrad[aeo]s?|entrdas?|sal[aá]rio|freela|b[oô]nus)\b/i.test(lower);
      const targetSearch = extractCleanReferenceName(text, isTargetEntrada ? 'all' : '');

      if (isTargetEntrada) {
        const execRes = window.executeSailorActions([{
          type: 'update_entrada',
          months: targetMonths,
          target: targetSearch,
          targetValor: oldValFilter,
          valor: newVal
        }]);
        if (execRes && execRes.affectedMonthsCount > 0) {
          const reply = `Prontinho, miga! 💖 Atualizei a entrada em <strong>${monthResolution.label}</strong> para <strong>${formatBRL(newVal)}</strong>!`;
          addChatBubble('ai', reply, 'Entrada Atualizada');
          speakText(`Prontinho, miga! Atualizei a entrada em ${monthResolution.label} para ${formatBRL(newVal)}!`);
          return true;
        }
      } else if (targetSearch) {
        const firstMObj = appState.data[targetMonths[0]];
        const found = firstMObj ? findMatchingItem(firstMObj, targetSearch) : null;
        if (found) {
          if (found.listName === 'investimentos') {
            const res = window.updateSingleInvestmentToday(found.item.nome, newVal);
            if (res) {
              window.switchView('investimentos');
              const reply = `Arrasou, miga! 📈 Atualizei <strong>${escapeHtml(res.nome)}</strong> de ${formatBRL(res.oldVal)} pra <strong>${formatBRL(res.newVal)}</strong>! Rendeu <strong>${formatSignedBRL(res.diff)}</strong> hoje!`;
              addChatBubble('ai', reply, `Rendeu ${formatSignedBRL(res.diff)}`);
              speakText(`Arrasou, miga! Atualizei o ${res.nome} para ${formatBRL(res.newVal)}!`);
              return true;
            }
          }
          const actType = found.listName === 'entradas' ? 'update_entrada' : 'update_saida';
          window.executeSailorActions([{
            type: actType,
            months: targetMonths,
            target: found.item.referencia || targetSearch,
            valor: newVal
          }]);
          const reply = `Prontinho, miga! 💖 Mudei o valor de <strong>${escapeHtml(found.item.referencia || targetSearch)}</strong> para <strong>${formatBRL(newVal)}</strong> em <strong>${monthResolution.label}</strong>!`;
          addChatBubble('ai', reply, 'Valor Alterado');
          speakText(`Prontinho, miga! Mudei o valor para ${formatBRL(newVal)} em ${monthResolution.label}!`);
          return true;
        }
      }
    }
  }

  // 4. LANÇAR GASTO NO CARTÃO DE CRÉDITO (MERCADO PAGO OU NUBANK) — SUPORTA 1 OU VÁRIOS ITENS, QUALQUER MÊS E QUALQUER DEVEDOR
  if (/(cart[aã]o|cr[eé]dito|fatura|no\s+nubank|no\s+mercado\s+pago|mercado\s+pago|nubank)/i.test(lower) && /(gastei|passei|comprei|anota|anote|anotar|adiciona|adicione|adicionar|coloca|coloque|colocar|lan[cç]a|lance|lan[cç]ar|insere|insira|inserir|registra|registre|registrar|bota|bote|botar|p[oõ]e|ponha|p[oô]r|inclui|inclua|incluir)/i.test(lower) && nums.length > 0) {
    const cardKey = lower.includes('nubank') ? 'nubank' : 'mercadopago';
    const cardLabel = cardKey === 'nubank' ? 'Crédito NUBANK' : 'Crédito MERCADO PAGO';

    // Verifica se mencionou Marcos ou outra pessoa ("pro Marcos", "para a Isa", "da Ana", "para Fulano")
    let debtorName = 'Meu';
    if (/\b(marcos|pro\s+marcos|para\s+o\s+marcos|do\s+marcos)\b/i.test(lower)) {
      debtorName = 'Marcos';
    } else {
      const otherPersonMatch = text.match(/\b(?:para\s+o|para\s+a|pro|pra|em\s+nome\s+d[eo]|cobrar\s+d[eo])\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{1,20})\b/);
      if (otherPersonMatch && !/^(?:Nubank|Mercado|Cart[aã]o|Outubro|Novembro|Dezembro|Janeiro|Fevereiro|Mar[cç]o|Abril|Maio|Junho|Julho|Agosto|Setembro)$/i.test(otherPersonMatch[1])) {
        debtorName = otherPersonMatch[1].trim();
      }
    }

    const multiItems = parseMultiItemsFromCommand(text, true);
    if (multiItems.length > 1) {
      const actions = multiItems.map(it => ({
        type: 'add_cartao',
        months: targetMonths,
        cartao: cardKey,
        data: it.data,
        referencia: it.referencia,
        titulo: it.titulo,
        valor: it.valor,
        devedor: debtorName
      }));
      window.executeSailorActions(actions);

      const listHtml = multiItems
        .map(it => `• Dia ${it.data}: <strong>${formatBRL(it.valor)}</strong> (${escapeHtml(it.titulo)} — ref: <em>"${escapeHtml(it.referencia)}"</em>)`)
        .join('<br>');
      const reply = `Prontinho, miga! 💳✨ Adicionei os <strong>${multiItems.length} lançamentos</strong> na fatura do <strong>${cardLabel}</strong> em <strong>${monthResolution.label}</strong>:<br>${listHtml}`;
      addChatBubble('ai', reply, `${multiItems.length} itens no ${cardLabel}`);
      speakText(`Prontinho, miga! Adicionei todos os ${multiItems.length} itens na fatura do ${cardLabel} em ${monthResolution.label}!`);
      return true;
    }

    const val = nums[0];
    const dayM = lower.match(/\bdia\s+(\d{1,2})\b/i);
    const dayStr = dayM ? dayM[1] : String(new Date().getDate());

    let cat = 'compras';
    if (/(uber|99|passagem|ida|volta|corrida)/i.test(lower)) cat = 'uber';
    else if (/(conta|apple|meli|laricel|internet|luz)/i.test(lower)) cat = 'contas';
    else if (/(parcela|parcelado|livro|\d+\/\d+)/i.test(lower)) cat = 'parcelado';

    let ref = extractCleanReferenceName(
      text.replace(new RegExp(`\\b(?:para\\s+[oa]|pro|pra)\\s+${debtorName}\\b`, 'i'), ' '),
      cat === 'uber' ? '-' : (debtorName !== 'Meu' ? `compra ${debtorName.toLowerCase()}` : 'compra')
    );
    if (cat === 'uber' && /^uber$/i.test(ref)) ref = '-';

    window.executeSailorActions([{
      type: 'add_cartao',
      months: targetMonths,
      cartao: cardKey,
      data: dayStr,
      referencia: ref,
      titulo: cat,
      valor: val,
      devedor: debtorName
    }]);

    const debtorNote = debtorName !== 'Meu'
      ? `<br>💅 E já marquei no nome de <strong>${escapeHtml(debtorName)}</strong> pra entrar automaticamente a cobrar nas Entradas do mês seguinte!`
      : '';
    const reply = `Prontinho, miga! 💳 Anotei <strong>${formatBRL(val)}</strong> de <strong>"${escapeHtml(ref)}"</strong> no seu <strong>${cardLabel}</strong> em <strong>${monthResolution.label}</strong>!${debtorNote}`;
    addChatBubble('ai', reply, `${cardLabel} (${monthResolution.label})`);
    speakText(`Prontinho, miga! Anotei ${formatBRL(val)} de ${ref} no seu ${cardLabel} em ${monthResolution.label}!`);
    return true;
  }

  // 5. ADICIONAR ENTRADA (suporta "coloque em todas as entrades de 2027 o valor de 200 reais", "adiciona entrada em abril", "recebi 500", etc.)
  const mentionsEntradaWord = /\b(entrad[aeo]s?|entrdas?|recebi|ganhei|entrou|pix\s+recebido|depositaram|me\s+pagou|sal[aá]rio|freela|b[oô]nus|renda)\b/i.test(lower);
  if (mentionsEntradaWord && nums.length > 0) {
    const val = nums[nums.length - 1];
    const cleanRef = extractCleanReferenceName(text, 'entrada');

    window.executeSailorActions([{
      type: 'add_entrada',
      months: targetMonths,
      referencia: cleanRef,
      valor: val
    }]);

    const pluralMsg = targetMonths.length > 1
      ? `em <strong>${monthResolution.label}</strong> (${targetMonths.length} meses atualizados — já abri <strong>${getMonthLabel(targetMonths[0])}</strong> na tela pra você ver!)`
      : `nas suas Entradas de <strong>${getMonthLabel(targetMonths[0])}</strong>`;

    const reply = `Prontinho, miga!! 💸✨ Coloquei <strong>${formatBRL(val)}</strong> com o nome <strong>"${escapeHtml(cleanRef)}"</strong> ${pluralMsg}! Pode conferir que tá tudo certinho! 💖`;
    addChatBubble('ai', reply, targetMonths.length > 1 ? `Entrada (${targetMonths.length} meses)` : `Entrada em ${getMonthLabel(targetMonths[0])}`);
    speakText(`Prontinho, miga! Coloquei ${formatBRL(val)} de ${cleanRef} nas entradas de ${monthResolution.label}!`);
    return true;
  }

  // 6. ADICIONAR SAÍDA / GASTO (suporta 1 ou vários itens, 1 ou vários meses, parcelas X/Y ou "em X vezes")
  const explicitFractionMatch = lower.match(/\b([a-záéíóúâêôãõç0-9\s]+?)\s+(\d{1,2})\s*\/\s*(\d{1,2})\b/i);
  const parcelTimesMatch = lower.match(/(?:parcelado\s+em|em)\s+(\d{1,2})\s*(?:vezes|x|parcelas)\b/i);
  const isAddExpenseIntent = /(gastei|paguei|comprei|anota|anote|anotar|adiciona|adicione|adicionar|coloca|coloque|colocar|insere|insira|inserir|registra|registre|registrar|lan[cç]a|lance|lan[cç]ar|bota|bote|botar|p[oõ]e|ponha|p[oô]r|inclui|inclua|incluir|novo\s+gasto|nova\s+sa[ií]da)/i.test(lower) || Boolean(explicitFractionMatch);

  if (isAddExpenseIntent && nums.length > 0) {
    const multiItems = (!explicitFractionMatch && !parcelTimesMatch) ? parseMultiItemsFromCommand(text, false) : [];
    if (multiItems.length > 1) {
      const actions = multiItems.map(it => ({
        type: 'add_saida',
        months: targetMonths,
        data: it.data,
        referencia: it.referencia,
        titulo: it.titulo,
        valor: it.valor,
        parcelas: 1
      }));
      window.executeSailorActions(actions);

      const listHtml = multiItems
        .map(it => `• Dia ${it.data}: <strong>${formatBRL(it.valor)}</strong> (${escapeHtml(it.titulo)} — ref: <em>"${escapeHtml(it.referencia)}"</em>)`)
        .join('<br>');
      const reply = `Prontinho, miga! 💅✨ Adicionei os <strong>${multiItems.length} gastos</strong> em <strong>${monthResolution.label}</strong>:<br>${listHtml}`;
      addChatBubble('ai', reply, `${multiItems.length} gastos em ${monthResolution.label}`);
      speakText(`Prontinho, miga! Adicionei os ${multiItems.length} gastos em ${monthResolution.label}!`);
      return true;
    }

    const val = nums[nums.length - 1];
    const dayM = lower.match(/\bdia\s+(\d{1,2})\b/i);
    const parsedDay = dayM ? String(Math.min(31, Math.max(1, parseInt(dayM[1], 10)))) : String(new Date().getDate());

    let categoria = 'compras';
    if (explicitFractionMatch || parcelTimesMatch || /(parcela|parcelado|shein|chapinha|viagem)/i.test(lower)) {
      categoria = 'parcelado';
    } else if (/(uber|99|t[aá]xi|passagem|passes|corrida|[oô]nibus|transporte)/i.test(lower)) {
      categoria = 'uber';
    } else if (/(fatura)/i.test(lower)) {
      categoria = 'fatura';
    } else if (/(conta|[aá]gua|luz|energia|internet|vivo|claro|tim|faculdade|aluguel|laricel|academia)/i.test(lower)) {
      categoria = 'contas';
    }

    let baseClean = extractCleanReferenceName(text, categoria === 'uber' ? 'passagem' : categoria);
    let finalRef = baseClean;
    let totalParcels = 1;

    if (explicitFractionMatch) {
      finalRef = `${baseClean} ${explicitFractionMatch[2]}/${explicitFractionMatch[3]}`;
    } else if (parcelTimesMatch) {
      totalParcels = parseInt(parcelTimesMatch[1], 10) || 1;
      if (totalParcels > 1) finalRef = `${baseClean} 1/${totalParcels}`;
    }

    window.executeSailorActions([{
      type: 'add_saida',
      months: targetMonths,
      data: parsedDay,
      referencia: finalRef,
      titulo: categoria,
      valor: val,
      parcelas: totalParcels
    }]);

    const whereTxt = targetMonths.length > 1
      ? `em <strong>${monthResolution.label}</strong> (${targetMonths.length} meses)`
      : `em <strong>${getMonthLabel(targetMonths[0])}</strong> (dia ${parsedDay})`;

    const reply = `Prontinho, miga! 💅 Já anotei <strong>${formatBRL(val)}</strong> de <strong>"${escapeHtml(finalRef)}"</strong> na categoria <span class="cat-tag ${getCategoryClass(categoria)}">${categoria}</span> ${whereTxt}!`;
    addChatBubble('ai', reply, targetMonths.length > 1 ? `Gasto (${targetMonths.length} meses)` : `Gasto em ${getMonthLabel(targetMonths[0])}`);
    speakText(`Prontinho, miga! Coloquei ${formatBRL(val)} de ${finalRef} em ${monthResolution.label}!`);
    return true;
  }

  return false;
}

function processUserMessage(rawMessage) {
  const text = rawMessage.trim();
  if (!text) return;

  addChatBubble('user', escapeHtml(text));
  const lower = text.toLowerCase();

  // 1. Primeiro tenta executar comandos diretos (adicionar/editar/remover em qualquer mês, ano 2026/2027, cartões ou investimentos)
  if (tryExecuteSmartCommand(text)) {
    appState.chatMemory.push({ role: 'user', content: text });
    return;
  }

  // 2. Se pediu para mostrar / localizar / que dia pagou / qual valor / onde está qualquer item ou parcela
  const isShowDayOrItemIntent = /(mostra|mostre|mostrar|me\s+mostra|onde\s+est[aá]|onde\s+t[aá]|onde\s+fica|cad[eê]|leva|me\s+leva|localiza|acha|achar|destaca|destaque|ver\s+onde|quero\s+ver|que\s+dia|qual\s+dia|qual\s+a\s+data|quando\s+paguei|quando\s+vence|dia\s+que\s+paguei|quanto\s+paguei|quanto\s+foi|quanto\s+custou|qual\s+o\s+valor)/.test(lower);
  if (isShowDayOrItemIntent &&
      !/(muda|mude|altera|altere|atualiza|atualize|apaga|remove|exclui|anota|adiciona|coloca|soma|somar|at[eé]\s+dezembro|at[eé]\s+janeiro|at[eé]\s+fevereiro|at[eé]\s+mar[cç]o)/.test(lower)) {
    const located = tryLocateAndSpotlightRequestedItem(normalizeWhatsappText(lower));
    if (located) {
      appState.chatMemory.push({ role: 'user', content: text });
      appState.chatMemory.push({ role: 'assistant', content: located.speech });
      addChatBubble('ai', located.html, located.badge);
      speakText(located.speech);
      return;
    }
  }

  // 3. Caso contrário (ou se for um comando complexo/múltiplo/conversa livre), envia para o Cérebro Agêntico da Sailor IA!
  handleLunaConversationOrAdvice(text, lower);
}

/**
 * Normaliza abreviações de WhatsApp ("td", "vc", "tb", "pq", "oq", "amg") para entender qualquer conversa natural
 */
function normalizeWhatsappText(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/\btd\b/g, 'tudo')
    .replace(/\btdo\b/g, 'tudo')
    .replace(/\bvc\b/g, 'você')
    .replace(/\bvcs\b/g, 'vocês')
    .replace(/\btb\b|\btbm\b/g, 'também')
    .replace(/\bpq\b/g, 'por que')
    .replace(/\boq\b/g, 'o que')
    .replace(/\bcmg\b/g, 'comigo')
    .replace(/\bamg\b/g, 'amiga')
    .replace(/\bhj\b/g, 'hoje')
    .replace(/\bfds\b/g, 'fim de semana')
    .replace(/\bblz\b/g, 'beleza')
    .replace(/\bobg\b|\bvlw\b/g, 'obrigada')
    .replace(/\bsdd\b|\bsdds\b/g, 'saudade')
    .replace(/\bto\b|\btoo\b/g, 'tô')
    .replace(/\bta\b/g, 'tá')
    .replace(/\bctz\b/g, 'certeza')
    .replace(/\bpfv\b|\bpfvr\b/g, 'por favor');
}

/**
 * Constrói um resumo completo, matemático e 100% atualizado de TODA a planilha
 * (todos os meses, todas as linhas de entrada/saída, somas entre meses, cartões de crédito e investimentos)
 * para que a IA Luna saiba responder literalmente QUALQUER pergunta ou soma!
 */
/**
 * Analisa matematicamente TODAS as compras parceladas (tudo que tem "/" no formato X/Y)
 * descobrindo em qual mês cada parcela cai, quando termina, quantas já foram em Outubro e quantas faltam!
 */
function analyzeAllInstallmentsData(referenceMonth = appState.currentMonth) {
  const refMonthIdx = MONTH_ORDER.indexOf(referenceMonth);
  const groups = {};

  MONTH_ORDER.forEach((mName, mIdx) => {
    const mObj = appState.data[mName];
    if (!mObj || !Array.isArray(mObj.saidas)) return;

    mObj.saidas.forEach((s) => {
      const parsed = parseInstallmentRef(s.referencia);
      if (!parsed) return;

      const key = parsed.baseName.toLowerCase();
      if (!groups[key]) {
        groups[key] = {
          baseName: parsed.baseName,
          totalParcels: parsed.totalParcels,
          valorParcela: Number(s.valor) || 0,
          timeline: [] // { month, monthIdx, parcelNum, totalParcels, valor, data, ref }
        };
      }
      groups[key].valorParcela = Number(s.valor) || groups[key].valorParcela;
      groups[key].timeline.push({
        id: s.id,
        month: mName,
        monthIdx: mIdx,
        parcelNum: parsed.currentParcel,
        totalParcels: parsed.totalParcels,
        valor: Number(s.valor) || 0,
        data: s.data,
        ref: s.referencia
      });
    });
  });

  // Calcula métricas completas para cada compra parcelada
  const ALL_CALENDAR_MONTHS = ['OUTUBRO', 'NOVEMBRO', 'DEZEMBRO', 'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO'];

  Object.values(groups).forEach((g) => {
    g.timeline.sort((a, b) => a.parcelNum - b.parcelNum);
    const firstEntry = g.timeline[0];
    const lastEntry = g.timeline[g.timeline.length - 1];

    // Descobre o mês exato em que termina (parcela Y/Y), mesmo que passe dos meses visíveis
    const startCalIdx = ALL_CALENDAR_MONTHS.indexOf(firstEntry.month);
    const parcelsAfterFirst = g.totalParcels - firstEntry.parcelNum;
    const endCalIdx = startCalIdx !== -1 ? (startCalIdx + parcelsAfterFirst) % ALL_CALENDAR_MONTHS.length : -1;
    g.endMonth = endCalIdx !== -1 ? ALL_CALENDAR_MONTHS[endCalIdx] : lastEntry.month;

    // Parcelas até o mês de referência (ex: se está em OUTUBRO e já pagou a de Outubro)
    const parcelsInOrBeforeRef = g.timeline.filter(t => t.monthIdx <= refMonthIdx);
    const highestParcelPaid = parcelsInOrBeforeRef.length > 0
      ? Math.max(...parcelsInOrBeforeRef.map(t => t.parcelNum))
      : (firstEntry.parcelNum - 1);

    g.currentMonthInstallments = g.timeline.filter(t => t.month === referenceMonth);
    g.highestParcelPaid = highestParcelPaid;
    g.remainingParcelsCount = Math.max(0, g.totalParcels - highestParcelPaid);
    g.remainingValorTotal = Number((g.remainingParcelsCount * g.valorParcela).toFixed(2));
    g.futureTimeline = g.timeline.filter(t => t.parcelNum > highestParcelPaid);
  });

  return groups;
}

/**
 * Localizador Visual Instantâneo da Luna ("Me mostra na hora e destaca por 3 segundos"):
 * Exemplos:
 * - "me mostra onde esta a 4/6 parcela da viagem rj" -> Abre JANEIRO, rola até "viagem rj 4/6" e destaca por 3s!
 * - "onde está a última parcela da viagem" -> Abre MARÇO, rola até "viagem rj 6/6" e destaca por 3s!
 * - "me mostra a chapinha 10/10" -> Abre NOVEMBRO, rola até "chapinha 10/10" e destaca por 3s!
 * - "onde está o chiquinho" -> Abre a aba Cartões (Nubank), rola até "chiquinho" e destaca por 3s!
 * - "me mostra a faculdade de dezembro" -> Abre DEZEMBRO, rola até "faculdade" e destaca por 3s!
 * - "mostra a reposição do investimento" -> Rola até o painel de Reposição e destaca por 3s!
 */
function tryLocateAndSpotlightRequestedItem(norm) {
  ensureAllSlashInstallmentsSynced();
  
  const groups = analyzeAllInstallmentsData(appState.currentMonth);
  const groupKeys = Object.keys(groups);

  const isShowOrWhereQuery = /(mostra|mostre|mostrar|me\s+mostra|onde\s+est[aá]|onde\s+t[aá]|onde\s+fica|cad[eê]|leva|me\s+leva|localiza|acha|achar|destaca|destaque|ver\s+onde|quero\s+ver)/.test(norm);
  const isDayQuery = /(que\s+dia|qual\s+dia|qual\s+a\s+data|quando\s+paguei|quando\s+vence|dia\s+que\s+paguei|data\s+de|data\s+do|data\s+da)/.test(norm);
  const isValueItemQuery = /(quanto\s+paguei|quanto\s+eu\s+paguei|quanto\s+foi|quanto\s+custou|qual\s+o\s+valor)/.test(norm) && !/(soma|somar|at[eé]|todos\s+os\s+meses|tr[eê]s\s+meses)/.test(norm);
  const fractionMatch = norm.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/);

  const ordinalMap = {
    primeira: 1, '1a': 1, '1ª': 1,
    segunda: 2, '2a': 2, '2ª': 2,
    terceira: 3, '3a': 3, '3ª': 3,
    quarta: 4, '4a': 4, '4ª': 4,
    quinta: 5, '5a': 5, '5ª': 5,
    sexta: 6, '6a': 6, '6ª': 6,
    setima: 7, 'sétima': 7,
    oitava: 8,
    nona: 9,
    decima: 10, 'décima': 10
  };

  let requestedParcelNum = null;
  let requestedTotalParcels = null;

  if (fractionMatch) {
    requestedParcelNum = parseInt(fractionMatch[1], 10);
    requestedTotalParcels = parseInt(fractionMatch[2], 10);
  } else {
    const numParcelMatch = norm.match(/\bparcela\s+(\d{1,2})\b/);
    if (numParcelMatch) {
      requestedParcelNum = parseInt(numParcelMatch[1], 10);
    } else {
      for (const [word, num] of Object.entries(ordinalMap)) {
        if (new RegExp(`\\b${word}\\b`).test(norm) && /(parcela|parcla|viagem|chapinha|shein)/.test(norm)) {
          requestedParcelNum = num;
          break;
        }
      }
    }
  }

  const matchedGroupKey = groupKeys.find(k =>
    norm.includes(k) ||
    (k.includes('viagem') && norm.includes('viagem')) ||
    (requestedTotalParcels && groups[k].totalParcels === requestedTotalParcels)
  );

  // 1. Se pediu uma parcela específica (ex: "4/6 da viagem rj", "que dia paguei a 1/6 da viagem", "onde está a 4/6 parcela da viagem")
  if (matchedGroupKey && (requestedParcelNum !== null || ((isShowOrWhereQuery || isDayQuery) && /([uú]ltima|final)/.test(norm)))) {
    const g = groups[matchedGroupKey];
    const targetP = requestedParcelNum !== null ? requestedParcelNum : g.totalParcels;
    const targetEntry = g.timeline.find(t => t.parcelNum === targetP) || g.timeline[g.timeline.length - 1];

    if (targetEntry) {
      window.navigateToAndSpotlight({
        view: 'planilha',
        month: targetEntry.month,
        rowId: targetEntry.id,
        pointerLabel: `✨ ${targetEntry.ref.toUpperCase()} — Dia ${targetEntry.data} (${targetEntry.month})`
      });

      return {
        badge: `Destacado em ${targetEntry.month} (Dia ${targetEntry.data}) ✨`,
        html: `
          Aqui está, miga!! ✨ Já te levei direto para a planilha de <strong>${targetEntry.month}</strong> e deixei a parcela <strong>"${escapeHtml(targetEntry.ref)}"</strong> destacada piscando por 3 segundos pra você! 💖👇<br><br>
          • <strong>Dia / Data na Planilha:</strong> <strong>Dia ${escapeHtml(targetEntry.data)}</strong><br>
          • <strong>Mês da Parcela:</strong> <strong>${targetEntry.month}</strong><br>
          • <strong>Item:</strong> <strong>${escapeHtml(targetEntry.ref)}</strong> (Parcela ${targetEntry.parcelNum} de ${targetEntry.totalParcels})<br>
          • <strong>Valor:</strong> <strong>${formatBRL(targetEntry.valor)}</strong>
        `,
        speech: `Aqui está, miga! Já abri a planilha de ${targetEntry.month.toLowerCase()} e deixei a parcela ${targetEntry.parcelNum} de ${targetEntry.totalParcels} da ${g.baseName} destacada pra você! Ela fica no dia ${targetEntry.data}, no valor de ${formatBRL(targetEntry.valor)}!`
      };
    }
  }

  if (!isShowOrWhereQuery && !isDayQuery && !isValueItemQuery) return null;

  // 2. Se pediu para mostrar ou perguntou que dia pagou uma compra parcelada geral (ex: "que dia paguei a viagem rj", "onde está a viagem rj")
  if (matchedGroupKey) {
    const g = groups[matchedGroupKey];
    const currentOrFirst = g.timeline.find(t => t.month === appState.currentMonth) || g.timeline[0];
    window.navigateToAndSpotlight({
      view: 'planilha',
      month: currentOrFirst.month,
      rowId: currentOrFirst.id,
      pointerLabel: `✨ ${currentOrFirst.ref.toUpperCase()} — Dia ${currentOrFirst.data} (${currentOrFirst.month})`
    });

    const buttonsHtml = g.timeline.map(t =>
      `<button type="button" class="btn-mini-deduct" style="margin:3px 4px 3px 0;" onclick="navigateToAndSpotlight({view:'planilha',month:'${t.month}',rowId:'${t.id}',pointerLabel:'✨ ${escapeHtml(t.ref.toUpperCase())} (${t.month})'})">🔍 Ver ${t.parcelNum}/${t.totalParcels} (${t.month})</button>`
    ).join('');

    return {
      badge: `${g.baseName.toUpperCase()} — Dia ${currentOrFirst.data} 🔍`,
      html: `
        Achei pra você, miga! ✨ Já destaquei <strong>"${escapeHtml(currentOrFirst.ref)}"</strong> aqui em <strong>${currentOrFirst.month}</strong> por 3 segundos!<br><br>
        • <strong>Dia de pagamento:</strong> <strong>Dia ${escapeHtml(currentOrFirst.data)}</strong><br>
        • <strong>Valor da parcela:</strong> <strong>${formatBRL(currentOrFirst.valor)}</strong> (${g.totalParcels}x de ${formatBRL(g.valorParcela)}, terminando em <strong>${g.endMonth}</strong>)<br><br>
        Se quiser pular direto pra qualquer outra parcela de <strong>${escapeHtml(g.baseName)}</strong>, é só clicar abaixo que eu te levo na hora:<br>
        <div style="margin-top:6px;">${buttonsHtml}</div>
      `,
      speech: `Achei pra você, miga! Já destaquei ${currentOrFirst.ref} na tela! Ela vence no dia ${currentOrFirst.data} no valor de ${formatBRL(currentOrFirst.valor)}!`
    };
  }

  // 3. Se pediu para mostrar onde fica o Controle de Reposição do Investimento
  if (/(repor|reposi[cç][aã]o|quanto\s+tirei|tirei\s+do\s+investimento|devolv)/.test(norm)) {
    window.navigateToAndSpotlight({
      view: 'planilha',
      month: appState.currentMonth,
      selector: '#replenishTrackerBox',
      pointerLabel: '✨ Controle de Reposição do Investimento'
    });
    return {
      badge: 'Painel de Reposição Destacado ✨',
      html: `
        Aqui está, miga!! ✨ Já rolei a tela até o seu <strong>Controle de Reposição do Investimento</strong> e deixei ele destacado por 3 segundos pra você ver quanto tirou e quanto falta repor! 💖
      `,
      speech: `Aqui está, miga! Já te levei até o painel de Controle de Reposição do Investimento e deixei destacado na tela pra você!`
    };
  }

  // 3.5. Se pediu para mostrar os gastos do Marcos nos cartões
  if (/\bmarcos\b/.test(norm) && !/(entrada)/.test(norm)) {
    const cardsOut = appState.data.OUTUBRO.cartoes;
    const marcosIds = [
      ...cardsOut.mercadopago.items.filter(i => i.isMarcos).map(i => i.id),
      ...cardsOut.nubank.items.filter(i => i.isMarcos).map(i => i.id)
    ];
    window.navigateToAndSpotlight({
      view: 'cartoes',
      month: 'OUTUBRO',
      rowIds: marcosIds,
      pointerLabel: '✨ Gastos do Marcos nos Cartões (R$ 0,00)'
    });
    const listMarcos = [
      ...cardsOut.mercadopago.items.filter(i => i.isMarcos).map(i => `• <strong>${escapeHtml(i.referencia)}</strong> (MP): <strong>${formatBRL(i.valor)}</strong> — Dia ${i.data}`),
      ...cardsOut.nubank.items.filter(i => i.isMarcos).map(i => `• <strong>${escapeHtml(i.referencia)}</strong> (Nubank): <strong>${formatBRL(i.valor)}</strong> — Dia ${i.data}`)
    ].join('<br>');

    return {
      badge: 'Gastos do Marcos Destacados 💳',
      html: `
        Aqui estão todos os gastos do <strong>Marcos</strong> nos seus cartões, miga!! ✨ Já te levei até a aba de Cartões e deixei todas as linhas dele destacadas por 3 segundos:<br><br>
        ${listMarcos}
      `,
      speech: `Aqui estão todos os gastos do Marcos, miga! Já te levei até a aba de cartões e destaquei todas as compras dele pra você ver!`
    };
  }

  // 4. Verifica se mencionou algum mês específico (ex: "me mostra a faculdade de dezembro", "que dia paguei uber em outubro")
  let targetMonthForSearch = null;
  for (const m of MONTH_ORDER) {
    if (norm.includes(m.toLowerCase()) || (m === 'MARÇO' && norm.includes('marco'))) {
      targetMonthForSearch = m;
      break;
    }
  }

  const searchMonths = targetMonthForSearch
    ? [targetMonthForSearch]
    : [appState.currentMonth, ...MONTH_ORDER.filter(m => m !== appState.currentMonth)];

  // Limpa palavras de comando e de pergunta de data/valor para achar o termo exato buscado
  const cleanQuery = norm
    .replace(/\b(miga|amiga|mulher|luna|oi|por favor|me|mostra|mostre|mostrar|onde|est[aá]|t[aá]|fica|cad[eê]|leva|at[eé]|localiza|acha|achar|destaca|destaque|ver|quero|que|qual|quais|dia|data|quando|eu|paguei|comprei|gastei|vence|foi|custou|valor|deu|o|a|os|as|um|uma|gasto|gastos|saida|saída|entrada|item|compra|parcela|de|do|da|dos|das|em|no|na|nos|nas|outubro|novembro|dezembro|janeiro|fevereiro|mar[cç]o)\b/g, ' ')
    .replace(/[?!.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanQuery.length >= 2) {
    const queryTokens = cleanQuery.split(' ').filter(w => w.length >= 3);
    const matchesRef = (refStr) => {
      const r = String(refStr || '').toLowerCase();
      if (r.includes(cleanQuery) || cleanQuery.includes(r)) return true;
      return queryTokens.length > 0 && queryTokens.every(tok => r.includes(tok));
    };

    // 4a. Primeiro verifica nos Cartões de Crédito (Mercado Pago e Nubank) se for uma compra específica do cartão (ex: "chiquinho", "bolo", "cacau show", "kfc", "açai")
    // (ou se o usuário perguntou "que dia eu paguei..." e o item está no cartão!)
    const cardsOut = appState.data.OUTUBRO.cartoes;
    const matchedMP = cardsOut.mercadopago.items.filter(i => matchesRef(i.referencia));
    const matchedNu = cardsOut.nubank.items.filter(i => matchesRef(i.referencia));

    // Busca também nas Saídas e Entradas das planilhas mensais
    let foundMonthSaidas = null;
    let matchedSaidas = [];
    for (const mName of searchMonths) {
      const mObj = appState.data[mName];
      const byRef = mObj.saidas.filter(s => matchesRef(s.referencia));
      const byCat = mObj.saidas.filter(s => s.titulo.toLowerCase() === cleanQuery);
      const combined = byRef.length > 0 ? byRef : byCat;
      if (combined.length > 0) {
        foundMonthSaidas = mName;
        matchedSaidas = combined;
        break;
      }
    }

    // Se encontrou nas Saídas da Planilha Mensal (e não mencionou especificamente cartão quando há match só no cartão)
    if (matchedSaidas.length > 0 && !(norm.includes('cart') && (matchedMP.length > 0 || matchedNu.length > 0))) {
      const ids = matchedSaidas.map(s => s.id);
      const first = matchedSaidas[0];
      window.navigateToAndSpotlight({
        view: 'planilha',
        month: foundMonthSaidas,
        rowIds: ids,
        pointerLabel: matchedSaidas.length === 1
          ? `✨ ${first.referencia.toUpperCase()} — Dia ${first.data} (${foundMonthSaidas})`
          : `✨ ${matchedSaidas.length} itens de ${cleanQuery.toUpperCase()} (${foundMonthSaidas})`
      });

      if (matchedSaidas.length === 1) {
        const diaTxt = first.data === '-' || first.data === '?' ? `data "${first.data}"` : `<strong>dia ${escapeHtml(first.data)}</strong>`;
        return {
          badge: `Destacado em ${foundMonthSaidas} (Dia ${first.data}) ✨`,
          html: `
            Aqui está, miga!! ✨ Já te levei até a planilha de <strong>${foundMonthSaidas}</strong> e deixei <strong>"${escapeHtml(first.referencia)}"</strong> destacado por 3 segundos pra você!<br><br>
            • <strong>Dia do pagamento:</strong> ${diaTxt}<br>
            • <strong>Valor:</strong> <strong>${formatBRL(first.valor)}</strong><br>
            • <strong>Categoria:</strong> <span class="cat-tag ${getCategoryClass(first.titulo)}">${escapeHtml(first.titulo)}</span>
          `,
          speech: `Aqui está, miga! Já abri ${foundMonthSaidas.toLowerCase()} e destaquei ${first.referencia} pra você! Foi no dia ${first.data}, no valor de ${formatBRL(first.valor)}!`
        };
      } else {
        const totalM = matchedSaidas.reduce((a, b) => a + b.valor, 0);
        const listHtml = matchedSaidas.map(s =>
          `• <strong>Dia ${escapeHtml(s.data)}:</strong> ${escapeHtml(s.referencia)} — <strong>${formatBRL(s.valor)}</strong>`
        ).join('<br>');
        return {
          badge: `${matchedSaidas.length} itens em ${foundMonthSaidas} ✨`,
          html: `
            Aqui estão, miga!! ✨ Já abri <strong>${foundMonthSaidas}</strong> e deixei todos os <strong>${matchedSaidas.length} lançamentos</strong> destacados por 3 segundos:<br><br>
            ${listHtml}<br><br>
            • <strong>Soma total:</strong> <strong>${formatBRL(totalM)}</strong>
          `,
          speech: `Aqui estão, miga! Já destaquei os ${matchedSaidas.length} lançamentos na planilha de ${foundMonthSaidas.toLowerCase()}, somando ${formatBRL(totalM)}!`
        };
      }
    }

    // Se encontrou no Cartão Mercado Pago ou Cartão Nubank
    if (matchedMP.length > 0 || matchedNu.length > 0) {
      const allMatchedCards = [
        ...matchedMP.map(i => ({ ...i, cardName: 'Cartão Mercado Pago' })),
        ...matchedNu.map(i => ({ ...i, cardName: 'Cartão Nubank' }))
      ];
      const ids = allMatchedCards.map(i => i.id);
      const first = allMatchedCards[0];

      window.navigateToAndSpotlight({
        view: 'cartoes',
        month: 'OUTUBRO',
        rowIds: ids,
        pointerLabel: `✨ ${first.cardName}: ${first.referencia.toUpperCase()} (Dia ${first.data})`
      });

      const listHtml = allMatchedCards.map(i =>
        `• <strong>Dia ${escapeHtml(i.data)}</strong> (${i.cardName}): <strong>${escapeHtml(i.referencia)}</strong> — <strong>${formatBRL(i.valor)}</strong> ${i.isMarcos ? '<em>(Marcos)</em>' : '<em>(Seu)</em>'}`
      ).join('<br>');

      return {
        badge: `Destacado em ${first.cardName} (Dia ${first.data}) 💳`,
        html: `
          Achei pra você, miga!! ✨ Já te levei até a aba de <strong>Cartões</strong> e deixei <strong>"${escapeHtml(first.referencia)}"</strong> destacado por 3 segundos!<br><br>
          ${listHtml}
        `,
        speech: `Achei pra você, miga! Já abri a aba de cartões e deixei ${first.referencia} destacado! Você pagou no dia ${first.data}, no ${first.cardName}, no valor de ${formatBRL(first.valor)}!`
      };
    }

    // Busca nas Entradas
    for (const mName of searchMonths) {
      const mObj = appState.data[mName];
      const foundEntrada = mObj.entradas.find(e => matchesRef(e.referencia));
      if (foundEntrada) {
        window.navigateToAndSpotlight({
          view: 'planilha',
          month: mName,
          rowId: foundEntrada.id,
          pointerLabel: `✨ ENTRADA: ${foundEntrada.referencia.toUpperCase()} (${mName})`
        });
        return {
          badge: `Entrada em ${mName} ✨`,
          html: `
            Aqui está, miga!! ✨ Te levei até as <strong>Entradas de ${mName}</strong> e deixei <strong>"${escapeHtml(foundEntrada.referencia)}"</strong> (<strong>${formatBRL(foundEntrada.valor)}</strong>) destacado por 3 segundos! 💖
          `,
          speech: `Aqui está, miga! Já te levei até as entradas de ${mName.toLowerCase()} e destaquei ${foundEntrada.referencia}, no valor de ${formatBRL(foundEntrada.valor)}!`
        };
      }
    }

    // Busca nas Caixinhas de Investimento
    const foundInv = appState.data[appState.currentMonth].investimentos.find(inv => matchesRef(inv.nome));
    if (foundInv) {
      window.navigateToAndSpotlight({
        view: 'investimentos',
        month: appState.currentMonth,
        rowId: `daily_${foundInv.id}`,
        pointerLabel: `✨ Investimento: ${foundInv.nome.toUpperCase()}`
      });
      return {
        badge: `Investimento: ${foundInv.nome} 📈`,
        html: `
          Aqui está sua caixinha <strong>${escapeHtml(foundInv.nome)}</strong> (${formatBRL(foundInv.valor)}), miga!! ✨ Já abri a aba de Investimentos e deixei ela destacada por 3 segundos! 💖
        `,
        speech: `Aqui está sua caixinha ${foundInv.nome}, com saldo de ${formatBRL(foundInv.valor)}! Já deixei destacada na tela pra você!`
      };
    }
  }

  return null;
}

/**
 * Garante que em QUALQUER pergunta que a usuária fizer (mesmo somas ou perguntas livres respondidas pela IA),
 * se houver menção a algum item, categoria, cartão ou investimento na frase, a Luna leva até lá e destaca por 3s!
 */
function autoSpotlightFromAnyQuestion(norm) {
  ensureAllSlashInstallmentsSynced();
  

  // 1. Verifica mês mencionado
  let targetMonth = appState.currentMonth;
  for (const m of MONTH_ORDER) {
    if (norm.includes(m.toLowerCase()) || (m === 'MARÇO' && norm.includes('marco'))) {
      targetMonth = m;
      break;
    }
  }

  // 2. Verifica se mencionou Marcos ou Cartões
  if (/\b(marcos)\b/.test(norm)) {
    const cardsOut = appState.data.OUTUBRO.cartoes;
    const ids = [
      ...cardsOut.mercadopago.items.filter(i => i.isMarcos).map(i => i.id),
      ...cardsOut.nubank.items.filter(i => i.isMarcos).map(i => i.id)
    ];
    window.navigateToAndSpotlight({ view: 'cartoes', month: 'OUTUBRO', rowIds: ids, pointerLabel: '✨ Gastos do Marcos' });
    return;
  }

  // 3. Verifica todos os itens de Saídas e Entradas do mês alvo
  const mObj = appState.data[targetMonth];
  if (mObj) {
    const matchedSaidas = mObj.saidas.filter(s => {
      const base = s.referencia.toLowerCase().replace(/\s+\d+\/\d+$/, '').trim();
      return (base.length >= 3 && norm.includes(base)) || norm.includes(s.titulo.toLowerCase());
    });
    if (matchedSaidas.length > 0) {
      window.navigateToAndSpotlight({
        view: 'planilha',
        month: targetMonth,
        rowIds: matchedSaidas.map(s => s.id),
        pointerLabel: `✨ Destacado em ${targetMonth}`
      });
      return;
    }

    const matchedEntradas = mObj.entradas.filter(e => e.referencia.length >= 3 && norm.includes(e.referencia.toLowerCase()));
    if (matchedEntradas.length > 0) {
      window.navigateToAndSpotlight({
        view: 'planilha',
        month: targetMonth,
        rowIds: matchedEntradas.map(e => e.id),
        pointerLabel: `✨ Entrada em ${targetMonth}`
      });
      return;
    }
  }

  // 4. Verifica itens nos Cartões (Mercado Pago e Nubank)
  const cardsOut = appState.data.OUTUBRO.cartoes;
  const cardMatches = [
    ...cardsOut.mercadopago.items.filter(i => i.referencia.length >= 3 && norm.includes(i.referencia.toLowerCase())),
    ...cardsOut.nubank.items.filter(i => i.referencia.length >= 3 && norm.includes(i.referencia.toLowerCase()))
  ];
  if (cardMatches.length > 0) {
    window.navigateToAndSpotlight({
      view: 'cartoes',
      month: 'OUTUBRO',
      rowIds: cardMatches.map(i => i.id),
      pointerLabel: `✨ Destacado nos Cartões`
    });
    return;
  }

  // 5. Verifica caixinhas de investimento
  const invMatch = appState.data[appState.currentMonth].investimentos.find(inv => norm.includes(inv.nome.toLowerCase()));
  if (invMatch) {
    window.navigateToAndSpotlight({
      view: 'investimentos',
      month: appState.currentMonth,
      rowId: `daily_${invMatch.id}`,
      pointerLabel: `✨ Investimento: ${invMatch.nome.toUpperCase()}`
    });
  }
}

/**
 * Responde com 100% de precisão qualquer pergunta sobre compras parceladas (itens com "/")
 * Ex: "quantas parcelas faltam da viagem rj? a primeira de outubro ja paguei", "quando acaba a viagem?", "quais compras estão parceladas?"
 */
function trySolveInstallmentQuestion(norm) {
  // Primeiro verifica se a usuária pediu para mostrar/localizar uma parcela específica (ex: "onde está a 4/6 da viagem rj")
  const directLocate = tryLocateAndSpotlightRequestedItem(norm);
  if (directLocate) return directLocate;

  // Aceita inclusive erros de digitação como "parclas", "parcels", "parcela", ou perguntas sobre quando acaba/termina viagem/chapinha/shein
  const mentionsInstallmentWord = /(parcela|parcelas|parcla|parclas|parcelado|parcelados|vezes|\d+\/\d+)/.test(norm);
  const mentionsEndingWord = /(quantas\s+faltam|quanto\s+falta|quando\s+acaba|quando\s+termina|at[eé]\s+quando|faltam\s+quantas|ja\s+paguei)/.test(norm);

  ensureAllSlashInstallmentsSynced();
  
  const groups = analyzeAllInstallmentsData(appState.currentMonth);
  const groupKeys = Object.keys(groups);

  // Verifica se o usuário mencionou o nome de alguma compra parcelada específica (ex: "viagem rj", "viagem", "chapinha", "shein")
  const matchedGroupKey = groupKeys.find(k => norm.includes(k) || (k.includes('viagem') && norm.includes('viagem')));

  if (!mentionsInstallmentWord && !(mentionsEndingWord && matchedGroupKey)) {
    return null;
  }

  // Se perguntou sobre uma compra parcelada específica (ex: "viagem rj", "chapinha", "shein")
  if (matchedGroupKey) {
    const g = groups[matchedGroupKey];
    const lastEntry = g.timeline[g.timeline.length - 1];
    const currentOrFirst = g.timeline.find(t => t.month === appState.currentMonth) || g.timeline[0];

    // Sempre leva até a parcela relevante e destaca por 3 segundos!
    if (/(quando\s+acaba|quando\s+termina|at[eé]\s+quando|[uú]ltima)/.test(norm) && lastEntry) {
      window.navigateToAndSpotlight({
        view: 'planilha',
        month: lastEntry.month,
        rowId: lastEntry.id,
        pointerLabel: `✨ Última Parcela: ${lastEntry.ref.toUpperCase()} (${lastEntry.month})`
      });
    } else if (currentOrFirst) {
      window.navigateToAndSpotlight({
        view: 'planilha',
        month: currentOrFirst.month,
        rowId: currentOrFirst.id,
        pointerLabel: `✨ ${currentOrFirst.ref.toUpperCase()} (${currentOrFirst.month})`
      });
    }

    const futureListHtml = g.futureTimeline.length > 0
      ? g.futureTimeline.map(t =>
          `• <strong>${t.month}:</strong> ${escapeHtml(t.ref)} — <strong>${formatBRL(t.valor)}</strong> (dia ${t.data}) ` +
          `<button type="button" class="btn-mini-deduct" style="padding:1px 7px;font-size:0.68rem;margin-left:4px;" onclick="navigateToAndSpotlight({view:'planilha',month:'${t.month}',rowId:'${t.id}',pointerLabel:'✨ ${escapeHtml(t.ref.toUpperCase())} (${t.month})'})">🔍 Ver lá</button>`
        ).join('<br>')
      : `• 🎉 <strong>Nenhuma!</strong> Essa compra já termina agora em <strong>${g.endMonth}</strong>!`;

    const speechText = g.remainingParcelsCount > 0
      ? `Miga, conferi tudinho aqui! Da ${g.baseName}, contando que a parcela ${g.highestParcelPaid} de ${g.totalParcels} de ${appState.currentMonth.toLowerCase()} já foi paga, faltam exatamente ${g.remainingParcelsCount} parcelas de ${formatBRL(g.valorParcela)}, somando ${formatBRL(g.remainingValorTotal)} restantes! Ela vai de novembro até terminar na parcela ${g.totalParcels} de ${g.totalParcels} em ${g.endMonth.toLowerCase()}!`
      : `Miga, notícia maravilhosa! A última parcela de ${g.baseName} (${g.totalParcels} de ${g.totalParcels}) já acaba agora em ${g.endMonth.toLowerCase()}, então não falta mais nenhuma pros próximos meses!`;

    return {
      badge: `Parcelas: ${g.baseName.toUpperCase()} (${g.highestParcelPaid}/${g.totalParcels}) 💳`,
      html: `
        Miga, olhei todas as suas planilhas até <strong>${g.endMonth}</strong> e fiz a conta exata de <strong>${escapeHtml(g.baseName)}</strong>! 💅✨<br><br>
        • <strong>Parcela de ${appState.currentMonth} (já considerada):</strong> <strong>${g.highestParcelPaid}/${g.totalParcels}</strong> (${formatBRL(g.valorParcela)})<br>
        • <strong>Quantas parcelas ainda faltam:</strong> Faltam <strong>${g.remainingParcelsCount} parcelas</strong>!<br>
        • <strong>Valor total que falta pagar:</strong> <strong>${formatBRL(g.remainingValorTotal)}</strong> (${g.remainingParcelsCount}x de ${formatBRL(g.valorParcela)})<br>
        • <strong>Quando termina:</strong> Na parcela <strong>${g.totalParcels}/${g.totalParcels} em ${g.endMonth}</strong>!<br><br>
        📅 <strong>Cronograma das parcelas que faltam (clique em "🔍 Ver lá" pra eu te levar até ela):</strong><br>
        ${futureListHtml}
      `,
      speech: speechText
    };
  }

  // Se perguntou de forma geral sobre todas as compras parceladas ("quais compras estão parceladas?", "quando acabam minhas parcelas?")
  if (groupKeys.length > 0) {
    const summaryBlocks = Object.values(groups).map(g => {
      const statusStr = g.remainingParcelsCount > 0
        ? `Faltam <strong>${g.remainingParcelsCount} parcelas</strong> (total restante: <strong>${formatBRL(g.remainingValorTotal)}</strong>) ➔ <strong>Termina em ${g.endMonth}</strong>`
        : `🎉 <strong>Acaba agora em ${g.endMonth}!</strong> (0 parcelas restantes)`;
      return `• <strong>${escapeHtml(g.baseName)} (${g.highestParcelPaid}/${g.totalParcels} em ${appState.currentMonth} — ${formatBRL(g.valorParcela)}/mês):</strong><br>&nbsp;&nbsp;${statusStr}`;
    });

    return {
      badge: 'Raio-X de Todas as Parcelas ("/") 💳',
      html: `
        Miga, rastreei tudo que tem <strong>"/" (parcelado)</strong> na sua planilha de <strong>Outubro até Março</strong>! Olha quando cada uma termina: 💖✨<br><br>
        ${summaryBlocks.join('<br><br>')}
      `,
      speech: `Miga, rastreei todas as suas compras parceladas! A Shein termina agora em outubro na parcela 4 de 4. A chapinha está na 9 de 10 em outubro e termina em novembro. Já a viagem pro Rio está na 1 de 6 em outubro, então faltam 5 parcelas e ela termina em março!`
    };
  }

  return null;
}

function buildFullSpreadsheetContextForAI() {
  ensureAllSlashInstallmentsSynced();
  
  const lines = [];
  lines.push(`MÊS ATUALMENTE SELECIONADO NA TELA: ${appState.currentMonth}`);
  lines.push(`ABA ATUALMENTE ABERTA: ${appState.currentView}`);
  lines.push('');

  const instGroups = analyzeAllInstallmentsData(appState.currentMonth);
  lines.push(`=== RELATÓRIO DE COMPRAS PARCELADAS (TUDO QUE TEM "/" É PARCELADO) ===`);
  Object.values(instGroups).forEach(g => {
    lines.push(`• Compra Parcelada "${g.baseName}": Total de ${g.totalParcels} parcelas de ${formatBRL(g.valorParcela)} cada. Em ${appState.currentMonth} está na parcela ${g.highestParcelPaid}/${g.totalParcels}. Faltam ${g.remainingParcelsCount} parcelas após ${appState.currentMonth} (Restante a pagar: ${formatBRL(g.remainingValorTotal)}). TERMINA EM: ${g.endMonth}! Cronograma: ${g.timeline.map(t => `${t.month}=${t.ref}`).join(', ')}`);
  });
  lines.push('');

  const crossMonthTotals = {
    OUT_NOV_DEZ: { entradas: 0, saidas: 0, fatura: 0, contas: 0, parcelado: 0, uber: 0, compras: 0, faturaMP: 0, faturaNubank: 0 },
    TODOS_MESES: { entradas: 0, saidas: 0, fatura: 0, contas: 0, parcelado: 0, uber: 0, compras: 0 }
  };

  MONTH_ORDER.forEach((mName) => {
    const mObj = appState.data[mName];
    const fin = calculateCascadingFinancials(mName);
    const byCat = { fatura: 0, contas: 0, parcelado: 0, uber: 0, compras: 0 };
    let fatMP = 0;
    let fatNu = 0;

    mObj.saidas.forEach(s => {
      const c = (s.titulo || 'outros').toLowerCase().trim();
      byCat[c] = (byCat[c] || 0) + (Number(s.valor) || 0);
      if (s.referencia.toLowerCase().includes('mercado pago')) fatMP += Number(s.valor) || 0;
      if (s.referencia.toLowerCase().includes('nubank')) fatNu += Number(s.valor) || 0;
    });

    if (['OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'].includes(mName)) {
      crossMonthTotals.OUT_NOV_DEZ.entradas += fin.totalEntradas;
      crossMonthTotals.OUT_NOV_DEZ.saidas += fin.totalSaidas;
      crossMonthTotals.OUT_NOV_DEZ.fatura += byCat.fatura || 0;
      crossMonthTotals.OUT_NOV_DEZ.contas += byCat.contas || 0;
      crossMonthTotals.OUT_NOV_DEZ.parcelado += byCat.parcelado || 0;
      crossMonthTotals.OUT_NOV_DEZ.uber += byCat.uber || 0;
      crossMonthTotals.OUT_NOV_DEZ.compras += byCat.compras || 0;
      crossMonthTotals.OUT_NOV_DEZ.faturaMP += fatMP;
      crossMonthTotals.OUT_NOV_DEZ.faturaNubank += fatNu;
    }

    crossMonthTotals.TODOS_MESES.entradas += fin.totalEntradas;
    crossMonthTotals.TODOS_MESES.saidas += fin.totalSaidas;
    crossMonthTotals.TODOS_MESES.fatura += byCat.fatura || 0;
    crossMonthTotals.TODOS_MESES.contas += byCat.contas || 0;
    crossMonthTotals.TODOS_MESES.parcelado += byCat.parcelado || 0;
    crossMonthTotals.TODOS_MESES.uber += byCat.uber || 0;
    crossMonthTotals.TODOS_MESES.compras += byCat.compras || 0;

    lines.push(`=== PLANILHA DE ${mName} ===`);
    lines.push(`• Total de Entradas (${mName}): ${formatBRL(fin.totalEntradas)}`);
    lines.push(`  Itens de Entrada: ${mObj.entradas.map(e => `${e.referencia}: ${formatBRL(e.valor)}`).join(' | ') || 'Nenhum'}`);
    lines.push(`• Total de Saídas/Gastos (${mName}): ${formatBRL(fin.totalSaidas)}`);
    lines.push(`• Saldo/Fluxo do Mês (${mName}): ${formatBRL(fin.fluxoMesAtual)} (${fin.fluxoMesAtual < 0 ? 'Negativo: precisa tirar do investimento' : 'Positivo: sobra dinheiro'})`);
    lines.push(`• Investimento Líquido ao fim de ${mName}: ${formatBRL(fin.investimentoLiquidoFimMes)}`);
    lines.push(`• Somas por Categoria (Tabela Dinâmica de ${mName}): Faturas=${formatBRL(byCat.fatura || 0)} (sendo Mercado Pago=${formatBRL(fatMP)} e Nubank=${formatBRL(fatNu)}), Contas=${formatBRL(byCat.contas || 0)}, Parcelado=${formatBRL(byCat.parcelado || 0)}, Uber/Passes=${formatBRL(byCat.uber || 0)}, Compras=${formatBRL(byCat.compras || 0)}`);
    lines.push(`  Todos os Itens de Saída de ${mName}: ${mObj.saidas.map(s => `[Dia ${s.data}] ${s.referencia} (${s.titulo}): ${formatBRL(s.valor)}`).join(' | ')}`);
    lines.push('');
  });

  lines.push(`=== SOMAS CONSOLIDADAS DE OUTUBRO ATÉ DEZEMBRO (OUTUBRO + NOVEMBRO + DEZEMBRO) ===`);
  lines.push(`• Soma de TODAS as Faturas (Outubro + Novembro + Dezembro): ${formatBRL(crossMonthTotals.OUT_NOV_DEZ.fatura)} (Outubro R$ 0,00 + Novembro R$ 0,00 + Dezembro R$ 0,00)`);
  lines.push(`  - Soma só Fatura Mercado Pago (Out+Nov+Dez): ${formatBRL(crossMonthTotals.OUT_NOV_DEZ.faturaMP)}`);
  lines.push(`  - Soma só Fatura Nubank (Out+Nov+Dez): ${formatBRL(crossMonthTotals.OUT_NOV_DEZ.faturaNubank)}`);
  lines.push(`• Soma de TODAS as Entradas (Out+Nov+Dez): ${formatBRL(crossMonthTotals.OUT_NOV_DEZ.entradas)}`);
  lines.push(`• Soma de TODOS os Gastos/Saídas (Out+Nov+Dez): ${formatBRL(crossMonthTotals.OUT_NOV_DEZ.saidas)}`);
  lines.push(`• Soma de Contas (Out+Nov+Dez): ${formatBRL(crossMonthTotals.OUT_NOV_DEZ.contas)}`);
  lines.push(`• Soma de Parcelados (Out+Nov+Dez): ${formatBRL(crossMonthTotals.OUT_NOV_DEZ.parcelado)}`);
  lines.push(`• Soma de Uber/Passes (Out+Nov+Dez): ${formatBRL(crossMonthTotals.OUT_NOV_DEZ.uber)}`);
  lines.push(`• Soma de Compras (Out+Nov+Dez): ${formatBRL(crossMonthTotals.OUT_NOV_DEZ.compras)}`);
  lines.push('');

  const cardTotalsOut = calculateCardTotals('OUTUBRO');
  const mpItemsStr = appState.data.OUTUBRO.cartoes.mercadopago.items
    .map(i => `[Dia ${i.data}] ${i.referencia} (${i.titulo}): ${formatBRL(i.valor)}${i.isMarcos ? ' [MARCOS]' : ' [MEU]'}`)
    .join(' | ');
  const nuItemsStr = appState.data.OUTUBRO.cartoes.nubank.items
    .map(i => `[Dia ${i.data}] ${i.referencia} (${i.titulo}): ${formatBRL(i.valor)}${i.isMarcos ? ' [MARCOS]' : ' [MEU]'}`)
    .join(' | ');

  lines.push(`=== PLANILHA DE CARTÕES DE CRÉDITO (GASTOS EM OUTUBRO -> PAGOS EM NOVEMBRO) ===`);
  lines.push(`• Crédito MERCADO PAGO: Parcelas Anteriores=${formatBRL(cardTotalsOut.mp.parcelasAnteriores)}, Total Gasto no Mês=${formatBRL(cardTotalsOut.mp.gastoMes)}, Parte do Marcos=${formatBRL(cardTotalsOut.mp.marcos)}, Parte Minha=${formatBRL(cardTotalsOut.mp.meu)}, Fatura Final=${formatBRL(cardTotalsOut.mp.faturaFinal)}`);
  lines.push(`  Itens do Cartão Mercado Pago: ${mpItemsStr}`);
  lines.push(`• Crédito NUBANK: Parcelas Anteriores=${formatBRL(cardTotalsOut.nu.parcelasAnteriores)}, Total Gasto no Mês=${formatBRL(cardTotalsOut.nu.gastoMes)}, Parte do Marcos=${formatBRL(cardTotalsOut.nu.marcos)}, Parte Minha=${formatBRL(cardTotalsOut.nu.meu)}, Fatura Final=${formatBRL(cardTotalsOut.nu.faturaFinal)}`);
  lines.push(`  Itens do Cartão Nubank: ${nuItemsStr}`);
  lines.push(`• Total Marcos somando os 2 cartões (vai p/ Entrada de Novembro): ${formatBRL(cardTotalsOut.totalMarcos)} (${formatBRL(cardTotalsOut.mp.marcos)} MP + ${formatBRL(cardTotalsOut.nu.marcos)} Nubank)`);
  lines.push('');

  const yields = calculateYieldMetrics();
  lines.push(`=== INVESTIMENTOS E RENDIMENTOS ===`);
  appState.data[appState.currentMonth].investimentos.forEach(inv => {
    const ym = yields.perInvestment[inv.nome] || { dia: 0, semana: 0, mes: 0 };
    lines.push(`• ${inv.nome}: Saldo Atual=${formatBRL(inv.valor)} (Anterior=${formatBRL(inv.valorAnterior || inv.valor)}) | Rendeu Dia=${formatSignedBRL(ym.dia)}, Semana=${formatSignedBRL(ym.semana)}, Mês=${formatSignedBRL(ym.mes)}`);
  });
  lines.push(`• SOMA DE TODOS OS INVESTIMENTOS: Patrimônio Bruto=${formatBRL(appState.data[appState.currentMonth].investimentos.reduce((a,b)=>a+b.valor,0))} | Rendeu Dia=${formatSignedBRL(yields.sumDia)}, Semana=${formatSignedBRL(yields.sumSemana)}, Mês=${formatSignedBRL(yields.sumMes)}`);
  lines.push('');

  const repTimeline = calculateFullReplenishmentTimeline();
  lines.push(`=== CONTROLE AUTOMÁTICO DE REPOSIÇÃO DO INVESTIMENTO (QUANTO TIROU, QUANTO FALTA REPOR E O QUE VIRA NOVO INVESTIMENTO) ===`);
  lines.push(`REGRA: Quando o mês fica negativo (ex: Outubro R$ 0,00 e Novembro R$ 0,00), esse valor é retirado do investimento e somado na conta "Falta Repor" (R$ 0,00 + R$ 0,00 = R$ 0,00). Quando o mês fica positivo (ex: Dezembro R$ 0,00), toda a sobra vai PRIMEIRO para devolver/repor o que tirou do investimento. Se em algum mês sobrar mais do que deve ao investimento (ex: se sobrar R$ 0,00 devendo R$ 0,00), devolve R$ 0,00 para quitar 100% da reposição e o restante (R$ 0,00) entra como NOVO INVESTIMENTO!`);
  MONTH_ORDER.forEach(mName => {
    const t = repTimeline[mName];
    lines.push(`• ${mName}: Saldo do Mês=${formatBRL(t.fluxoMesAtual)} | Retirado do Inv. no mês=${formatBRL(t.retiradoNoMes)} | Devolvido p/ Repor no mês=${formatBRL(t.devolvidoNoMes)} | Falta Repor Acumulado ao fim de ${mName}=${formatBRL(t.faltaReporFimMes)} | Sobra p/ Novo Investimento em ${mName}=${formatBRL(t.novoInvestimentoNoMes)}`);
  });

  return lines.join('\n');
}

/**
 * Responde com 100% de precisão qualquer pergunta sobre:
 * - Quanto já tirou do investimento (Outubro R$ 0,00 + Novembro R$ 0,00 = R$ 0,00)
 * - Quanto falta repor pro investimento
 * - Como funciona a devolução automática em Dezembro (R$ 0,00 devolvidos -> falta repor R$ 0,00)
 * - Simulações do tipo "e se sobrasse 2000 em dezembro?" (devolve os R$ 0,00 pro investimento e investe os R$ 0,00 restantes!)
 */
function trySolveReplenishmentQuestion(norm) {
  const isRepQuestion = /(repor|reposi[cç][aã]o|devolv|tirei\s+do\s+investimento|tirar\s+do\s+investimento|quanto\s+tirei|quanto\s+falta\s+repor|devo\s+pro\s+investimento|devo\s+ao\s+investimento|sobrasse|se\s+sobrar)/.test(norm);
  if (!isRepQuestion) return null;

  window.navigateToAndSpotlight({
    view: 'planilha',
    month: appState.currentMonth,
    selector: '#replenishTrackerBox',
    pointerLabel: '✨ Controle de Reposição do Investimento'
  });

  const rep = calculateFullReplenishmentTimeline();
  const outT = rep['OUTUBRO'];
  const novT = rep['NOVEMBRO'];
  const dezT = rep['DEZEMBRO'];
  const janT = rep['JANEIRO'];

  const totalRetiradoOutNov = Number((outT.retiradoNoMes + novT.retiradoNoMes).toFixed(2));

  // Verifica se a usuária perguntou uma simulação "se sobrasse X" (ex: "se sobrasse 2000", "se sobrar 1500")
  const hypotheticalMatch = norm.match(/(?:sobrasse|sobrar)\s+(?:r\$\s*)?(\d{1,6}(?:[.,]\d{1,2})?)/);
  if (hypotheticalMatch) {
    const hypVal = parseFloat(hypotheticalMatch[1].replace(/\./g, '').replace(',', '.'));
    if (!isNaN(hypVal) && hypVal > 0) {
      const dividaAntesDez = novT.faltaReporFimMes; // R$ 0,00
      const devolvido = Number(Math.min(hypVal, dividaAntesDez).toFixed(2));
      const faltaDepois = Number(Math.max(0, dividaAntesDez - devolvido).toFixed(2));
      const novoInv = Number(Math.max(0, hypVal - devolvido).toFixed(2));

      return {
        badge: `Simulação de Sobra: ${formatBRL(hypVal)} 🔄`,
        html: `
          Miga, já reconheci e calculei essa regra certinho pra você! Olha como fica se sobrar <strong>${formatBRL(hypVal)}</strong> em Dezembro: 💅✨<br><br>
          1. 🔻 <strong>Total que você tirou do investimento (Outubro + Novembro):</strong><br>
             • Outubro (<strong>${formatBRL(outT.retiradoNoMes)}</strong>) + Novembro (<strong>${formatBRL(novT.retiradoNoMes)}</strong>) = <strong>${formatBRL(dividaAntesDez)}</strong> a repor.<br><br>
          2. 🔄 <strong>Devolução Automática pro Investimento:</strong><br>
             • Dos <strong>${formatBRL(hypVal)}</strong> que sobraram, <strong>${formatBRL(devolvido)}</strong> vão direto pra <strong>devolver tudo o que você tirou do investimento</strong> (Falta Repor cai para <strong>${formatBRL(faltaDepois)}</strong>!).<br><br>
          3. 🟢 <strong>O que sobra vira Novo Investimento:</strong><br>
             • Os <strong>+${formatBRL(novoInv)}</strong> que sobraram além da dívida entram como <strong>Novo Dinheiro Investido</strong>! 🎉
        `,
        speech: `Miga, reconheci tudinho! Como você tirou ${formatBRL(outT.retiradoNoMes)} em outubro e ${formatBRL(novT.retiradoNoMes)} em novembro, o total a repor é ${formatBRL(dividaAntesDez)}. Se sobrar ${formatBRL(hypVal)}, a planilha devolve automaticamente os ${formatBRL(devolvido)} pro seu investimento, quitando cem por cento da reposição, e os ${formatBRL(novoInv)} que sobram entram como investimento novo!`
      };
    }
  }

  return {
    badge: 'Controle de Reposição do Investimento 🔄',
    html: `
      Miga, já deixei todo o controle de <strong>Reposição do Investimento</strong> automatizado pra você! Olha a conta exata: 💅✨<br><br>
      🔻 <strong>1. Quanto você precisou tirar (Outubro + Novembro):</strong><br>
      • <strong>Outubro:</strong> Tirou <strong>${formatBRL(outT.retiradoNoMes)}</strong><br>
      • <strong>Novembro:</strong> Precisa tirar <strong>${formatBRL(novT.retiradoNoMes)}</strong><br>
      • <strong>Soma Total a Repor:</strong> <strong>${formatBRL(totalRetiradoOutNov)}</strong> (${formatBRL(outT.retiradoNoMes)} + ${formatBRL(novT.retiradoNoMes)})<br><br>
      🔄 <strong>2. Devolução Automática em Dezembro (Mês Positivo!):</strong><br>
      • Em <strong>Dezembro</strong>, você fica positiva em <strong>+${formatBRL(dezT.fluxoMesAtual)}</strong>!<br>
      • A planilha já <strong>devolve automaticamente esses +${formatBRL(dezT.devolvidoNoMes)}</strong> pro seu investimento!<br>
      • Com isso, o que falta repor cai de ${formatBRL(totalRetiradoOutNov)} para apenas <strong>${formatBRL(dezT.faltaReporFimMes)}</strong>!<br><br>
      🎉 <strong>3. Quando quitar 100% (ou se sobrar R$ 2.000):</strong><br>
      • Em <strong>Janeiro</strong> (ou se entrar uma sobra maior, tipo <strong>R$ 0,00</strong>), o sistema devolve primeiro os <strong>${formatBRL(dezT.faltaReporFimMes)}</strong> restantes pra zerar a dívida com o investimento (<strong>Falta Repor = R$ 0,00</strong>) e tudo o que passar disso entra como <strong>Novo Investimento</strong>!
    `,
    speech: `Miga, já deixei tudo automatizado! Somando os ${formatBRL(outT.retiradoNoMes)} que você tirou em outubro com os ${formatBRL(novT.retiradoNoMes)} de novembro, você acumula ${formatBRL(totalRetiradoOutNov)} para repor pro investimento. Em dezembro, como você já fica positiva em ${formatBRL(dezT.fluxoMesAtual)}, todo esse valor é devolvido automaticamente pro investimento, reduzindo o que falta repor para ${formatBRL(dezT.faltaReporFimMes)}! E quando a sobra superar o que você deve, ele quita tudo o que falta repor primeiro e só o que sobrar além disso vira novo investimento!`
  };
}

/**
 * Calculadora Analítica Local Instantânea:
 * Se o usuário pedir somas entre meses (ex: "soma as faturas de outubro até dezembro", "quanto gastei de uber nos 3 meses",
 * "soma as entradas de outubro e novembro", etc.), calcula com 100% de precisão matemática na hora!
 */
function trySolveAnalyticalMathQuestion(norm) {
  const monthRes = resolveTargetMonthsFromText(norm);
  let targetMonths = monthRes.explicit ? monthRes.months : [];

  if (/(outubro\s+(?:at[eé]|a)\s+dezembro|tr[eê]s\s+meses|3\s+meses)/.test(norm) && !/\b2027\b/.test(norm)) {
    targetMonths = ['OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
  }

  const isSumOrTotalQuestion = /(soma|somar|somando|total|quanto\s+d[aá]|quanto\s+gastei|quanto\s+recebi|quanto\s+foi|qual\s+o\s+valor|juntando)/.test(norm);
  if (!isSumOrTotalQuestion) return null;

  // Se perguntou especificamente sobre SOMA DE FATURAS entre meses (ex: "soma as faturas de outubro até dezembro" ou "soma todas as faturas")
  if (/(fatura|faturas)/.test(norm)) {
    const monthsToSum = targetMonths.length >= 1 ? targetMonths : ['OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
    let totalFaturas = 0;
    let totalMP = 0;
    let totalNu = 0;
    const breakdown = [];

    monthsToSum.forEach(m => {
      const mSaidas = appState.data[m].saidas.filter(s => s.titulo.toLowerCase() === 'fatura');
      const sumM = mSaidas.reduce((a, b) => a + b.valor, 0);
      const mpM = mSaidas.filter(s => s.referencia.toLowerCase().includes('mercado pago')).reduce((a, b) => a + b.valor, 0);
      const nuM = mSaidas.filter(s => s.referencia.toLowerCase().includes('nubank')).reduce((a, b) => a + b.valor, 0);
      totalFaturas += sumM;
      totalMP += mpM;
      totalNu += nuM;
      breakdown.push(`• <strong>${m}:</strong> ${formatBRL(sumM)} <em>(Mercado Pago: ${formatBRL(mpM)} + Nubank: ${formatBRL(nuM)})</em>`);
    });

    const mesesStr = monthsToSum.join(', ');
    return {
      badge: `Soma das Faturas (${monthsToSum.length} meses) 💳`,
      html: `
        Miga, fiz a conta na ponta do lápis pra você! 💅✨<br><br>
        Somando as faturas de <strong>${mesesStr}</strong>, o total geral dá <strong>${formatBRL(totalFaturas)}</strong>! Olha o detalhamento mês a mês:<br><br>
        ${breakdown.join('<br>')}<br><br>
        📊 <strong>Separado por Cartão nesse período:</strong><br>
        • Só <strong>Mercado Pago</strong>: <strong>${formatBRL(totalMP)}</strong><br>
        • Só <strong>Nubank</strong>: <strong>${formatBRL(totalNu)}</strong><br>
        • <strong>Soma Total Geral:</strong> <strong>${formatBRL(totalFaturas)}</strong>
      `,
      speech: `Miga, somei tudinho aqui pra você! Juntando as faturas de ${mesesStr.toLowerCase()}, o total dá ${formatBRL(totalFaturas)}! Sendo ${formatBRL(totalMP)} do Mercado Pago e ${formatBRL(totalNu)} do Nubank.`
    };
  }

  // Se perguntou soma de qualquer categoria (uber, contas, parcelado, compras, entradas ou todos os gastos) em múltiplos meses
  if (targetMonths.length >= 2) {
    let targetType = 'saidas';
    let catFilter = null;
    let label = 'Todos os Gastos';

    if (/(entrada|entradas|recebi|sal[aá]rio)/.test(norm)) {
      targetType = 'entradas';
      label = 'Todas as Entradas';
    } else if (/(uber|passagem|passes|transporte)/.test(norm)) {
      catFilter = 'uber';
      label = 'Uber e Passes';
    } else if (/(conta|contas|faculdade|[aá]gua|internet)/.test(norm)) {
      catFilter = 'contas';
      label = 'Contas Fixas';
    } else if (/(parcela|parcelado|parcelados)/.test(norm)) {
      catFilter = 'parcelado';
      label = 'Compras Parceladas';
    } else if (/(compras|sobrancelha)/.test(norm)) {
      catFilter = 'compras';
      label = 'Compras';
    }

    let grandTotal = 0;
    const breakdown = [];

    targetMonths.forEach(m => {
      let sumM = 0;
      if (targetType === 'entradas') {
        sumM = appState.data[m].entradas.reduce((a, b) => a + b.valor, 0);
      } else if (catFilter) {
        sumM = appState.data[m].saidas.filter(s => s.titulo.toLowerCase() === catFilter).reduce((a, b) => a + b.valor, 0);
      } else {
        sumM = appState.data[m].saidas.reduce((a, b) => a + b.valor, 0);
      }
      grandTotal += sumM;
      breakdown.push(`• <strong>${m}:</strong> ${formatBRL(sumM)}`);
    });

        const mesesStr = targetMonths.join(', ');
    return {
      badge: `Soma: ${label} ðŸ“Š`,
      html: `
        Miga, calculei tudinho pra vocÃª! ðŸ’–<br><br>
        A soma de <strong>${label}</strong> nos meses de <strong>${mesesStr}</strong> dÃ¡ exatamente <strong>${formatBRL(grandTotal)}</strong>!<br><br>
        ${breakdown.join('<br>')}<br><br>
        ðŸ† <strong>Total Acumulado:</strong> <strong>${formatBRL(grandTotal)}</strong>
      `,
      speech: `Miga, fiz a conta! Somando ${label} de ${mesesStr.toLowerCase()}, dÃ¡ exatamente ${formatBRL(grandTotal)}!`
    };
  }

  // Se perguntou quanto gastou/recebeu em um ÃšNICO mÃªs (ou "esse mÃªs" / mÃªs atual selecionado)
  const singleMonth = targetMonths.length === 1 ? targetMonths[0] : appState.currentMonth;
  const mObj = appState.data[singleMonth];

  if (mObj) {
    // 1. PASSAGEM (ex: "quanto eu gastei com passagem esse mes?", "quanto foi de passagem?", "passagem")
    if (/(passagem|passagens|passe|passes|bilhete)/.test(norm)) {
      const items = mObj.saidas.filter(s => s.referencia.toLowerCase().includes('passagem') || s.referencia.toLowerCase().includes('passe'));
      if (items.length > 0) {
        const sumPassagem = items.reduce((a, b) => a + (Number(b.valor) || 0), 0);
        const rowIds = items.map(i => i.id);
        window.navigateToAndSpotlight({
          view: 'planilha',
          month: singleMonth,
          rowIds,
          pointerLabel: `âœ¨ Passagens: ${formatBRL(sumPassagem)}`
        });
        return {
          badge: `Passagens em ${singleMonth} ðŸšŒ`,
          html: `
            Miga, fiz a soma na pontinha do lÃ¡pis pra vocÃª! ðŸ’…âœ¨<br><br>
            Em <strong>${singleMonth}</strong>, vocÃª teve <strong>${items.length} lanÃ§amentos de passagem</strong>, totalizando <strong>${formatBRL(sumPassagem)}</strong>!<br><br>
            ðŸ’¡ <em>JÃ¡ deixei todas as ${items.length} linhas piscando em destaque na planilha pra vocÃª dar uma olhadinha! ðŸ’–</em>
          `,
          speech: `Miga, fiz a conta certinha pra vocÃª! Em ${singleMonth.toLowerCase()}, vocÃª teve ${items.length} passagens que somaram ${formatBRL(sumPassagem)} no total! JÃ¡ deixei destacado na planilha pra vocÃª!`
        };
      }
    }

    // 2. UBER (ex: "quanto gastei de uber esse mes?")
    if (/(uber|99|t[aÃ¡]xi|corrida)/.test(norm) && !/(passagem)/.test(norm)) {
      const items = mObj.saidas.filter(s => s.titulo.toLowerCase() === 'uber');
      if (items.length > 0) {
        const sumUber = items.reduce((a, b) => a + (Number(b.valor) || 0), 0);
        const rowIds = items.map(i => i.id);
        window.navigateToAndSpotlight({
          view: 'planilha',
          month: singleMonth,
          rowIds,
          pointerLabel: `âœ¨ Uber: ${formatBRL(sumUber)}`
        });
        return {
          badge: `Uber em ${singleMonth} ðŸš—`,
          html: `
            Miga, calculei tudinho do seu Uber em <strong>${singleMonth}</strong>! ðŸš—ðŸ’¨<br><br>
            A categoria Uber inteira no mÃªs deu <strong>${formatBRL(sumUber)}</strong> (${items.length} lanÃ§amentos).<br><br>
            JÃ¡ deixei tudo piscando na sua planilha pra vocÃª conferir! ðŸ’–
          `,
          speech: `Miga, calculei! Seus gastos com Uber em ${singleMonth.toLowerCase()} somaram ${formatBRL(sumUber)} no total!`
        };
      }
    }

    // 3. FACULDADE (ex: "quanto gastei com faculdade?")
    if (/(faculdade|facul|adm|pedagogia)/.test(norm)) {
      const items = mObj.saidas.filter(s => s.referencia.toLowerCase().includes('faculdade'));
      if (items.length > 0) {
        const sumFacul = items.reduce((a, b) => a + (Number(b.valor) || 0), 0);
        const rowIds = items.map(i => i.id);
        const breakdown = items.map(i => `â€¢ <strong>${escapeHtml(i.referencia)}:</strong> ${formatBRL(i.valor)} (Dia ${i.data})`);
        window.navigateToAndSpotlight({
          view: 'planilha',
          month: singleMonth,
          rowIds,
          pointerLabel: `âœ¨ Faculdade: ${formatBRL(sumFacul)}`
        });
        return {
          badge: `Faculdade em ${singleMonth} ðŸŽ“`,
          html: `
            Miga, fiz as contas das suas faculdades em <strong>${singleMonth}</strong>! ðŸŽ“âœ¨<br><br>
            ${breakdown.join('<br>')}<br><br>
            ðŸ† <strong>Total das Faculdades:</strong> <strong>${formatBRL(sumFacul)}</strong>!
          `,
          speech: `Miga, suas faculdades em ${singleMonth.toLowerCase()} somam ${formatBRL(sumFacul)} no total!`
        };
      }
    }

    // 4. Qualquer outra categoria no mÃªs (compras, contas, parcelado, faturas)
    let singleCat = null;
    let singleLabel = null;
    if (/(fatura|faturas|cart[aÃ£]o)/.test(norm)) {
      singleCat = 'fatura';
      singleLabel = 'Faturas de CartÃ£o';
    } else if (/(conta|contas|fixa|fixas)/.test(norm)) {
      singleCat = 'contas';
      singleLabel = 'Contas Fixas';
    } else if (/(parcela|parcelado|parcelados)/.test(norm)) {
      singleCat = 'parcelado';
      singleLabel = 'Compras Parceladas';
    } else if (/(compra|compras)/.test(norm)) {
      singleCat = 'compras';
      singleLabel = 'Compras do MÃªs';
    }

    if (singleCat) {
      const items = mObj.saidas.filter(s => s.titulo.toLowerCase() === singleCat);
      const sumCat = items.reduce((a, b) => a + (Number(b.valor) || 0), 0);
      const rowIds = items.map(i => i.id);
      window.navigateToAndSpotlight({
        view: 'planilha',
        month: singleMonth,
        rowIds,
        pointerLabel: `âœ¨ ${singleLabel}: ${formatBRL(sumCat)}`
      });
      return {
        badge: `${singleLabel} em ${singleMonth} ðŸ“Š`,
        html: `
          Miga, somei tudinho aqui pra vocÃª! ðŸ’…âœ¨<br><br>
          Seus gastos com <strong>${singleLabel}</strong> em <strong>${singleMonth}</strong> deram <strong>${formatBRL(sumCat)}</strong>!<br><br>
          DÃ¡ uma olhadinha que jÃ¡ deixei destacado na planilha pra vocÃª! ðŸ’–
        `,
        speech: `Miga, seus gastos com ${singleLabel.toLowerCase()} em ${singleMonth.toLowerCase()} deram ${formatBRL(sumCat)} no total!`
      };
    }

    // 5. Total de Gastos
    if (/(quanto\s+(?:eu\s+)?gastei|total\s+de\s+gastos|todos\s+os\s+gastos|todas\s+as\s+sa[iÃ­]das)/.test(norm) && !/(recebi|ganhei|entrada)/.test(norm)) {
      const finMonth = calculateCascadingFinancials(singleMonth);
      return {
        badge: `Total de Gastos em ${singleMonth} ðŸ§¾`,
        html: `
          Miga, peguei o fechamento completo pra vocÃª! ðŸ’…âœ¨<br><br>
          Em <strong>${singleMonth}</strong>, o total de todas as suas saÃ­das e gastos foi de <strong>${formatBRL(finMonth.totalSaidas)}</strong>!<br><br>
          Desses gastos, <strong>${formatBRL(mObj.saidas.filter(s => s.titulo.toLowerCase() === 'fatura').reduce((a, b) => a + b.valor, 0))}</strong> foram faturas de cartÃ£o.
        `,
        speech: `Miga, em ${singleMonth.toLowerCase()}, todos os seus gastos somaram ${formatBRL(finMonth.totalSaidas)}!`
      };
    }

    // 6. Total de Entradas
    if (/(quanto\s+(?:eu\s+)?recebi|quanto\s+ganhei|total\s+de\s+entradas|todas\s+as\s+entradas)/.test(norm)) {
      const finMonth = calculateCascadingFinancials(singleMonth);
      return {
        badge: `Total de Entradas em ${singleMonth} ðŸ’¸`,
        html: `
          Amo dindim entrando na conta, miga! ðŸ’¸âœ¨<br><br>
          Em <strong>${singleMonth}</strong>, suas entradas somaram um total de <strong>${formatBRL(finMonth.totalEntradas)}</strong>!<br><br>
          Arrasou demais! ðŸ’–
        `,
        speech: `Amo dinheiro entrando! Em ${singleMonth.toLowerCase()}, suas entradas somaram ${formatBRL(finMonth.totalEntradas)}!`
      };
    }
  }

  return null;
}

function extractCleanAIMessage(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let str = raw.trim();

  // Se veio em formato JSON, extrai o texto do assistente
  if ((str.startsWith('{') && str.endsWith('}')) || (str.startsWith('{"') && str.includes('"content"')) || str.includes('"role":"assistant"')) {
    try {
      const parsed = JSON.parse(str);
      if (parsed.choices && parsed.choices[0]?.message?.content) {
        str = parsed.choices[0].message.content;
      } else if (parsed.content) {
        str = parsed.content;
      } else if (parsed.text) {
        str = parsed.text;
      } else if (parsed.message) {
        str = parsed.message;
      } else if (parsed.reasoning && !parsed.content) {
        return '';
      }
    } catch (e) {
      const match = str.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (match) {
        try { str = JSON.parse(`"${match[1]}"`); } catch (err) {}
      }
    }
  }

  // Remove blocos de pensamento tipo <think>...</think>
  str = str.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Remove resquÃ­cio de JSON
  str = str.replace(/^\{"role":\s*"assistant".*?"content":\s*"/s, '').replace(/"\}$/s, '');

  // Se for pura divagaÃ§Ã£o de modelo em inglÃªs ("User: ... So, Q of how much..."), descarta para usar a amiga local
  if (/^(?:user:\s*["'].*?["']\s*)?(?:so,\s*q\s*of|let's\s*calculate|in\s*planilha|i\s*need\s*to\s*check)/i.test(str)) {
    return '';
  }

  return str.trim();
}

async function handleLunaConversationOrAdvice(rawText, lowerRaw) {
  const norm = normalizeWhatsappText(lowerRaw);

  // Guarda na memória de conversa
  appState.chatMemory.push({ role: 'user', content: rawText });
  if (appState.chatMemory.length > 14) appState.chatMemory.shift();

  // 0. Verifica se perguntou "que dia paguei X", "quanto foi X", "me mostra X", "onde está X"
  const directLocated = tryLocateAndSpotlightRequestedItem(norm);
  if (directLocated) {
    appState.chatMemory.push({ role: 'assistant', content: directLocated.speech });
    addChatBubble('ai', directLocated.html, directLocated.badge);
    speakText(directLocated.speech);
    return;
  }

  // 1. Verifica perguntas sobre COMPRAS PARCELADAS (qualquer item com "/", ex: "viagem rj 1/6", "chapinha 9/10", "shein 3/4")
  const installmentAnswer = trySolveInstallmentQuestion(norm);
  if (installmentAnswer) {
    appState.chatMemory.push({ role: 'assistant', content: installmentAnswer.speech });
    addChatBubble('ai', installmentAnswer.html, installmentAnswer.badge);
    speakText(installmentAnswer.speech);
    return;
  }

  // 1.5. Verifica perguntas sobre REPOSIÇÃO DO INVESTIMENTO / QUANTO TIROU / DEVOLUÇÃO AUTOMÁTICA EM DEZEMBRO / SIMULAÇÃO DE SOBRA
  const repAnswer = trySolveReplenishmentQuestion(norm);
  if (repAnswer) {
    appState.chatMemory.push({ role: 'assistant', content: repAnswer.speech });
    addChatBubble('ai', repAnswer.html, repAnswer.badge);
    speakText(repAnswer.speech);
    return;
  }

  // Sempre destaca por 3s qualquer item, categoria, cartão ou investimento mencionado na pergunta!
  autoSpotlightFromAnyQuestion(norm);

  // 2. Verifica se é uma pergunta de soma/cálculo direto entre meses para resposta instantânea + precisa
  const mathAnswer = trySolveAnalyticalMathQuestion(norm);
  if (mathAnswer) {
    appState.chatMemory.push({ role: 'assistant', content: mathAnswer.speech });
    addChatBubble('ai', mathAnswer.html, mathAnswer.badge);
    speakText(mathAnswer.speech);
    return;
  }

  // 2. Chama o Cérebro de IA Real (/api/chat) injetando 100% DOS DADOS DE TODAS AS PLANILHAS, CARTÕES E INVESTIMENTOS!
  // Assim a Luna analisa literalmente QUALQUER pergunta sobre a planilha OU conversa sobre qualquer outro assunto!
  const thinkingId = 'thinking_' + Date.now();
  const feed = document.getElementById('aiChatFeed');
  const thinkingDiv = document.createElement('div');
  thinkingDiv.id = thinkingId;
  thinkingDiv.className = 'chat-bubble bubble-ai';
  thinkingDiv.innerHTML = `<em>Analisando... ✨</em>`;
  feed.appendChild(thinkingDiv);
  feed.scrollTop = feed.scrollHeight;

  const fullSpreadsheetContext = buildFullSpreadsheetContextForAI();

  try {
    const systemPrompt = `Você é a Sailor, a assistente financeira agêntica superinteligente (nível ChatGPT / Gemini) e melhor amiga ("miga") da usuária.
Você tem acesso COMPLETO e controle de escrita/edição em tempo real sobre todas as planilhas dela de Outubro 2026 até Dezembro 2027:
• Meses de 2026: "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
• Meses de 2027: "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO 2027", "NOVEMBRO 2027", "DEZEMBRO 2027"
• Cartões de Crédito: Mercado Pago ("mercadopago") e Nubank ("nubank"), com suporte a quem deve ("Meu", "Marcos" ou o nome de qualquer pessoa).
• Investimentos e Rendimentos Diários (incluindo aportes/retiradas sem contar como rendimento).

Abaixo estão TODOS os dados exatos da planilha neste segundo:
${fullSpreadsheetContext}

COMO EXECUTAR AÇÕES NA PLANILHA (<SAILOR_ACTIONS>):
Sempre que a usuária pedir para adicionar, colocar, mudar, atualizar, editar ou apagar qualquer coisa na planilha, nos cartões ou nos investimentos (em um mês específico, vários meses ou todos os meses de 2027/2026), você DEVE incluir no início da sua resposta um bloco <SAILOR_ACTIONS>[...]</SAILOR_ACTIONS> contendo um array JSON válido de ações, seguido da sua resposta carinhosa!
Exemplos de objetos dentro do array JSON de <SAILOR_ACTIONS>:
- Adicionar entrada: {"type":"add_entrada","months":["ALL_2027"],"referencia":"entrada","valor":200} (use um nome limpo em "referencia", NUNCA inclua "todas as entradas de 2027" no nome!)
- Atualizar entrada: {"type":"update_entrada","months":["JANEIRO"],"target":"salário","valor":1800}
- Remover entrada: {"type":"delete_entrada","months":["ALL_2027"],"valor":200}
- Adicionar gasto/saída: {"type":"add_saida","months":["ABRIL"],"data":"15","referencia":"internet","titulo":"contas","valor":100,"parcelas":1}
- Atualizar gasto/saída: {"type":"update_saida","months":["DEZEMBRO"],"target":"faculdade","valor":150}
- Remover gasto/saída: {"type":"delete_saida","months":["NOVEMBRO"],"target":"uber"}
- Adicionar no cartão: {"type":"add_cartao","months":["OUTUBRO"],"cartao":"nubank","data":"12","referencia":"pizza","titulo":"compras","valor":60,"devedor":"Marcos"}
- Remover do cartão: {"type":"delete_cartao","months":["OUTUBRO"],"cartao":"nubank","target":"pizza"}
- Atualizar investimento (com ou sem aporte): {"type":"update_investimento","nome":"nubank 120","aporte":100,"novoValorTotal":181.14}
- Adicionar novo investimento: {"type":"add_investimento","nome":"CDB Itaú","valor":500}
- Navegar para mês/aba: {"type":"navigate","view":"planilha","month":"JANEIRO"}

INSTRUÇÕES DE CONVERSA:
1. Se for apenas uma pergunta, cálculo ou conversa livre, NÃO inclua <SAILOR_ACTIONS>; apenas responda com 100% de precisão usando os dados acima!
2. Fale com carinho e personalidade feminina brasileira ("miga", "amiga", "mulher", "arrasou", "fada sensata"), sendo direta, clara e calorosa.`;

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...appState.chatMemory.slice(-8)
    ];

    const res = await window.MagicCloud.chat({ messages: apiMessages, model: 'openai' });

    const rawReply = (await res.text()).trim();
    let aiReplyText = extractCleanAIMessage(rawReply);
    const tEl = document.getElementById(thinkingId);
    if (tEl) tEl.remove();

    if (res.ok && aiReplyText && aiReplyText.length > 2) {
      let actionBadge = 'Sailor IA ✨';
      const actionsMatch = aiReplyText.match(/<SAILOR_ACTIONS>([\s\S]*?)<\/SAILOR_ACTIONS>/i);
      if (actionsMatch) {
        try {
          const parsedActions = JSON.parse(actionsMatch[1].trim());
          const execRes = window.executeSailorActions(parsedActions);
          if (execRes && execRes.badge) actionBadge = execRes.badge;
        } catch (parseErr) {
          console.warn('Erro ao processar SAILOR_ACTIONS:', parseErr);
        }
        aiReplyText = aiReplyText.replace(/<SAILOR_ACTIONS>[\s\S]*?<\/SAILOR_ACTIONS>/gi, '').trim();
      }

      appState.chatMemory.push({ role: 'assistant', content: aiReplyText });
      // Formata negritos simples de markdown (**texto**) para HTML <strong>
      const formattedHtml = escapeHtml(aiReplyText)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
      addChatBubble('ai', formattedHtml, actionBadge);
      speakText(aiReplyText.replace(/\*\*/g, ''));
      return;
    }
  } catch (err) {
    const tEl = document.getElementById(thinkingId);
    if (tEl) tEl.remove();
  }

  // 3. Fallback local caso a internet oscile
  const fin = calculateCascadingFinancials(appState.currentMonth);
  const yields = calculateYieldMetrics();
  const cardTotals = calculateCardTotals('OUTUBRO');
  const fallback = generateFinancialAdvice(norm, fin, yields, cardTotals);
  appState.chatMemory.push({ role: 'assistant', content: fallback.speech });
  addChatBubble('ai', fallback.html, fallback.badge);
  speakText(fallback.speech);
}

function generateLocalBestieFallback(norm) {
  if (/(cansada|exausta|sono|pregui[cç]a|trabalhei|correria)/.test(norm)) {
    return {
      html: `Mulher do céu, imagino o quanto você tá cansada! Conciliar trabalho, faculdade de ADM e Pedagogia não é pra qualquer uma não, você é guerreira demais! 💪💖 Tira um tempinho hoje pra descansar, tomar um banho gostoso e relaxar, viu miga?`,
      speech: `Mulher do céu, imagino o quanto você tá cansada! Dar conta do trabalho e de duas faculdades não é pra qualquer uma não, você é guerreira demais! Tira um tempinho hoje pra descansar e relaxar, viu miga?`
    };
  }
  if (/(faculdade|estudar|prova|trabalho da facul|adm|pedagogia|aula)/.test(norm)) {
    return {
      html: `Miga, eu tiro o chapéu pra você fazendo Administração e Pedagogia ao mesmo tempo! 🎓✨ Foca que logo logo você tá formada e colhendo todos os frutos desse esforço! Se precisar desabafar sobre os trabalhos ou provas, tô aqui viu?`,
      speech: `Miga, eu tiro o chapéu pra você fazendo Administração e Pedagogia ao mesmo tempo! Foca que logo você tá formada colhendo os frutos! Se precisar de ajuda ou desabafar sobre as aulas, tô aqui!`
    };
  }
  if (/(fome|comer|lanche|almo[cç]o|janta|comida|doce|chiquinho|kfc|pizza)/.test(norm)) {
    return {
      html: `Ai miga, não fala em comida que até eu que sou virtual fico com vontade! 😂🍔 Um lanchinho gostoso ou um sorvetinho do Chiquinho salva qualquer dia né? O que você tá com vontade de comer hoje?`,
      speech: `Ai miga, não fala em comida que até eu fico com vontade! Um lanchinho gostoso ou um sorvete do Chiquinho salva qualquer dia né? O que você tá pensando em comer hoje?`
    };
  }
  if (/(quem [eé] voc[eê]|o que voc[eê] faz|trabalha pra mim|sua fun[cç][aã]o)/.test(norm)) {
    return {
      html: `Eu sou a Sailor, sua assistente pessoal exclusiva e sua melhor amiga de confiança! 💁‍♀️💖 Trabalho pra você cuidando de toda a sua vida financeira, mas também tô aqui pra bater papo, ouvir seus desabafos, fofocar e te dar conselhos sobre qualquer coisa!`,
      speech: `Eu sou a Sailor, sua assistente pessoal exclusiva e sua melhor amiga! Trabalho pra você cuidando da sua vida financeira, mas também tô aqui pra conversar sobre qualquer coisa, fofocar e te fazer companhia!`
    };
  }
  if (/(triste|chateada|ansiosa|estressada|nervosa|chorar|mal)/.test(norm)) {
    return {
      html: `Ô miga, vem cá que eu te dou um abraço bem apertado! 🥺💖 Dias difíceis acontecem, mas você é uma mulher incrível, super esforçada e não tá sozinha! Me conta o que aconteceu pra eu te ouvir e te ajudar a distrair a cabeça!`,
      speech: `Ô miga, vem cá que eu te dou um abraço! Dias difíceis acontecem, mas você é uma mulher incrível e não tá sozinha! Me conta o que aconteceu que eu tô aqui pra te ouvir!`
    };
  }

  return {
    html: `Me conta mais sobre isso, miga!! Adoro quando você tira um tempinho pra bater papo comigo! 🥰✨ Como eu trabalho pra você, tô sempre por aqui ligada em tudo — pode falar de qualquer assunto que eu tô te ouvindo!`,
    speech: `Me conta mais sobre isso, miga! Adoro quando você tira um tempinho pra conversar comigo! Pode falar de qualquer assunto que eu tô super te ouvindo!`
  };
}

function generateFinancialAdvice(query, fin, yields, cardTotals) {
  fin = fin || calculateCascadingFinancials(appState.currentMonth);
  yields = yields || calculateYieldMetrics();
  const summary = 'Em ' + getMonthLabel(appState.currentMonth) + ', entradas de ' + formatBRL(fin.totalEntradas)
    + ', gastos de ' + formatBRL(fin.totalSaidas) + ' e resultado de ' + formatSignedBRL(fin.fluxoMesAtual) + '.';
  const income = ' Rendimentos: dia ' + formatSignedBRL(yields.sumDia) + ', semana ' + formatSignedBRL(yields.sumSemana) + ', mês ' + formatSignedBRL(yields.sumMes) + '.';
  return { badge: 'Resumo dos seus dados', html: escapeHtml(summary + income)
    + '<br><small>A conversa online está indisponível no momento. Os comandos e cálculos locais continuam disponíveis.</small>', speech: summary + income };
}

// ==========================================
// RECONHECIMENTO DE VOZ (WEB SPEECH API)
// ==========================================
let recognition = null;
let speechAccumulatedText = '';
let speechFinalProcessed = false;
let isStoppingRecognition = false;
let speechHardStopTimeout = null;

function updateMicButtonUI(listening) {
  const btn = document.getElementById('btnMicMain');
  const st = document.getElementById('aiStatusText');
  if (!btn) return;

  if (listening) {
    btn.classList.add('listening');
    btn.setAttribute('title', 'Clique para PARAR de gravar e enviar');
    btn.setAttribute('aria-label', 'Clique para parar de gravar e enviar');
    btn.innerHTML = '<svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"white\" stroke=\"none\"><rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"3\"></rect></svg>';
    if (st) st.textContent = 'Gravando áudio... Clique para parar e enviar!';
  } else {
    btn.classList.remove('listening');
    btn.setAttribute('title', 'Falar por voz com a Sailor');
    btn.setAttribute('aria-label', 'Clique para falar com a Sailor');
    btn.innerHTML = '<i data-lucide=\"mic\" class=\"mic-icon\"></i>';
    if (window.lucide) window.lucide.createIcons();
    if (st) st.textContent = '';
  }
}

function setupSpeechRecognition() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) return;

  try {
    if (recognition) {
      try { recognition.abort(); } catch (_) {}
    }
  } catch (_) {}

  recognition = new SpeechRec();
  recognition.lang = 'pt-BR';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    appState.isListening = true;
    isStoppingRecognition = false;
    speechFinalProcessed = false;
    speechAccumulatedText = '';
    updateMicButtonUI(true);
  };

  recognition.onresult = (event) => {
    let full = '';
    for (let i = 0; i < event.results.length; i++) {
      full += event.results[i][0].transcript + ' ';
    }
    const clean = full.trim();
    if (clean) {
      speechAccumulatedText = clean;
      const textInput = document.getElementById('aiTextInput');
      if (textInput) textInput.value = clean;
      const st = document.getElementById('aiStatusText');
      if (st) st.textContent = 'Gravando: \"' + clean.slice(-35) + '\"';
    }
  };

  recognition.onerror = (event) => {
    console.warn('Speech recognition status:', event.error);
    if (event.error !== 'no-speech') {
      finalizeVoiceRecording();
    }
  };

  recognition.onend = () => {
    clearTimeout(speechHardStopTimeout);
    appState.isListening = false;
    isStoppingRecognition = false;
    updateMicButtonUI(false);

    const textToSend = speechAccumulatedText.trim();
    if (textToSend && !speechFinalProcessed) {
      speechFinalProcessed = true;
      const textInput = document.getElementById('aiTextInput');
      if (textInput) textInput.value = '';
      processUserMessage(textToSend);
    }
  };
}

function finalizeVoiceRecording() {
  if (!appState.isListening && !isStoppingRecognition) return;
  isStoppingRecognition = true;
  appState.isListening = false;

  // Atualiza visual IMEDIATAMENTE para parar na hora!
  updateMicButtonUI(false);
  const st = document.getElementById('aiStatusText');
  if (st) st.textContent = 'Áudio finalizado! Enviando...';

  const textToSend = speechAccumulatedText.trim() || document.getElementById('aiTextInput')?.value.trim();
  if (textToSend && !speechFinalProcessed) {
    speechFinalProcessed = true;
    const textInput = document.getElementById('aiTextInput');
    if (textInput) textInput.value = '';
    processUserMessage(textToSend);
  }

  // Interrompe imediatamente a gravação e libera o microfone
  if (recognition) {
    try {
      recognition.stop();
    } catch (_) {
      try { recognition.abort(); } catch (_) {}
    }

    clearTimeout(speechHardStopTimeout);
    speechHardStopTimeout = setTimeout(() => {
      try {
        if (recognition) recognition.abort();
      } catch (_) {}
      if (st && st.textContent.includes('Áudio finalizado')) st.textContent = '';
    }, 350);
  }
}

function toggleVoiceListening() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    alert('Use o Google Chrome ou Microsoft Edge para gravar por voz!');
    return;
  }

  if (!recognition) setupSpeechRecognition();

  // Se já estiver gravando, PARA IMEDIATAMENTE no clique!
  if (appState.isListening || isStoppingRecognition) {
    finalizeVoiceRecording();
    return;
  }

  try {
    stopCurrentSpeech();
    speechAccumulatedText = '';
    speechFinalProcessed = false;
    isStoppingRecognition = false;
    recognition.start();
  } catch (err) {
    console.warn('Reiniciando recognition após erro:', err);
    setupSpeechRecognition();
    try {
      recognition.start();
    } catch (e2) {
      console.error('Falha ao iniciar áudio:', e2);
      updateMicButtonUI(false);
    }
  }
}

// ==========================================
// MODAIS E EVENTOS
// ==========================================
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function openModal(type) {
  const backdrop = document.getElementById('modalBackdrop');
  document.getElementById('modalType').value = type;
  const editIdEl = document.getElementById('modalEditId');
  if (editIdEl) editIdEl.value = '';
  document.getElementById('inputReferencia').value = '';
  document.getElementById('inputValor').value = '';
  document.getElementById('inputCustomTitulo').value = '';
  document.getElementById('inputIsMarcos').checked = false;
  const wrapDebtor = document.getElementById('wrapDebtorName');
  if (wrapDebtor) wrapDebtor.style.display = 'none';

  const groupData = document.getElementById('groupDataPagamento');
  const groupTitulo = document.getElementById('groupTitulo');
  const groupMarcos = document.getElementById('groupMarcosCheck');
  const modalTitle = document.getElementById('modalTitle');
  const lblRef = document.getElementById('labelReferencia');
  const inpRef = document.getElementById('inputReferencia');

  if (lblRef) lblRef.textContent = 'Referência / Descrição';
  if (inpRef) inpRef.placeholder = 'Ex: passagem, lanche, viagem 1/5...';

  if (type === 'entrada') {
    modalTitle.textContent = `Nova Entrada (${getMonthLabel(appState.currentMonth)})`;
    groupData.style.display = 'none';
    groupTitulo.style.display = 'none';
    groupMarcos.style.display = 'none';
  } else {
    modalTitle.textContent = `Novo Gasto em ${getMonthLabel(appState.currentMonth)}`;
    groupData.style.display = 'flex';
    groupTitulo.style.display = 'flex';
    groupMarcos.style.display = 'none';
  }

  backdrop.classList.remove('hidden');
  document.getElementById('inputReferencia').focus();
}

window.selectModalDebtorChoice = function(choice) {
  const chk = document.getElementById('inputIsMarcos');
  const wrap = document.getElementById('wrapDebtorName');
  const inp = document.getElementById('inputDebtorName');
  const container = document.getElementById('modalDebtorChoices');

  if (container) {
    container.querySelectorAll('.debtor-choice-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-choice') === choice);
    });
  }

  if (choice === 'meu') {
    if (chk) chk.checked = false;
    if (wrap) wrap.style.display = 'none';
  } else if (choice === 'marcos') {
    if (chk) chk.checked = true;
    if (inp) inp.value = 'Marcos';
    if (wrap) wrap.style.display = 'none';
  } else {
    if (chk) chk.checked = true;
    if (inp && (!inp.value || inp.value.toLowerCase() === 'marcos')) {
      inp.value = 'Alguém';
    }
    if (wrap) wrap.style.display = 'block';
    setTimeout(() => {
      if (inp) {
        inp.focus();
        inp.select();
      }
    }, 20);
  }
};

window.openCardModal = function(cardKey) {
  const backdrop = document.getElementById('modalBackdrop');
  document.getElementById('modalType').value = `card_${cardKey}`;
  const editIdEl = document.getElementById('modalEditId');
  if (editIdEl) editIdEl.value = '';
  document.getElementById('inputReferencia').value = '';
  document.getElementById('inputValor').value = '';
  document.getElementById('inputCustomTitulo').value = '';
  window.selectModalDebtorChoice('meu');

  const lblRef = document.getElementById('labelReferencia');
  const inpRef = document.getElementById('inputReferencia');
  if (lblRef) lblRef.textContent = 'Referência / Descrição';
  if (inpRef) inpRef.placeholder = 'Ex: uber, restaurante, farmácia...';

  const label = cardKey === 'nubank' ? 'Crédito NUBANK' : 'Crédito MERCADO PAGO';
  document.getElementById('modalTitle').textContent = `Novo Gasto — ${label} (${getMonthLabel(appState.currentMonth)})`;
  document.getElementById('groupDataPagamento').style.display = 'flex';
  document.getElementById('groupTitulo').style.display = 'flex';
  document.getElementById('groupMarcosCheck').style.display = 'flex';

  backdrop.classList.remove('hidden');
  document.getElementById('inputReferencia').focus();
};

window.openInvestmentModal = function(editId = null, source = 'planilha') {
  const backdrop = document.getElementById('modalBackdrop');
  document.getElementById('modalType').value = 'investimento';
  const editIdEl = document.getElementById('modalEditId');
  if (editIdEl) editIdEl.value = editId ? `${source}:${editId}` : '';

  const monthObj = getMonthData();
  let existingItem = null;
  if (editId) {
    if (source === 'daily') {
      existingItem = appState.dailyInvestments.find(i => i.id === editId);
    } else {
      existingItem = monthObj.investimentos.find(i => i.id === editId) || appState.dailyInvestments.find(i => i.id === editId);
    }
  }

  document.getElementById('inputReferencia').value = existingItem ? existingItem.nome : '';
  document.getElementById('inputValor').value = existingItem ? existingItem.valor : '';
  document.getElementById('inputCustomTitulo').value = '';
  document.getElementById('inputIsMarcos').checked = false;
  const wrapDebtor = document.getElementById('wrapDebtorName');
  if (wrapDebtor) wrapDebtor.style.display = 'none';

  const lblRef = document.getElementById('labelReferencia');
  const inpRef = document.getElementById('inputReferencia');
  if (lblRef) lblRef.textContent = 'Instituição / Caixinha';
  if (inpRef) inpRef.placeholder = 'Ex: Banco Inter, PicPay, C6, Tesouro...';

  document.getElementById('modalTitle').textContent = existingItem
    ? `Editar Investimento — ${existingItem.nome}`
    : `Novo Investimento / Caixinha`;
  document.getElementById('groupDataPagamento').style.display = 'none';
  document.getElementById('groupTitulo').style.display = 'none';
  document.getElementById('groupMarcosCheck').style.display = 'none';

  backdrop.classList.remove('hidden');
  document.getElementById('inputReferencia').focus();
};

window.openEditItemModal = function(listName, id) {
  const monthObj = getMonthData();
  const item = (monthObj[listName] || []).find(i => i.id === id);
  if (!item) return;

  const backdrop = document.getElementById('modalBackdrop');
  document.getElementById('modalType').value = listName === 'entradas' ? 'entrada' : 'saida';
  const editIdEl = document.getElementById('modalEditId');
  if (editIdEl) editIdEl.value = `${listName}:${id}`;

  document.getElementById('inputReferencia').value = item.referencia || '';
  document.getElementById('inputValor').value = item.valor || '';
  document.getElementById('inputData').value = item.data || '-';
  if (item.titulo) {
    document.getElementById('inputTitulo').value = item.titulo;
  }
  document.getElementById('inputCustomTitulo').value = '';
  document.getElementById('inputIsMarcos').checked = false;
  const wrapDebtor = document.getElementById('wrapDebtorName');
  if (wrapDebtor) wrapDebtor.style.display = 'none';

  const groupData = document.getElementById('groupDataPagamento');
  const groupTitulo = document.getElementById('groupTitulo');
  const groupMarcos = document.getElementById('groupMarcosCheck');
  const modalTitle = document.getElementById('modalTitle');
  const lblRef = document.getElementById('labelReferencia');

  if (lblRef) lblRef.textContent = 'Referência / Descrição';

  if (listName === 'entradas') {
    modalTitle.textContent = `Editar Entrada (${getMonthLabel(appState.currentMonth)})`;
    groupData.style.display = 'none';
    groupTitulo.style.display = 'none';
    groupMarcos.style.display = 'none';
  } else {
    modalTitle.textContent = `Editar Gasto (${getMonthLabel(appState.currentMonth)})`;
    groupData.style.display = 'flex';
    groupTitulo.style.display = 'flex';
    groupMarcos.style.display = 'none';
  }

  backdrop.classList.remove('hidden');
  document.getElementById('inputReferencia').focus();
};

window.openEditCardModal = function(cardKey, id) {
  const monthObj = getMonthData();
  const item = monthObj.cartoes?.[cardKey]?.items?.find(i => i.id === id);
  if (!item) return;

  const backdrop = document.getElementById('modalBackdrop');
  document.getElementById('modalType').value = `card_${cardKey}`;
  const editIdEl = document.getElementById('modalEditId');
  if (editIdEl) editIdEl.value = `card_${cardKey}:${id}`;

  document.getElementById('inputReferencia').value = item.referencia || '';
  document.getElementById('inputValor').value = item.valor || '';
  document.getElementById('inputData').value = item.data || '-';
  if (item.titulo) document.getElementById('inputTitulo').value = item.titulo;
  document.getElementById('inputCustomTitulo').value = '';

  const debtorChoice = item.isMarcos ? 'marcos' : (item.devedor ? 'outro' : 'meu');
  window.selectModalDebtorChoice(debtorChoice);
  if (item.devedor && debtorChoice === 'outro') {
    const inp = document.getElementById('inputDebtorName');
    if (inp) inp.value = item.devedor;
  }

  const label = cardKey === 'nubank' ? 'Crédito NUBANK' : 'Crédito MERCADO PAGO';
  document.getElementById('modalTitle').textContent = `Editar Gasto — ${label}`;
  document.getElementById('groupDataPagamento').style.display = 'flex';
  document.getElementById('groupTitulo').style.display = 'flex';
  document.getElementById('groupMarcosCheck').style.display = 'flex';

  backdrop.classList.remove('hidden');
  document.getElementById('inputReferencia').focus();
};

function closeModal() {
  document.getElementById('modalBackdrop').classList.add('hidden');
}

/**
 * Cria o efeito de rastro de brilhos ✨ delicados e perceptíveis por onde o mouse passa
 */
function setupCursorSparkleTrail() {
  let lastSparkleTime = 0;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('mousemove', (e) => {
    const now = performance.now();
    const dist = Math.hypot(e.clientX - lastX, e.clientY - lastY);

    // Emite brilhos de forma fluida conforme o mouse se move (a cada ~32ms ou 12px de distância)
    if (now - lastSparkleTime < 32 && dist < 12) return;

    lastSparkleTime = now;
    lastX = e.clientX;
    lastY = e.clientY;

    const sparkle = document.createElement('span');
    sparkle.className = 'cursor-sparkle';
    sparkle.textContent = '✨';

    // Pequena variação ao redor da ponta do cursor para um efeito mágico natural
    const offsetX = (Math.random() - 0.5) * 12;
    const offsetY = (Math.random() - 0.5) * 12;
    const driftX = (Math.random() - 0.5) * 20;
    const driftY = 10 + Math.random() * 16;
    const rot = (Math.random() - 0.5) * 50;
    const size = 11 + Math.random() * 4.5; // Entre 11px e 15.5px: pequeno e bem perceptível

    sparkle.style.left = `${e.clientX + offsetX}px`;
    sparkle.style.top = `${e.clientY + offsetY}px`;
    sparkle.style.fontSize = `${size.toFixed(1)}px`;
    sparkle.style.setProperty('--dx', `${driftX.toFixed(1)}px`);
    sparkle.style.setProperty('--dy', `${driftY.toFixed(1)}px`);
    sparkle.style.setProperty('--rot', `${rot.toFixed(1)}deg`);

    document.body.appendChild(sparkle);

    setTimeout(() => {
      sparkle.remove();
    }, 780);
  }, { passive: true });
}

const THEME_STORAGE_KEY = accountPreferenceKey('theme');

function updateThemeToggleUI(isDark) {
  const btn = document.getElementById('btnThemeToggle');
  if (!btn) return;
  btn.title = isDark ? 'Clique no sol para voltar ao tema claro' : 'Clique na lua para ativar o tema escuro';
  btn.innerHTML = `<i data-lucide="${isDark ? 'sun' : 'moon'}" id="themeToggleIcon"></i>`;
  if (window.lucide) lucide.createIcons();
}

function applySavedTheme() {
  const saved = getAccountPreference('theme', 'planilha_inteligente_theme', 'light');
  const isDark = saved === 'dark';
  document.body.classList.toggle('dark-theme', isDark);
  updateThemeToggleUI(isDark);
}

window.toggleDarkTheme = function() {
  const isDark = !document.body.classList.contains('dark-theme');
  document.body.classList.toggle('dark-theme', isDark);
  localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
  updateThemeToggleUI(isDark);
  renderAll();
  saveToStorage();
};

function startMagicApp() {
  applySavedTheme();
  if (window.lucide) lucide.createIcons();
  setupCursorSparkleTrail();

  const dateInput = document.getElementById('inputDailyDate');
  let lastAutoTodayISO = getTodayLocalISO();
  if (dateInput) {
    dateInput.value = lastAutoTodayISO;
    dateInput.addEventListener('change', () => {
      renderAll();
    });
  }

  // Acompanha automaticamente o dia atual (hoje 28/10, amanhã 29/10, etc.)
  setInterval(() => {
    const currentTodayISO = getTodayLocalISO();
    if (currentTodayISO !== lastAutoTodayISO) {
      const di = document.getElementById('inputDailyDate');
      if (di && (!di.value || di.value === lastAutoTodayISO)) {
        di.value = currentTodayISO;
      }
      lastAutoTodayISO = currentTodayISO;
      renderAll();
    }
  }, 30000);

  setupSpeechRecognition();
  ensureAllSlashInstallmentsSynced();
  
  MONTH_ORDER.forEach(m => syncCreditCardsToNextMonth(m));
  if (appState.currentView && appState.currentView !== 'planilha') {
    window.switchView(appState.currentView);
  } else {
    renderAll();
  }
  renderSavedChatHistory();
  initDiskDatabaseSync();

  // Controle do Miniplayer Flutuante da Luna (abre ao clicar no símbolo do site no canto superior esquerdo)
  const lunaMiniplayer = document.getElementById('lunaMiniplayer');
  const btnOpenLunaLogo = document.getElementById('btnOpenLunaLogo');
  const btnCloseLuna = document.getElementById('btnCloseLuna');
  const btnMinimizeLuna = document.getElementById('btnMinimizeLuna');
  const dragHandle = document.getElementById('lunaMiniplayerDragHandle');

  function updateLunaLogoButtonState() {
    if (!btnOpenLunaLogo || !lunaMiniplayer) return;
    const isOpen = !lunaMiniplayer.classList.contains('hidden');
    btnOpenLunaLogo.classList.toggle('luna-active', isOpen);
    const hint = btnOpenLunaLogo.querySelector('.luna-logo-hint');
    if (hint) {
      hint.textContent = isOpen ? '✨ Luna Aberta' : '💬 Abrir Luna';
    }
  }

  window.openLunaMiniplayer = function() {
    if (!lunaMiniplayer) return;
    lunaMiniplayer.classList.remove('hidden');
    lunaMiniplayer.classList.remove('minimized');
    updateLunaLogoButtonState();
    const feed = document.getElementById('aiChatFeed');
    if (feed) feed.scrollTop = feed.scrollHeight;
    setTimeout(() => {
      document.getElementById('aiTextInput')?.focus();
    }, 80);
  };

  window.closeLunaMiniplayer = function() {
    if (!lunaMiniplayer) return;
    if (appState.isListening && typeof finalizeVoiceRecording === 'function') {
      finalizeVoiceRecording();
    }
    lunaMiniplayer.classList.add('hidden');
    updateLunaLogoButtonState();
  };

  window.toggleLunaMiniplayer = function() {
    if (!lunaMiniplayer) return;
    if (lunaMiniplayer.classList.contains('hidden')) {
      window.openLunaMiniplayer();
    } else if (lunaMiniplayer.classList.contains('minimized')) {
      lunaMiniplayer.classList.remove('minimized');
      setTimeout(() => document.getElementById('aiTextInput')?.focus(), 50);
    } else {
      window.closeLunaMiniplayer();
    }
  };

  btnOpenLunaLogo?.addEventListener('click', () => {
    window.toggleLunaMiniplayer();
  });

  btnCloseLuna?.addEventListener('click', (e) => {
    e.stopPropagation();
    window.closeLunaMiniplayer();
  });

  btnMinimizeLuna?.addEventListener('click', (e) => {
    e.stopPropagation();
    lunaMiniplayer?.classList.toggle('minimized');
  });

  // Permite arrastar o Miniplayer pela barra superior igual ao miniplayer do YouTube
  if (dragHandle && lunaMiniplayer) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialRight = 24;
    let initialBottom = 20;

    dragHandle.addEventListener('mousedown', (e) => {
      if (e.target.closest('button') || e.target.closest('select')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = lunaMiniplayer.getBoundingClientRect();
      initialRight = window.innerWidth - rect.right;
      initialBottom = window.innerHeight - rect.bottom;
      lunaMiniplayer.style.transition = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newRight = Math.max(10, Math.min(window.innerWidth - lunaMiniplayer.offsetWidth - 10, initialRight - dx));
      const newBottom = Math.max(10, Math.min(window.innerHeight - lunaMiniplayer.offsetHeight - 10, initialBottom - dy));
      lunaMiniplayer.style.right = `${newRight}px`;
      lunaMiniplayer.style.bottom = `${newBottom}px`;
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        lunaMiniplayer.style.transition = '';
      }
    });
  }

  // Botão do Símbolo de Histórico da Luna -> Abre confirmação "Deseja apagar o histórico de conversa com a Luna?"
  const btnChatHistory = document.getElementById('btnChatHistory');
  const chatHistoryConfirmBox = document.getElementById('chatHistoryConfirmBox');
  const btnConfirmClearChat = document.getElementById('btnConfirmClearChat');
  const btnCancelClearChat = document.getElementById('btnCancelClearChat');

  btnChatHistory?.addEventListener('click', () => {
    chatHistoryConfirmBox?.classList.toggle('hidden');
  });

  btnCancelClearChat?.addEventListener('click', () => {
    chatHistoryConfirmBox?.classList.add('hidden');
  });

  btnConfirmClearChat?.addEventListener('click', () => {
    appState.chatHistoryLog = [];
    appState.chatMemory = [];
    chatHistoryConfirmBox?.classList.add('hidden');
    const feed = document.getElementById('aiChatFeed');
    if (feed) feed.innerHTML = '';
    addDefaultWelcomeBubble();
    saveToStorage();
  });

  // Navegação entre as 3 Abas Principais
  document.querySelectorAll('.view-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      window.switchView(btn.getAttribute('data-view'));
    });
  });

  // Inicializa arraste horizontal com o mouse na barra de meses
  setupMonthTabsDragScroll();
  renderYearAndMonthTabs();

  document.getElementById('filterCategoria').addEventListener('change', (e) => {
    appState.filterCategoria = e.target.value;
    renderAll();
  });

  document.getElementById('filterCardCategoria')?.addEventListener('change', (e) => {
    appState.filterCardCategoria = e.target.value;
    renderAll();
  });

  document.getElementById('filterCardMarcos')?.addEventListener('change', (e) => {
    appState.filterCardMarcos = e.target.value;
    renderAll();
  });

  ['yieldRangeStart', 'yieldRangeEnd'].forEach(id => {
    document.getElementById(id).addEventListener('change', (e) => {
      appState[id] = e.target.value;
      // A consulta não recria os campos nem descarta atualizações ainda não salvas.
      renderYieldRange();
    });
  });

  document.getElementById('selectTrajectoryFilter').addEventListener('change', (e) => {
    appState.trajectoryFilter = e.target.value;
    renderAll();
  });

  // Botão Salvar Todas as Atualizações Diárias de Investimento (Independente da Planilha do Mês)
  document.getElementById('btnSaveAllDaily')?.addEventListener('click', () => {
    const dateVal = document.getElementById('inputDailyDate')?.value || getTodayLocalISO();
    let totalDiffToday = 0;
    let totalAporteToday = 0;
    let changedCount = 0;
    let lastUpdatedRowId = null;

    // Coleta todos os valores digitados antes de atualizar para salvar tudo de uma vez
    const pendingUpdates = [];
    appState.dailyInvestments.forEach(inv => {
      const inp = document.getElementById(`dailyInput_${inv.id}`);
      const inpAporte = document.getElementById(`dailyAporte_${inv.id}`);
      if (inp) {
        const newV = parseFloat(inp.value);
        const rawAporte = inpAporte && inpAporte.value.trim() !== '' ? parseFloat(inpAporte.value) : 0;
        const cleanAporte = isNaN(rawAporte) ? 0 : rawAporte;
        if (!isNaN(newV) && (Math.abs(newV - inv.valor) > 0.001 || Math.abs(cleanAporte) > 0.001)) {
          pendingUpdates.push({ nome: inv.nome, newV, cleanAporte });
        }
      }
    });

    pendingUpdates.forEach(u => {
      const res = window.updateSingleInvestmentToday(u.nome, u.newV, dateVal, u.cleanAporte, true);
      if (res) {
        totalDiffToday += res.diff;
        totalAporteToday += res.aporte;
        changedCount++;
        lastUpdatedRowId = `daily_${res.id}`;
      }
    });

    if (changedCount > 0) {
      saveToStorage();
      renderAll(lastUpdatedRowId);
      const aporteExtra = Math.abs(totalAporteToday) > 0.001
        ? ` (descontando ${formatSignedBRL(totalAporteToday)} de aportes/transferências)`
        : '';
      const msg = `Salvei a atualização do dia (${dateVal.split('-').reverse().join('/')}) na aba de Investimentos! Somando os ${changedCount} investimentos atualizados hoje${aporteExtra}, seu dinheiro rendeu de verdade <strong>${formatSignedBRL(totalDiffToday)}</strong>!`;
      addChatBubble('ai', msg, `Rendimento: ${formatSignedBRL(totalDiffToday)}`);
      speakText(msg);
    } else {
      alert('Altere pelo menos um valor em "Coloquei / Tirei (R$)" ou "Novo Valor Total (Hoje)" para atualizar!');
    }
  });

  document.getElementById('btnAddEntrada').addEventListener('click', () => openModal('entrada'));
  document.getElementById('btnAddSaida').addEventListener('click', () => openModal('saida'));
  document.getElementById('btnCloseModal').addEventListener('click', closeModal);
  document.getElementById('btnCancelModal').addEventListener('click', closeModal);

  const chkMarcosEl = document.getElementById('inputIsMarcos');
  if (chkMarcosEl) {
    chkMarcosEl.addEventListener('change', () => {
      const wrap = document.getElementById('wrapDebtorName');
      if (wrap) wrap.style.display = chkMarcosEl.checked ? 'block' : 'none';
    });
  }

  document.getElementById('modalForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.getElementById('modalType').value;
    const editMeta = (document.getElementById('modalEditId')?.value || '').trim();
    const ref = document.getElementById('inputReferencia').value.trim();
    const val = parseFloat(document.getElementById('inputValor').value);
    if (!ref || isNaN(val)) return;

    const monthObj = getMonthData();
    const dataPag = String(document.getElementById('inputData').value || '-');
    const customTit = document.getElementById('inputCustomTitulo').value.trim();
    const titulo = (customTit || document.getElementById('inputTitulo').value).toLowerCase();

    if (type === 'investimento') {
      const cleanVal = Number(val.toFixed(2));
      if (editMeta) {
        const parts = editMeta.split(':');
        const editId = parts.length > 1 ? parts.slice(1).join(':') : parts[0];
        let oldName = null;

        const mItem = monthObj.investimentos.find(i => i.id === editId);
        const dItem = appState.dailyInvestments.find(i => i.id === editId);
        if (mItem) oldName = mItem.nome;
        else if (dItem) oldName = dItem.nome;

        if (mItem) {
          mItem.nome = ref;
          mItem.valor = cleanVal;
        }
        if (dItem) {
          const delta = Number((cleanVal - Number(dItem.valor || 0)).toFixed(2));
          dItem.valorAnterior = Number(Math.max(0, (dItem.valorAnterior ?? dItem.valor) + delta).toFixed(2));
          dItem.nome = ref;
          dItem.valor = cleanVal;
        }
        if (oldName) {
          // Sincroniza também nos investimentos de mesmo nome
          monthObj.investimentos.forEach(i => {
            if ((i.nome || '').toLowerCase() === oldName.toLowerCase()) {
              i.nome = ref;
              i.valor = cleanVal;
            }
          });
          appState.dailyInvestments.forEach(i => {
            if ((i.nome || '').toLowerCase() === oldName.toLowerCase()) {
              const delta = Number((cleanVal - Number(i.valor || 0)).toFixed(2));
              if (i !== dItem) {
                i.valorAnterior = Number(Math.max(0, (i.valorAnterior ?? i.valor) + delta).toFixed(2));
              }
              i.nome = ref;
              i.valor = cleanVal;
            }
          });
          (appState.yieldHistory || []).forEach(h => {
            if ((h.nome || '').toLowerCase() === oldName.toLowerCase()) {
              h.nome = ref;
            }
          });
        }
        saveToStorage();
        closeModal();
        renderAll(editId);
        addChatBubble('ai', `Atualizei o investimento <strong>${escapeHtml(ref)}</strong> para <strong>${formatBRL(cleanVal)}</strong> (sem alterar o rendimento)!`, `Investimento: ${formatBRL(cleanVal)}`);
      } else {
        const newId = 'inv_' + Date.now();
        // Adiciona na planilha do mês atual e nos meses seguintes se ainda não existir com esse nome
        const curIdx = Math.max(0, MONTH_ORDER.indexOf(appState.currentMonth));
        MONTH_ORDER.slice(curIdx).forEach((mName, idx) => {
          const mData = appState.data[mName];
          if (!mData || !Array.isArray(mData.investimentos)) return;
          const exists = mData.investimentos.find(i => (i.nome || '').toLowerCase() === ref.toLowerCase());
          if (exists) {
            if (idx === 0) exists.valor = cleanVal;
          } else {
            mData.investimentos.push({
              id: idx === 0 ? newId : `${newId}_${mName}`,
              nome: ref,
              valor: cleanVal,
              valorAnterior: cleanVal
            });
          }
        });

        // Adiciona ou atualiza também na aba de Investimentos & Rendimentos Diários
        const existingDaily = appState.dailyInvestments.find(i => (i.nome || '').toLowerCase() === ref.toLowerCase());
        if (existingDaily) {
          existingDaily.valorAnterior = existingDaily.valor;
          existingDaily.valor = cleanVal;
        } else {
          appState.dailyInvestments.push({
            id: newId,
            nome: ref,
            valor: cleanVal,
            valorAnterior: cleanVal
          });
        }

        // Registra ponto inicial no histórico de trajetória para aparecer nos gráficos
        const todayStr = document.getElementById('inputDailyDate')?.value || new Date().toISOString().slice(0, 10);
        appState.yieldHistory.push({
          id: 'yh_' + Date.now(),
          date: todayStr,
          nome: ref,
          oldVal: cleanVal,
          newVal: cleanVal,
          yieldVal: 0
        });

        saveToStorage();
        closeModal();
        renderAll(newId);
        addChatBubble('ai', `Adicionei o novo investimento <strong>${escapeHtml(ref)}</strong> com saldo de <strong>${formatBRL(cleanVal)}</strong>!`, `Novo Investimento: ${ref}`);
      }
    } else if (type === 'entrada') {
      if (editMeta) {
        const parts = editMeta.split(':');
        const editId = parts.length > 1 ? parts.slice(1).join(':') : parts[0];
        const item = monthObj.entradas.find(e => e.id === editId);
        if (item) {
          item.referencia = ref;
          item.valor = Number(val.toFixed(2));
          saveToStorage();
          closeModal();
          renderAll(editId);
          addChatBubble('ai', `Atualizei a entrada <strong>"${escapeHtml(ref)}"</strong> para <strong>${formatBRL(val)}</strong>!`, 'Entrada Atualizada');
          return;
        }
      }
      const newId = 'e_' + Date.now();
      monthObj.entradas.push({ id: newId, referencia: ref, valor: val });
      saveToStorage();
      closeModal();
      renderAll(newId);
    } else if (type.startsWith('card_')) {
      const cardKey = type.replace('card_', '');
      const isCheckDebtor = document.getElementById('inputIsMarcos').checked;
      const debtorInput = (document.getElementById('inputDebtorName')?.value || '').trim();
      const debtorName = isCheckDebtor ? (debtorInput || 'Marcos') : null;
      const isMarcos = Boolean(isCheckDebtor && (debtorName.toLowerCase() === 'marcos'));

      if (editMeta) {
        const parts = editMeta.split(':');
        const editId = parts.length > 1 ? parts.slice(1).join(':') : parts[0];
        const item = monthObj.cartoes?.[cardKey]?.items?.find(c => c.id === editId);
        if (item) {
          item.referencia = ref;
          item.valor = Number(val.toFixed(2));
          item.data = dataPag;
          item.titulo = titulo;
          item.devedor = debtorName;
          item.isMarcos = isMarcos;
          syncCreditCardsToNextMonth(appState.currentMonth);
          saveToStorage();
          closeModal();
          renderAll(editId);
          addChatBubble('ai', `Atualizei o gasto no cartão para <strong>"${escapeHtml(ref)}"</strong> (${formatBRL(val)})!`, 'Cartão Atualizado');
          return;
        }
      }
      const newId = 'c_' + Date.now();
      monthObj.cartoes[cardKey].items.push({ id: newId, data: dataPag, referencia: ref, titulo, valor: val, isMarcos, devedor: debtorName });
      syncCreditCardsToNextMonth(appState.currentMonth);
      saveToStorage();
      closeModal();
      renderAll(newId);
    } else {
      if (editMeta) {
        const parts = editMeta.split(':');
        const editId = parts.length > 1 ? parts.slice(1).join(':') : parts[0];
        const item = monthObj.saidas.find(s => s.id === editId);
        if (item) {
          item.referencia = ref;
          item.valor = Number(val.toFixed(2));
          item.data = dataPag;
          item.titulo = titulo;
          const parsedP = parseInstallmentRef(ref);
          if (parsedP) {
            item.titulo = 'parcelado';
            propagateInstallmentsFrom(appState.currentMonth, item);
          }
          saveToStorage();
          closeModal();
          renderAll(editId);
          addChatBubble('ai', `Atualizei o gasto <strong>"${escapeHtml(ref)}"</strong> para <strong>${formatBRL(val)}</strong>!`, 'Gasto Atualizado');
          return;
        }
      }
      const newId = 's_' + Date.now();
      const parsedP = parseInstallmentRef(ref);
      const finalTitulo = parsedP ? 'parcelado' : titulo;
      const newItem = { id: newId, data: dataPag, referencia: ref, titulo: finalTitulo, valor: val };
      monthObj.saidas.push(newItem);
      if (parsedP) propagateInstallmentsFrom(appState.currentMonth, newItem);
      saveToStorage();
      closeModal();
      renderAll(newId);
    }
  });

  document.getElementById('btnMicMain')?.addEventListener('click', toggleVoiceListening);
  document.getElementById('btnVoiceQuick')?.addEventListener('click', () => {
    window.openLunaMiniplayer();
    toggleVoiceListening();
  });

  document.getElementById('btnToggleMute').addEventListener('click', () => {
    appState.voiceMuted = !appState.voiceMuted;
    if (appState.voiceMuted) stopCurrentSpeech();
    const btn = document.getElementById('btnToggleMute');
    btn.innerHTML = appState.voiceMuted ? `<i data-lucide="volume-x"></i>` : `<i data-lucide="volume-2"></i>`;
    if (window.lucide) lucide.createIcons();
  });

  document.getElementById('voiceSpeedSelect')?.addEventListener('change', (e) => {
    const newRate = parseFloat(e.target.value) || 1.28;
    if (currentAudioPlayer) {
      currentAudioPlayer.playbackRate = newRate;
    }
  });

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      processUserMessage(chip.getAttribute('data-prompt'));
    });
  });

  document.getElementById('aiChatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (appState.isListening && typeof finalizeVoiceRecording === 'function') {
      finalizeVoiceRecording();
      return;
    }
    const input = document.getElementById('aiTextInput');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    processUserMessage(msg);
  });

  // Botão Exportar Backup Completo (.json)
  document.getElementById('btnBackupJSON')?.addEventListener('click', () => {
    const payload = {
      version: 'permanente',
      updatedAt: new Date().toISOString(),
      data: appState.data,
      yieldHistory: appState.yieldHistory
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_planilha_inteligente_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Botão Importar Backup Completo (.json)
  document.getElementById('btnImportJSON')?.addEventListener('click', () => {
    document.getElementById('inputImportJSON')?.click();
  });

  document.getElementById('inputImportJSON')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (imported && imported.data) {
          appState.data = mergeSavedDataWithDefaults(imported.data);
          if (Array.isArray(imported.yieldHistory)) appState.yieldHistory = imported.yieldHistory;
          saveToStorage();
          renderAll();
          addChatBubble('ai', '✅ Backup importado e salvo permanentemente no seu computador!', 'Backup Restaurado');
        }
      } catch (err) {
        alert('Arquivo de backup inválido.');
      }
    };
    reader.readAsText(file);
  });

  // Botão Exportar CSV
  document.getElementById('btnExportCSV')?.addEventListener('click', () => {
    const monthObj = getMonthData();
    let csv = `PLANILHA INTELIGENTE - ${appState.currentMonth}\n\nENTRADAS\nReferencia;Valor\n`;
    monthObj.entradas.forEach(e => { csv += `${e.referencia};${e.valor.toFixed(2).replace('.', ',')}\n`; });
    csv += `\nINVESTIMENTOS\nInstituicao;Valor\n`;
    monthObj.investimentos.forEach(i => { csv += `${i.nome};${i.valor.toFixed(2).replace('.', ',')}\n`; });
    csv += `\nSAIDAS\nData;Referencia;Titulo;Valor\n`;
    monthObj.saidas.forEach(s => { csv += `${s.data};${s.referencia};${s.titulo};${s.valor.toFixed(2).replace('.', ',')}\n`; });
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planilha_${appState.currentMonth.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('btnResetData')?.addEventListener('click', () => {
    if (confirm('Deseja restaurar todos os dados originais (Planilhas, Cartões e Histórico de Investimentos)?')) {
      appState.data = JSON.parse(JSON.stringify(INITIAL_DATA));
      appState.dailyInvestments = JSON.parse(JSON.stringify(BASE_INVESTMENTS));
      appState.yieldHistory = JSON.parse(JSON.stringify(INITIAL_YIELD_HISTORY));
      saveToStorage();
      renderAll();
      addChatBubble('ai', 'Dados originais restaurados com sucesso!', 'Restaurado');
    }
  });
}

// Calendário visual do Magic: mantém os inputs date e seus eventos existentes.
function magicCalendarDays(year, month) {
  const first = new Date(year, month, 1, 12);
  const count = new Date(year, month + 1, 0, 12).getDate();
  return { offset: first.getDay(), count };
}

function setupMagicCalendars() {
  const inputs = document.querySelectorAll('input.pastel-date-input[type="date"]');
  const dialog = document.createElement('dialog');
  dialog.className = 'magic-calendar';
  dialog.setAttribute('aria-label', 'Escolher data');
  document.body.appendChild(dialog);
  let activeInput = null;
  let year, month;
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const iso = day => String(year).padStart(4, '0') + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  const close = () => dialog.close();
  const choose = value => {
    activeInput.value = value;
    activeInput.dispatchEvent(new Event('input', { bubbles: true }));
    activeInput.dispatchEvent(new Event('change', { bubbles: true }));
    close();
  };
  const position = () => {
    const rect = activeInput.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    dialog.style.width = width + 'px';
    dialog.style.left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)) + 'px';
    dialog.style.top = Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - dialog.offsetHeight - 12)) + 'px';
  };
  const render = () => {
    dialog.innerHTML = '<div class="magic-calendar-head"><button type="button" data-nav="-1" aria-label="Mês anterior">‹</button><select aria-label="Mês">' + months.map((name, i) => '<option value="' + i + '"' + (i === month ? ' selected' : '') + '>' + name + '</option>').join('') + '</select><input type="number" min="100" max="9999" aria-label="Ano" value="' + year + '"><button type="button" data-nav="1" aria-label="Próximo mês">›</button></div><div class="magic-calendar-week" aria-hidden="true">' + ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => '<span>' + d + '</span>').join('') + '</div><div class="magic-calendar-days"></div><div class="magic-calendar-footer"><button type="button" data-action="clear">Limpar</button><button type="button" data-action="today">Hoje</button><button type="button" data-action="close" aria-label="Fechar calendário">Fechar</button></div>';
    const grid = dialog.querySelector('.magic-calendar-days');
    const days = magicCalendarDays(year, month);
    for (let i = 0; i < days.offset; i++) grid.appendChild(document.createElement('span'));
    for (let day = 1; day <= days.count; day++) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = day;
      button.dataset.day = day;
      const value = iso(day);
      button.setAttribute('aria-label', day + ' de ' + months[month] + ' de ' + year);
      button.setAttribute('aria-pressed', String(value === activeInput.value));
      if (value === getTodayLocalISO()) button.classList.add('is-today');
      if (value === activeInput.value) button.classList.add('is-selected');
      button.disabled = Boolean((activeInput.min && value < activeInput.min) || (activeInput.max && value > activeInput.max));
      button.addEventListener('click', () => choose(value));
      grid.appendChild(button);
    }
    dialog.querySelectorAll('[data-nav]').forEach(button => button.addEventListener('click', () => {
      const date = new Date(year, month + Number(button.dataset.nav), 1, 12);
      if (date.getFullYear() < 100 || date.getFullYear() > 9999) return;
      year = date.getFullYear(); month = date.getMonth(); render(); position();
      dialog.querySelector('[data-nav="' + button.dataset.nav + '"]').focus();
    }));
    dialog.querySelector('select').addEventListener('change', e => { month = Number(e.target.value); render(); position(); dialog.querySelector('select').focus(); });
    dialog.querySelector('input').addEventListener('change', e => {
      const value = Number(e.target.value);
      if (!Number.isInteger(value) || value < 100 || value > 9999) { e.target.value = year; return; }
      year = value; render(); position(); dialog.querySelector('input').focus();
    });
    dialog.querySelector('[data-action="clear"]').addEventListener('click', () => choose(''));
    const todayButton = dialog.querySelector('[data-action="today"]');
    const today = getTodayLocalISO();
    todayButton.disabled = Boolean((activeInput.min && today < activeInput.min) || (activeInput.max && today > activeInput.max));
    todayButton.addEventListener('click', () => choose(today));
    dialog.querySelector('[data-action="close"]').addEventListener('click', close);
  };
  const open = input => {
    activeInput = input;
    const parts = (input.value || getTodayLocalISO()).split('-').map(Number);
    year = parts[0]; month = parts[1] - 1;
    render();
    if (!dialog.open) dialog.showModal();
    position();
    (dialog.querySelector('.is-selected') || dialog.querySelector('.is-today') || dialog.querySelector('[data-day]')).focus();
  };
  inputs.forEach(input => {
    input.setAttribute('aria-haspopup', 'dialog');
    input.addEventListener('click', event => { event.preventDefault(); open(input); });
    input.addEventListener('keydown', event => {
      if (event.key === 'F4' || event.key === ' ' || (event.altKey && event.key === 'ArrowDown')) { event.preventDefault(); open(input); }
    });
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  });
  dialog.addEventListener('keydown', event => {
    const day = event.target.dataset.day;
    if (!day) return;
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(event.key in offsets)) return;
    event.preventDefault();
    const target = dialog.querySelector('[data-day="' + (Number(day) + offsets[event.key]) + '"]');
    if (target && !target.disabled) target.focus();
  });
  window.addEventListener('resize', () => { if (dialog.open) position(); });
}


window.MagicApp = {
  start() { startMagicApp(); setupMagicCalendars(); },
  snapshot: magicSnapshot,
  hasDraftInputs() {
    return appState.dailyInvestments.some(inv => {
      const total = document.getElementById('dailyInput_' + inv.id);
      const aporte = document.getElementById('dailyAporte_' + inv.id);
      return (total && Number(total.value) !== Number(inv.valor)) || (aporte && Number(aporte.value) !== 0);
    }) || !document.getElementById('modalBackdrop')?.classList.contains('hidden');
  },
  applyRemote(payload) {
    window.MAGIC_BOOTSTRAP.payload = structuredClone(payload);
    appState.data = mergeSavedDataWithDefaults(structuredClone(payload.data));
    appState.dailyInvestments = structuredClone(payload.dailyInvestments);
    appState.yieldHistory = structuredClone(payload.yieldHistory);
    appState.chatHistoryLog = structuredClone(payload.chatHistoryLog);
    appState.chatMemory = structuredClone(payload.chatMemory);
    const prefs = payload.preferences || {};
    if (prefs.currentMonth && appState.data[prefs.currentMonth]) appState.currentMonth = prefs.currentMonth;
    if (['planilha','cartoes','investimentos'].includes(prefs.currentView)) {
      appState.currentView = prefs.currentView;
      document.querySelectorAll('.view-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.view === prefs.currentView));
      document.querySelectorAll('.view-section').forEach(view => view.classList.toggle('active', view.id === 'view-' + prefs.currentView));
    }
    if (prefs.theme) { document.body.classList.toggle('dark-theme', prefs.theme === 'dark'); updateThemeToggleUI(prefs.theme === 'dark'); }
    renderAll(); renderSavedChatHistory();
  }
};
