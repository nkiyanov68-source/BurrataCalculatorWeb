(() => {
  'use strict';

  const CHAN_CM = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 55];
  const CHAN_LITERS = [0, 9.8, 22.6, 42.2, 61.8, 82.2, 103.8, 128.8, 155, 183.6, 208.4, 238.6, 270.6, 293.4, 318];
  const ROUNDING_THRESHOLD = 0.6;
  const STORAGE_KEY = 'burrata_web_settings_v1_13_23';
  const FORM_STORAGE_KEY = 'burrata_web_form_v1_13_23';
  const RESULT_STORAGE_KEY = 'burrata_web_results_v1_13_23';

  const DEFAULTS = {
    requestToPieces: 8,
    extraPiecesPerParty: 5,
    piecesPerBox: 6,
    onePartyLimitKg: 45,
    twoPartyLimitKg: 90,
    threePartyLimitKg: 123.75,
    truffleOnePartyLimitKg: 20,
    truffleTwoPartyLimitKg: 30,
    milkPerPieceKg: 0.68,
    milkDensity: 1.03,
    acidPerMilk1: 1.34,
    acidPerMilk2: 1.34,
    acidPerMilk3: 1.34,
    acidPerMilk4: 1.34,
    acidPerMilk5: 1.34,
    acidPerMilk6: 1.34,
    rennetPerMilk: 0.2,
    maxChanMilkKg: 280,
    fillingPerPieceG: 93,
    cagliataPerPieceG: 40,
    saltRate: 0.045,
    creamSaltPerKgG: 10,
    bowlCapacityG: 3000,
    truffleFillingPerPieceG: 95,
    truffleBowlCapacityG: 2100,
    bowlLossG: 65,
    dispenserLossG: 110,
    stracciatellaDivisor: 2
  };

  for (let i = 1; i <= 20; i++) {
    const key = `chanAcidPerMilk${i}`;
    if (!(key in DEFAULTS)) DEFAULTS[key] = 1.34;
  }

  const SETTINGS_GROUPS = [
    {
      title: 'Партии и штуки',
      fields: [
        ['requestToPieces', 'Заявка кг ×', '8'],
        ['extraPiecesPerParty', 'Добавка штук ОТК на 1 партию', '5'],
        ['piecesPerBox', 'В одной коробке, шт.', '6'],
        ['onePartyLimitKg', 'Классика: 1 партия до, кг', '45'],
        ['twoPartyLimitKg', 'Классика: 2 партии до, кг', '90'],
        ['threePartyLimitKg', 'Классика: 3 партии до, кг', '123,75'],
        ['truffleOnePartyLimitKg', 'Трюфель: 2 партии от, кг', '20'],
        ['truffleTwoPartyLimitKg', 'Трюфель: 3 партии от, кг', '30']
      ]
    },
    {
      title: 'Молоко, чан, фермент',
      fields: [
        ['milkPerPieceKg', 'Молоко: штук ×', '0,68'],
        ['milkDensity', 'Плотность молока, кг/л', '1,03'],
        ['rennetPerMilk', 'Фермент: молоко кг ×', '0,2'],
        ['maxChanMilkKg', 'Максимум на 1 чан, кг', '280']
      ]
    },
    {
      title: 'Начинка и потери',
      fields: [
        ['cagliataPerPieceG', 'Кальятта расплав: 1 шт ×, г', '40'],
        ['saltRate', 'Соль кальятта/страчителла: масса ×', '0,045'],
        ['creamSaltPerKgG', 'Соль в сливки: на 1 кг сливок, г', '10'],
        ['bowlCapacityG', 'Классика: максимум общего в 1 тазу, г', '3000'],
        ['truffleBowlCapacityG', 'Трюфель: максимум общего в 1 тазу, г', '2100'],
        ['bowlLossG', 'Потери на 1 таз, г', '65'],
        ['dispenserLossG', 'Потери дозатора в 1 партии, г', '110'],
        ['stracciatellaDivisor', 'Страчителла: начинка /', '2']
      ]
    }
  ];


  const FORM_INPUT_IDS = [
    'fillingClassicKg',
    'fillingClassicParties',
    'fillingClassicExtraPieces',
    'fillingClassicBowlCapacityG',
    'fillingTruffleKg',
    'fillingTruffleParties',
    'fillingTruffleExtraPieces',
    'fillingTruffleBowlCapacityG',
    'fillingOtkPerParty',
    'burrataKg',
    'burrataManualParties',
    'burrataBoxesByParty',
    'burrataExtraPieces',
    'truffleKg',
    'truffleManualParties',
    'truffleBoxesByParty',
    'truffleExtraPieces'
  ];

  let settings = loadSettings();
  let currentTab = 'burrata';
  let lastFillingText = '';
  let lastBurrataText = '';
  let lastTruffleText = '';
  let lastChanText = '';
  let lastChanCount = 1;
  let lastChanLoads = [];
  let lastPartyChanMap = {};

  const $ = (id) => document.getElementById(id);

  document.addEventListener('DOMContentLoaded', () => {
    buildSettingsFields();
    addStartMessages();
    bindEvents();
    const cachedTab = restoreCachedAppState();
    showTab(cachedTab || 'filling');

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  });

  function bindEvents() {
    document.querySelectorAll('.tab').forEach((btn) => {
      btn.addEventListener('click', () => showTab(btn.dataset.tab));
    });

    $('calcFilling').addEventListener('click', calculateFilling);
    $('calcBurrata').addEventListener('click', () => calculateProduct(false));
    $('calcTruffle').addEventListener('click', () => calculateProduct(true));
    $('calcChan').addEventListener('click', calculateChan);

    $('toggleFillingAdvanced').addEventListener('click', () => toggleOptionalPanel('toggleFillingAdvanced', 'fillingAdvancedPanel', '+ Настройки начинки', '− Скрыть настройки начинки'));
    $('toggleBurrataExtra').addEventListener('click', () => toggleOptionalPanel('toggleBurrataExtra', 'burrataExtraPanel', '+ Дополнительно', '− Скрыть дополнительно'));
    $('toggleTruffleExtra').addEventListener('click', () => toggleOptionalPanel('toggleTruffleExtra', 'truffleExtraPanel', '+ Дополнительно', '− Скрыть дополнительно'));
    $('toggleBurrataSource').addEventListener('click', () => toggleProductSourcePanel(false));
    $('toggleTruffleSource').addEventListener('click', () => toggleProductSourcePanel(true));

    $('copyFilling').addEventListener('click', () => copyText(lastFillingText, 'Сначала сделайте расчёт начинки'));
    $('copyBurrata').addEventListener('click', () => copyText(lastBurrataText, 'Сначала сделайте расчёт классики'));
    $('copyTruffle').addEventListener('click', () => copyText(lastTruffleText, 'Сначала сделайте расчёт трюфеля'));
    $('copyChan').addEventListener('click', () => copyText(lastChanText, 'Сначала сделайте расчёт чана'));

    $('toggleSettings').addEventListener('click', toggleSettings);
    $('openSettingsFromTruffle').addEventListener('click', openSettingsFromOtherTab);
    $('openSettingsFromChan').addEventListener('click', toggleChanSettings);
    $('applyChanAcidAll').addEventListener('click', applyChanAcidToAll);
    $('saveChanSettings').addEventListener('click', saveChanAcidSettings);
    $('resetChanSettings').addEventListener('click', resetChanAcidSettings);
    $('saveSettings').addEventListener('click', () => {
      const parsed = readSettingsFromFields(true);
      if (!parsed) return;
      settings = parsed;
      saveSettings(settings);
      toast('Настройки сохранены');
    });
    $('resetSettings').addEventListener('click', () => {
      settings = { ...DEFAULTS };
      saveSettings(settings);
      updateSettingFields();
      toast('Настройки сброшены');
    });

    FORM_INPUT_IDS.forEach((id) => {
      const input = $(id);
      if (input) input.addEventListener('input', () => {
        if (id.startsWith('filling')) {
          resetBoxesAfterFillingChange(id);
          syncFillingToProductInputs(false);
          updateProductSourceSummaries();
        } else {
          updateProductSourceSummaries();
          saveFormState();
        }
      });
    });

    let startX = 0;
    let startY = 0;
    const swipeArea = $('swipeArea');
    swipeArea.addEventListener('touchstart', (e) => {
      if (!e.changedTouches || !e.changedTouches.length) return;
      startX = e.changedTouches[0].clientX;
      startY = e.changedTouches[0].clientY;
    }, { passive: true });

    swipeArea.addEventListener('touchend', (e) => {
      if (!e.changedTouches || !e.changedTouches.length) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        const order = ['filling', 'chan', 'burrata', 'truffle'];
        let idx = order.indexOf(currentTab);
        if (dx < 0 && idx < order.length - 1) showTab(order[idx + 1]);
        if (dx > 0 && idx > 0) showTab(order[idx - 1]);
      }
    }, { passive: true });
  }

  function showTab(tab) {
    currentTab = tab;
    saveCurrentTab(tab);
    document.querySelectorAll('.tab').forEach((btn) => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle('active', active);
      btn.textContent = (active ? '● ' : '') + tabLabel(btn.dataset.tab);
    });
    document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
    $(`page-${tab}`).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }



  function tabLabel(tab) {
    if (tab === 'filling') return 'Начинка';
    if (tab === 'burrata') return 'Классика';
    if (tab === 'truffle') return 'Трюфель';
    return 'Чан';
  }

  function toggleOptionalPanel(buttonId, panelId, closedText, openText) {
    const panel = $(panelId);
    const btn = $(buttonId);
    const show = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !show);
    btn.textContent = show ? openText : closedText;
  }

  function toggleProductSourcePanel(isTruffle) {
    const prefix = isTruffle ? 'truffle' : 'burrata';
    const panel = $(`${prefix}SourcePanel`);
    const btn = $(`toggle${isTruffle ? 'Truffle' : 'Burrata'}Source`);
    if (!panel || !btn) return;
    const show = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !show);
    btn.classList.toggle('open', show);
    updateProductSourceSummary(isTruffle);
  }

  function updateProductSourceSummaries() {
    updateProductSourceSummary(false);
    updateProductSourceSummary(true);
  }

  function updateProductSourceSummary(isTruffle) {
    const prefix = isTruffle ? 'truffle' : 'burrata';
    const label = isTruffle ? 'Трюфель' : 'Классика';
    const btn = $(`toggle${isTruffle ? 'Truffle' : 'Burrata'}Source`);
    if (!btn) return;
    const kgInput = $(`${prefix}Kg`);
    const partiesInput = $(`${prefix}ManualParties`);
    const boxesInput = $(`${prefix}BoxesByParty`);
    const kgRaw = String(kgInput && kgInput.value || '').trim();
    const partiesRaw = String(partiesInput && partiesInput.value || '').trim();
    const boxesParties = countPartiesFromBoxes(String(boxesInput && boxesInput.value || '').trim());
    const kgText = kgRaw ? `${kgRaw} кг` : '— кг';
    let partiesText = partiesRaw || '';
    if (!partiesText && boxesParties > 0) partiesText = `${boxesParties} из коробок`;
    if (!partiesText && kgRaw) {
      const kgValue = Number(String(kgRaw).replace(',', '.'));
      if (Number.isFinite(kgValue) && kgValue > 0) {
        partiesText = `${isTruffle ? getTruffleParties(kgValue) : getParties(kgValue)}`;
      }
    }
    if (!partiesText) partiesText = '—';
    btn.textContent = `${label}: ${kgText} • Партии: ${partiesText}`;
  }

  function countPartiesFromBoxes(raw) {
    if (!raw) return 0;
    return raw.split(/[\/\\;]+/).map((v) => v.trim()).filter(Boolean).length;
  }

  function toggleChanSettings() {
    const panel = $('chanSettingsPanel');
    const show = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !show);
    $('openSettingsFromChan').textContent = show ? 'Скрыть настройки чана' : 'Настройки чана';
    if (show) {
      const renderedCount = document.querySelectorAll('#chanResults .chan-title').length;
      if (renderedCount > 0) lastChanCount = renderedCount;
      buildChanAcidSettingsFields(lastChanCount);
      setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    }
  }

  function buildChanAcidSettingsFields(chanCount) {
    const wrap = $('chanAcidSettingsFields');
    if (!wrap) return;
    const count = Math.max(1, Math.min(20, Number(chanCount) || 1));
    const commonInput = $('chan-acid-all');
    if (commonInput) {
      const values = Array.from({ length: count }, (_, idx) => {
        const v = settings[`chanAcidPerMilk${idx + 1}`];
        return Number.isFinite(v) ? v : 1.34;
      });
      const allSame = values.every((v) => Math.abs(v - values[0]) < 0.000001);
      commonInput.value = allSame ? formatRaw(values[0]) : '';
    }
    wrap.innerHTML = '';
    for (let i = 1; i <= count; i++) {
      const key = `chanAcidPerMilk${i}`;
      const value = Number.isFinite(settings[key]) ? settings[key] : 1.34;
      const currentLoad = lastChanLoads[i - 1];
      const partyHint = currentLoad && currentLoad.partyCount > 0
        ? ` • ${currentLoad.partyCount} парт. (${formatChanParties(currentLoad.parties)})`
        : '';
      const row = document.createElement('div');
      row.className = 'setting-row';
      row.innerHTML = `
        <label for="chan-acid-${i}">Чан ${i}${partyHint}: молоко кг × коэффициент</label>
        <input class="setting-input" id="chan-acid-${i}" inputmode="decimal" value="${formatRaw(value)}" />
      `;
      wrap.appendChild(row);
    }
  }

  function applyChanAcidToAll() {
    const input = $('chan-acid-all');
    if (!input) return;
    const raw = String(input.value || '').trim().replace(',', '.');
    const value = Number(raw);
    if (!raw || !Number.isFinite(value) || value <= 0) {
      toast('Проверьте общий коэффициент лимонки');
      input.focus();
      return;
    }

    const count = Math.max(1, Math.min(20, lastChanCount || 1));
    for (let i = 1; i <= count; i++) {
      settings[`chanAcidPerMilk${i}`] = value;
      const vatInput = $(`chan-acid-${i}`);
      if (vatInput) vatInput.value = formatRaw(value);
    }

    saveSettings(settings);
    calculateChan({ keepCurrentTab: true });
    calculateProductSectionsFromFilling();
    buildChanAcidSettingsFields(lastChanCount);
    const commonInput = $('chan-acid-all');
    if (commonInput) commonInput.value = formatRaw(value);
    toast(`Лимонка ${formatRaw(value)} применена ко всем чанам`);
  }

  function saveChanAcidSettings() {
    const count = Math.max(1, Math.min(20, lastChanCount || 1));
    for (let i = 1; i <= count; i++) {
      const input = $(`chan-acid-${i}`);
      if (!input) continue;
      const raw = String(input.value || '').trim().replace(',', '.');
      const value = Number(raw);
      if (!raw || !Number.isFinite(value) || value <= 0) {
        toast(`Проверьте коэффициент для чана ${i}`);
        input.focus();
        return;
      }
      settings[`chanAcidPerMilk${i}`] = value;
    }
    saveSettings(settings);
    calculateChan({ keepCurrentTab: true });
    calculateProductSectionsFromFilling();
    buildChanAcidSettingsFields(lastChanCount);
    toast('Коэффициенты чанов сохранены');
  }

  function resetChanAcidSettings() {
    const count = Math.max(1, Math.min(20, lastChanCount || 1));
    for (let i = 1; i <= count; i++) settings[`chanAcidPerMilk${i}`] = 1.34;
    saveSettings(settings);
    calculateChan({ keepCurrentTab: true });
    calculateProductSectionsFromFilling();
    buildChanAcidSettingsFields(lastChanCount);
    toast('Коэффициенты чанов сброшены');
  }

  function toggleSettings() {
    const panel = $('settingsPanel');
    const show = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !show);
    $('toggleSettings').textContent = show ? 'Скрыть настройки формул' : 'Показать настройки формул';
  }

  function openSettingsFromOtherTab() {
    showTab('burrata');
    const panel = $('settingsPanel');
    panel.classList.remove('hidden');
    $('toggleSettings').textContent = 'Скрыть настройки формул';
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 140);
  }

  function buildSettingsFields() {
    const wrap = $('settingsFields');
    wrap.innerHTML = '';
    SETTINGS_GROUPS.forEach((group) => {
      const h = document.createElement('div');
      h.className = 'settings-group-title';
      h.textContent = group.title;
      wrap.appendChild(h);

      group.fields.forEach(([key, label, def]) => {
        const row = document.createElement('div');
        row.className = 'setting-row';
        row.innerHTML = `
          <label for="set-${key}">${escapeHtml(label)} • по умолчанию: ${escapeHtml(def)}</label>
          <input class="setting-input" id="set-${key}" inputmode="decimal" value="${formatRaw(settings[key])}" />
        `;
        wrap.appendChild(row);
      });
    });
  }

  function updateSettingFields() {
    Object.keys(DEFAULTS).forEach((key) => {
      const input = $(`set-${key}`);
      if (input) input.value = formatRaw(settings[key]);
    });
  }

  function readSettingsFromFields(showToast) {
    const s = { ...DEFAULTS, ...settings };
    for (const group of SETTINGS_GROUPS) {
      for (const [key, label] of group.fields) {
        const input = $(`set-${key}`);
        const raw = String(input.value || '').trim().replace(',', '.');
        if (!raw) {
          showToast ? toast(`Заполните поле: ${label}`) : showError(currentResultsEl(), `В настройках не заполнено поле: ${label}`);
          return null;
        }
        const value = Number(raw);
        if (!Number.isFinite(value)) {
          showToast ? toast(`Ошибка в поле: ${label}`) : showError(currentResultsEl(), `В настройках неверное число: ${label}`);
          return null;
        }
        if (value <= 0) {
          showToast ? toast(`Значение должно быть больше 0: ${label}`) : showError(currentResultsEl(), `В настройках значение должно быть больше 0: ${label}`);
          return null;
        }
        s[key] = value;
      }
    }
    if (s.onePartyLimitKg >= s.twoPartyLimitKg || s.twoPartyLimitKg >= s.threePartyLimitKg) {
      showToast ? toast('Лимиты классики должны идти по возрастанию') : showError(currentResultsEl(), 'Лимиты партий классики должны идти по возрастанию: 1 партия < 2 партии < 3 партии.');
      return null;
    }
    if (s.truffleOnePartyLimitKg >= s.truffleTwoPartyLimitKg) {
      showToast ? toast('Лимиты трюфеля должны идти по возрастанию') : showError(currentResultsEl(), 'Лимиты партий трюфеля должны идти по возрастанию: 1 партия < 2 партии.');
      return null;
    }
    return s;
  }

  function currentResultsEl() {
    if (currentTab === 'filling') return $('fillingResults');
    if (currentTab === 'truffle') return $('truffleResults');
    if (currentTab === 'chan') return $('chanResults');
    return $('burrataResults');
  }

  function addStartMessages() {
    $('fillingResults').innerHTML = startCard('Введите кг классики и/или трюфеля. Можно заполнить только один вид. Партии можно оставить пустыми — они подставятся автоматически. Данные сразу переносятся в разделы Классика/Трюфель, а после расчёта обновляются их итоги и раздел Чан. Соли здесь нет. Дополнительные настройки спрятаны в плюсик.');
    $('burrataResults').innerHTML = startCard('Введите заявку классики в кг. Партии можно не указывать — они подставятся автоматически. Также можно указать коробки по партиям, например 20/41/41/41. В одной коробке по умолчанию 6 штук, ОТК добавляется отдельно и в коробки не входит.');
    $('truffleResults').innerHTML = startCard('Введите заявку трюфельной классики. Можно указать коробки по партиям, например 22. По умолчанию: 95 г начинки на штуку, 2100 г на таз.');
    $('chanResults').innerHTML = startCard('Заполните первый раздел “Начинка” и нажмите “Рассчитать начинку” — чан пересчитается автоматически.');
  }


  function syncFillingToProductInputs(onlyFilled) {
    const pairs = [
      ['fillingClassicKg', 'burrataKg'],
      ['fillingClassicParties', 'burrataManualParties'],
      ['fillingClassicExtraPieces', 'burrataExtraPieces'],
      ['fillingTruffleKg', 'truffleKg'],
      ['fillingTruffleParties', 'truffleManualParties'],
      ['fillingTruffleExtraPieces', 'truffleExtraPieces']
    ];
    pairs.forEach(([fromId, toId]) => {
      const from = $(fromId);
      const to = $(toId);
      if (!from || !to) return;
      const value = String(from.value || '').trim();
      if (onlyFilled && !value) return;
      to.value = value;
    });
    updateProductSourceSummaries();
    saveFormState();
  }

  function resetBoxesAfterFillingChange(changedId) {
    const resetClassicBoxes = changedId === 'fillingClassicKg' || changedId === 'fillingClassicParties';
    const resetTruffleBoxes = changedId === 'fillingTruffleKg' || changedId === 'fillingTruffleParties';
    if (resetClassicBoxes) {
      const boxes = $('burrataBoxesByParty');
      if (boxes && boxes.value) boxes.value = '';
    }
    if (resetTruffleBoxes) {
      const boxes = $('truffleBoxesByParty');
      if (boxes && boxes.value) boxes.value = '';
    }
  }

  function hasProductInputForAutoCalc(isTruffle) {
    const kgInput = isTruffle ? $('truffleKg') : $('burrataKg');
    const partiesInput = isTruffle ? $('truffleManualParties') : $('burrataManualParties');
    const boxesInput = isTruffle ? $('truffleBoxesByParty') : $('burrataBoxesByParty');
    return !!(
      String(kgInput && kgInput.value || '').trim() ||
      String(partiesInput && partiesInput.value || '').trim() ||
      String(boxesInput && boxesInput.value || '').trim()
    );
  }

  function clearProductResultIfEmpty(isTruffle) {
    if (hasProductInputForAutoCalc(isTruffle)) return;
    const results = isTruffle ? $('truffleResults') : $('burrataResults');
    const copyBtn = isTruffle ? $('copyTruffle') : $('copyBurrata');
    if (results) results.innerHTML = startCard(isTruffle
      ? 'Введите трюфель в первом разделе “Начинка” или прямо здесь, затем нажмите расчёт.'
      : 'Введите классику в первом разделе “Начинка” или прямо здесь, затем нажмите расчёт.');
    if (copyBtn) copyBtn.classList.add('hidden');
    saveResultState(isTruffle ? 'truffle' : 'burrata', results ? results.innerHTML : '', '');
  }

  function calculateProductSectionsFromFilling() {
    if (hasProductInputForAutoCalc(false)) calculateProduct(false);
    else clearProductResultIfEmpty(false);

    if (hasProductInputForAutoCalc(true)) calculateProduct(true);
    else clearProductResultIfEmpty(true);
  }

  function readFillingOnlyNumber(id, fallback, label, opts = {}) {
    const input = $(id);
    const raw = String(input && input.value || '').trim().replace(',', '.');
    if (!raw) return fallback;
    const value = Number(raw);
    const allowZero = !!opts.allowZero;
    const integer = !!opts.integer;
    if (!Number.isFinite(value) || value < 0 || (!allowZero && value === 0) || (integer && Math.round(value) !== value)) {
      showError($('fillingResults'), `${label}: введите корректное число${integer ? ' целыми штуками' : ''}.`);
      $('copyFilling').classList.add('hidden');
      return null;
    }
    return value;
  }

  function calculateFilling() {
    currentTab = 'filling';
    const parsed = readSettingsFromFields(false);
    if (!parsed) return;
    settings = parsed;
    saveSettings(settings);

    const results = $('fillingResults');
    const copyBtn = $('copyFilling');
    const fillingOtkPerParty = readFillingOnlyNumber('fillingOtkPerParty', settings.extraPiecesPerParty, 'ОТК на партию', { integer: true });
    if (fillingOtkPerParty === null) return;
    const classicExtraPieces = readFillingOnlyNumber('fillingClassicExtraPieces', 0, 'Классика: дополнительные штуки', { allowZero: true, integer: true });
    if (classicExtraPieces === null) return;
    const truffleExtraPieces = readFillingOnlyNumber('fillingTruffleExtraPieces', 0, 'Трюфель: дополнительные штуки', { allowZero: true, integer: true });
    if (truffleExtraPieces === null) return;
    const classicBowlCapacityG = readFillingOnlyNumber('fillingClassicBowlCapacityG', settings.bowlCapacityG, 'Классика: максимум общего в 1 тазу');
    if (classicBowlCapacityG === null) return;
    const truffleBowlCapacityG = readFillingOnlyNumber('fillingTruffleBowlCapacityG', settings.truffleBowlCapacityG, 'Трюфель: максимум общего в 1 тазу');
    if (truffleBowlCapacityG === null) return;

    syncFillingToProductInputs(false);

    const classic = readFillingProduct(false, results, copyBtn, {
      extraPiecesPerPartyOverride: fillingOtkPerParty,
      manualAdditionalPieces: classicExtraPieces,
      bowlCapacityOverrideG: classicBowlCapacityG
    });
    if (!classic) return;
    const truffle = readFillingProduct(true, results, copyBtn, {
      extraPiecesPerPartyOverride: fillingOtkPerParty,
      manualAdditionalPieces: truffleExtraPieces,
      bowlCapacityOverrideG: truffleBowlCapacityG
    });
    if (!truffle) return;

    if (!classic.active && !truffle.active) {
      showError(results, 'Введите заявку в кг хотя бы для классики или трюфеля. Партии можно оставить пустыми — они рассчитаются автоматически.');
      copyBtn.classList.add('hidden');
      return;
    }

    const products = [classic, truffle].filter((p) => p.active);
    const totals = {
      requestKg: prodRound(products.reduce((sum, p) => sum + p.requestKg, 0)),
      parties: products.reduce((sum, p) => sum + p.parties, 0),
      basePieces: products.reduce((sum, p) => sum + p.basePieces, 0),
      extraPieces: products.reduce((sum, p) => sum + p.extraPieces, 0),
      totalPieces: products.reduce((sum, p) => sum + p.totalPieces, 0),
      additionalPieces: products.reduce((sum, p) => sum + p.additionalPieces, 0),
      cagliataG: prodRound(products.reduce((sum, p) => sum + p.cagliataG, 0)),
      fillingNoLossG: prodRound(products.reduce((sum, p) => sum + p.fillingNoLossG, 0)),
      fillingWithLossG: prodRound(products.reduce((sum, p) => sum + p.fillingWithLossG, 0)),
      bowls: products.reduce((sum, p) => sum + p.bowls, 0),
      stracciatellaG: prodRound(products.reduce((sum, p) => sum + p.stracciatellaG, 0)),
      creamG: prodRound(products.reduce((sum, p) => sum + p.creamG, 0)),
      salsaG: prodRound(products.reduce((sum, p) => sum + p.salsaG, 0))
    };

    const data = { classic, truffle, products, totals };
    results.innerHTML = renderFillingResults(data);
    lastFillingText = buildPlainFillingResult(data);
    copyBtn.classList.remove('hidden');
    saveResultState('filling', results.innerHTML, lastFillingText);

    // Сначала строим распределение партий по чанам.
    // Затем Классика/Трюфель используют коэффициент именно своего чана.
    calculateChan({ keepCurrentTab: true });
    calculateProductSectionsFromFilling();
  }

  function readFillingProduct(isTruffle, results, copyBtn, options = {}) {
    const label = isTruffle ? 'Трюфель' : 'Классика';
    const kgInput = isTruffle ? $('fillingTruffleKg') : $('fillingClassicKg');
    const partiesInput = isTruffle ? $('fillingTruffleParties') : $('fillingClassicParties');
    const rawKg = String(kgInput && kgInput.value || '').trim().replace(',', '.');
    const rawParties = String(partiesInput && partiesInput.value || '').trim().replace(',', '.');

    if (!rawKg && !rawParties) {
      return makeEmptyFillingProduct(label);
    }
    if (!rawKg) {
      showError(results, `${label}: введите заявку в кг.`);
      copyBtn.classList.add('hidden');
      return null;
    }
    const requestKg = Number(rawKg);
    if (!Number.isFinite(requestKg) || requestKg <= 0) {
      showError(results, `${label}: заявка должна быть числом больше 0. Пример: 45 или 45,5.`);
      copyBtn.classList.add('hidden');
      return null;
    }
    let manualParties = null;
    if (rawParties) {
      manualParties = parseManualParties(rawParties, results, copyBtn);
      if (manualParties === null) return null;
    }

    const plan = buildProductPlan({
      requestKg,
      boxesByParty: [],
      manualParties,
      isTruffle,
      extraPiecesPerPartyOverride: options.extraPiecesPerPartyOverride,
      manualAdditionalPieces: options.manualAdditionalPieces
    });
    const fillingPerPieceG = options.fillingPerPieceOverrideG || (isTruffle ? settings.truffleFillingPerPieceG : settings.fillingPerPieceG);
    const bowlCapacityG = options.bowlCapacityOverrideG || (isTruffle ? settings.truffleBowlCapacityG : settings.bowlCapacityG);
    const partyResults = [];
    let totalCagliataG = 0;
    let totalFillingNoLossG = 0;
    let totalFillingWithLossG = 0;
    let totalBowls = 0;
    let totalStracciatellaG = 0;
    let totalCreamG = 0;
    let totalSalsaG = 0;

    for (let i = 1; i <= plan.parties; i++) {
      const p = { index: i, isTruffle, label };
      p.basePieces = plan.basePiecesByParty[i - 1];
      p.extraPieces = plan.extraPiecesPerParty;
      p.additionalPieces = plan.additionalPiecesByParty[i - 1] || 0;
      p.pieces = plan.piecesByParty[i - 1];
      p.cagliataG = prodRound(p.pieces * settings.cagliataPerPieceG);
      p.fillingNoLossG = prodRound(p.pieces * fillingPerPieceG);
      p.dispenserLossG = i === 1 ? prodRound(settings.dispenserLossG) : 0;
      p.bowls = calculateBowlCount(p.fillingNoLossG, bowlCapacityG, settings.bowlLossG, p.dispenserLossG);
      p.bowlLossG = prodRound(p.bowls * settings.bowlLossG);
      p.fillingWithLossG = prodRound(p.fillingNoLossG + p.bowlLossG + p.dispenserLossG);
      p.fillingPerBowlG = prodRound(p.fillingWithLossG / p.bowls);
      p.stracciatellaG = prodRound(p.fillingWithLossG / settings.stracciatellaDivisor);
      p.stracciatellaPerBowlG = prodRound(p.stracciatellaG / p.bowls);
      p.creamSubtractionG = getCreamSubtraction(p.stracciatellaG);
      p.creamG = prodRound(p.stracciatellaG - p.creamSubtractionG);
      p.creamPerBowlG = prodRound(p.creamG / p.bowls);
      if (isTruffle) {
        p.salsaJarG = salsaJarForFilling(p.fillingPerBowlG);
        p.salsaTotalG = prodRound(p.salsaJarG * p.bowls);
      } else {
        p.salsaJarG = 0;
        p.salsaTotalG = 0;
      }
      totalCagliataG += p.cagliataG;
      totalFillingNoLossG += p.fillingNoLossG;
      totalFillingWithLossG += p.fillingWithLossG;
      totalBowls += p.bowls;
      totalStracciatellaG += p.stracciatellaG;
      totalCreamG += p.creamG;
      totalSalsaG += p.salsaTotalG;
      partyResults.push(p);
    }

    return {
      active: true,
      label,
      isTruffle,
      requestKg: plan.requestKg,
      parties: plan.parties,
      basePieces: plan.basePieces,
      extraPieces: plan.extraPieces,
      additionalPieces: plan.additionalPieces,
      totalPieces: plan.totalPieces,
      cagliataG: prodRound(totalCagliataG),
      fillingNoLossG: prodRound(totalFillingNoLossG),
      fillingWithLossG: prodRound(totalFillingWithLossG),
      bowls: totalBowls,
      stracciatellaG: prodRound(totalStracciatellaG),
      creamG: prodRound(totalCreamG),
      salsaG: prodRound(totalSalsaG),
      partyResults
    };
  }

  function makeEmptyFillingProduct(label) {
    return {
      active: false,
      label,
      isTruffle: label === 'Трюфель',
      requestKg: 0,
      parties: 0,
      basePieces: 0,
      extraPieces: 0,
      additionalPieces: 0,
      totalPieces: 0,
      cagliataG: 0,
      fillingNoLossG: 0,
      fillingWithLossG: 0,
      bowls: 0,
      stracciatellaG: 0,
      creamG: 0,
      salsaG: 0,
      partyResults: []
    };
  }

  function renderFillingResults(data) {
    const productCards = [data.classic, data.truffle].map((p) => renderFillingProductSummary(p)).join('');
    const partyCards = data.products.map((p) => renderFillingPartyGroup(p)).join('');
    return `
      ${headerCard('Итог начинки', `${fmt(data.totals.requestKg)} кг • ${fmt(data.totals.totalPieces)} шт.`, `${data.totals.parties} парт. • без коробок и без соли`)}
      <div class="section-title">Главные результаты</div>
      <div class="metrics-grid">
        ${metric('Начинка всего без потерь', `${fmt(data.totals.fillingNoLossG)} г`, 'soft-green')}
        ${metric('Начинка с потерями', `${fmt(data.totals.fillingWithLossG)} г`, 'soft-orange')}
        ${metric('Тазов всего', `${data.totals.bowls}`, 'soft-blue')}
        ${metric('Страчителла всего', `${fmt(data.totals.stracciatellaG)} г`, 'soft-green')}
        ${metric('Сливки всего', `${fmt(data.totals.creamG)} г`, 'soft-orange')}
        ${metric('Кальятта расплав', `${fmt(data.totals.cagliataG)} г`, 'soft-green')}
        ${metric('ОТК всего', `+${fmt(data.totals.extraPieces)} шт.`, 'soft-blue')}
        ${data.totals.additionalPieces > 0 ? metric('Доп. штуки', `+${fmt(data.totals.additionalPieces)} шт.`, 'soft-blue') : ''}
        ${data.totals.salsaG > 0 ? metric('Сальса трюфель', `${fmt(data.totals.salsaG)} г`, 'soft-orange') : ''}
      </div>
      <details class="collapsible-section">
        <summary class="section-title collapsible-summary">Классика / трюфель</summary>
        <div class="collapsible-body">
          ${productCards}
        </div>
      </details>
      <div class="section-title">По партиям</div>
      ${partyCards}
      <div class="card note-card">Эта главная страница считает начинку и автоматически обновляет раздел “Чан”. Коробки не учитываются, соль не выводится. ОТК, дополнительные штуки и максимум общего количества в 1 тазу находятся в “+ Настройки начинки”.</div>
    `;
  }

  function renderFillingProductSummary(p) {
    if (!p.active) return `<div class="card">${line(p.label, 'не заполнено')}</div>`;
    return `
      <div class="card">
        ${strongLine(p.label, `${fmt(p.requestKg)} кг • ${p.parties} парт. • ${fmt(p.totalPieces)} шт. всего`, 'primary')}
        ${line('Штук без ОТК / ОТК / доп.', `${fmt(p.basePieces)} / +${fmt(p.extraPieces)} / +${fmt(p.additionalPieces)} шт.`)}
        ${line('Кальятта расплав', `${fmt(p.cagliataG)} г`)}
        ${line('Начинка всего без потерь', `${fmt(p.fillingNoLossG)} г`)}
        ${strongLine('Начинка с потерями', `${fmt(p.fillingWithLossG)} г`, 'warning')}
        ${strongLine('Тазов', `${p.bowls}`, 'primary')}
        ${line('Страчителла / сливки', `${fmt(p.stracciatellaG)} г / ${fmt(p.creamG)} г`)}
        ${p.salsaG > 0 ? line('Сальса', `${fmt(p.salsaG)} г`) : ''}
      </div>
    `;
  }

  function renderFillingPartyGroup(product) {
    if (!product.active) return '';
    return product.partyResults.map((p) => `
      <div class="card">
        <h3 class="party-title">${escapeHtml(product.label)} • партия ${p.index}</h3>
        ${line('Штук без ОТК / ОТК / доп.', `${fmt(p.basePieces)} / +${fmt(p.extraPieces)} / +${fmt(p.additionalPieces)} шт.`)}
        ${strongLine('Штук всего', `${fmt(p.pieces)} шт.`, 'success')}
        ${line('Кальятта расплав', `${fmt(p.cagliataG)} г`)}
        ${strongLine('Тазов', `${p.bowls}`, 'primary')}
        ${line('Начинка всего без потерь', `${fmt(p.fillingNoLossG)} г`)}
        ${strongLine('Начинка с потерями', `${fmt(p.fillingWithLossG)} г`, 'warning')}
        ${line('Общее в 1 тазу', `${fmt(p.fillingPerBowlG)} г`)}
        ${line('Страчителла на 1 таз', `${fmt(p.stracciatellaPerBowlG)} г`)}
        ${line('Сливки на 1 таз', `${fmt(p.creamPerBowlG)} г`)}
        ${p.isTruffle ? line('Сальса всего', `${fmt(p.salsaTotalG)} г`) : ''}
      </div>
    `).join('');
  }

  function buildPlainFillingResult(data) {
    let sb = 'Расчёт начинки\n\n';
    sb += `Заявка всего: ${fmt(data.totals.requestKg)} кг\n`;
    sb += `Партии всего: ${data.totals.parties}\n`;
    sb += `Штук всего с ОТК: ${fmt(data.totals.totalPieces)} шт.\n`;
    sb += `ОТК всего: +${fmt(data.totals.extraPieces)} шт.\n`;
    if (data.totals.additionalPieces > 0) sb += `Дополнительные штуки всего: +${fmt(data.totals.additionalPieces)} шт.\n`;
    sb += `Кальятта расплав всего: ${fmt(data.totals.cagliataG)} г\n`;
    sb += `Начинка всего без потерь: ${fmt(data.totals.fillingNoLossG)} г\n`;
    sb += `Начинка с потерями всего: ${fmt(data.totals.fillingWithLossG)} г\n`;
    sb += `Тазов всего: ${data.totals.bowls}\n`;
    sb += `Страчителла всего: ${fmt(data.totals.stracciatellaG)} г\n`;
    sb += `Сливки всего: ${fmt(data.totals.creamG)} г\n`;
    if (data.totals.salsaG > 0) sb += `Сальса трюфель всего: ${fmt(data.totals.salsaG)} г\n`;
    sb += '\n';
    data.products.forEach((product) => {
      sb += `${product.label}\n`;
      sb += `Заявка: ${fmt(product.requestKg)} кг\n`;
      sb += `Партии: ${product.parties}\n`;
      sb += `Штук без ОТК: ${fmt(product.basePieces)} шт.\n`;
      sb += `ОТК: +${fmt(product.extraPieces)} шт.\n`;
      if (product.additionalPieces > 0) sb += `Дополнительные штуки: +${fmt(product.additionalPieces)} шт.\n`;
      sb += `Штук всего: ${fmt(product.totalPieces)} шт.\n`;
      sb += `Кальятта расплав: ${fmt(product.cagliataG)} г\n`;
      sb += `Начинка всего без потерь: ${fmt(product.fillingNoLossG)} г\n`;
      sb += `Начинка с потерями: ${fmt(product.fillingWithLossG)} г\n`;
      sb += `Тазов: ${product.bowls}\n`;
      sb += `Страчителла: ${fmt(product.stracciatellaG)} г\n`;
      sb += `Сливки: ${fmt(product.creamG)} г\n`;
      if (product.salsaG > 0) sb += `Сальса: ${fmt(product.salsaG)} г\n`;
      product.partyResults.forEach((p) => {
        sb += `  Партия ${p.index}: ${fmt(p.pieces)} шт., тазов ${p.bowls}, начинка ${fmt(p.fillingWithLossG)} г, в 1 тазу ${fmt(p.fillingPerBowlG)} г, страчителла/сливки на таз ${fmt(p.stracciatellaPerBowlG)} / ${fmt(p.creamPerBowlG)} г\n`;
      });
      sb += '\n';
    });
    sb += 'Без коробок и без соли.\n';
    return sb;
  }


  function calculateProduct(isTruffle) {
    const parsed = readSettingsFromFields(false);
    if (!parsed) return;
    settings = parsed;
    saveSettings(settings);

    const input = isTruffle ? $('truffleKg') : $('burrataKg');
    const manualPartiesInput = isTruffle ? $('truffleManualParties') : $('burrataManualParties');
    const boxesInput = isTruffle ? $('truffleBoxesByParty') : $('burrataBoxesByParty');
    const extraPiecesInput = isTruffle ? $('truffleExtraPieces') : $('burrataExtraPieces');
    const results = isTruffle ? $('truffleResults') : $('burrataResults');
    const copyBtn = isTruffle ? $('copyTruffle') : $('copyBurrata');
    const raw = String(input.value || '').trim().replace(',', '.');
    const rawManualParties = String(manualPartiesInput.value || '').trim().replace(',', '.');
    const rawBoxes = String(boxesInput.value || '').trim();
    const rawExtraPieces = String(extraPiecesInput && extraPiecesInput.value || '').trim().replace(',', '.');

    if (!raw && !rawBoxes) {
      showError(results, 'Введите заявку в кг или коробки по партиям. Пример коробок: 20/41/41/41.');
      copyBtn.classList.add('hidden');
      return;
    }

    let requestKg = raw ? Number(raw) : Number.NaN;
    if (raw && !Number.isFinite(requestKg)) {
      showError(results, 'Заявка должна быть числом. Пример: 45 или 45,5.');
      copyBtn.classList.add('hidden');
      return;
    }
    if (raw && requestKg <= 0) {
      showError(results, 'Заявка должна быть больше 0 кг.');
      copyBtn.classList.add('hidden');
      return;
    }

    const boxesByParty = parseBoxesByParty(rawBoxes, results, copyBtn);
    if (boxesByParty === null) return;

    const manualParties = parseManualParties(rawManualParties, results, copyBtn);
    if (manualParties === null) return;

    const manualAdditionalPieces = parseAdditionalPieces(rawExtraPieces, results, copyBtn);
    if (manualAdditionalPieces === null) return;

    const fillingPerPieceG = isTruffle ? settings.truffleFillingPerPieceG : settings.fillingPerPieceG;
    const bowlCapacityG = isTruffle ? settings.truffleBowlCapacityG : settings.bowlCapacityG;
    const plan = buildProductPlan({ requestKg, boxesByParty, manualParties, isTruffle, manualAdditionalPieces });
    requestKg = plan.requestKg;

    let totalRennet = 0;
    let totalCagliataG = 0;
    let totalFillingWithLosses = 0;
    let totalStracciatella = 0;
    let totalCream = 0;
    let totalSaltCagliata = 0;
    let totalSaltStracciatella = 0;
    let totalSaltCream = 0;
    let totalSalt = 0;
    let totalLosses = 0;
    let totalAcid = 0;
    let totalSalsa = 0;
    let totalBowls = 0;
    const partyResults = [];

    for (let i = 1; i <= plan.parties; i++) {
      const pr = { index: i, hasSalsa: isTruffle };
      pr.boxes = plan.boxesByParty ? plan.boxesByParty[i - 1] : null;
      pr.basePieces = plan.basePiecesByParty[i - 1];
      pr.extraPieces = plan.extraPiecesPerParty;
      pr.additionalPieces = plan.additionalPiecesByParty[i - 1] || 0;
      pr.milkKg = plan.milkByPartyKg[i - 1];
      pr.milkLiters = prodRound(pr.milkKg / settings.milkDensity);
      pr.chanCmText = rulerText(pr.milkLiters);
      pr.chanIndex = getPartyChanIndex(isTruffle, i, plan.parties);
      pr.acidPerMilk = getChanAcidPerMilk(pr.chanIndex);
      pr.citricAcidG = prodRound(pr.milkKg * pr.acidPerMilk);
      pr.rennetG = prodRound(pr.milkKg * settings.rennetPerMilk);
      pr.pieces = plan.piecesByParty[i - 1];
      pr.cagliataG = prodRound(pr.pieces * settings.cagliataPerPieceG);
      pr.fillingNoLossG = prodRound(pr.pieces * fillingPerPieceG);
      pr.dispenserLossG = i === 1 ? prodRound(settings.dispenserLossG) : 0;
      pr.bowls = calculateBowlCount(pr.fillingNoLossG, bowlCapacityG, settings.bowlLossG, pr.dispenserLossG);
      pr.bowlLossG = prodRound(pr.bowls * settings.bowlLossG);
      pr.fillingWithLossG = prodRound(pr.fillingNoLossG + pr.bowlLossG + pr.dispenserLossG);
      pr.fillingPerBowlG = prodRound(pr.fillingWithLossG / pr.bowls);
      pr.stracciatellaG = prodRound(pr.fillingWithLossG / settings.stracciatellaDivisor);
      pr.stracciatellaPerBowlG = prodRound(pr.stracciatellaG / pr.bowls);
      pr.creamSubtractionG = getCreamSubtraction(pr.stracciatellaG);
      pr.creamG = prodRound(pr.stracciatellaG - pr.creamSubtractionG);
      pr.creamPerBowlG = prodRound(pr.creamG / pr.bowls);
      pr.totalPerBowlG = pr.fillingPerBowlG;
      pr.saltCagliataG = prodRound(pr.cagliataG * settings.saltRate);
      pr.saltStracciatellaG = prodRound(pr.stracciatellaG * settings.saltRate);
      pr.saltCreamG = prodRound((pr.creamG / 1000) * settings.creamSaltPerKgG);
      pr.saltG = prodRound(pr.saltCagliataG + pr.saltStracciatellaG + pr.saltCreamG);
      if (isTruffle) {
        pr.salsaJarG = salsaJarForFilling(pr.fillingPerBowlG);
        pr.salsaTotalG = prodRound(pr.salsaJarG * pr.bowls);
      } else {
        pr.salsaJarG = 0;
        pr.salsaTotalG = 0;
      }

      totalAcid += pr.citricAcidG;
      totalRennet += pr.rennetG;
      totalCagliataG += pr.cagliataG;
      totalFillingWithLosses += pr.fillingWithLossG;
      totalStracciatella += pr.stracciatellaG;
      totalCream += pr.creamG;
      totalSaltCagliata += pr.saltCagliataG;
      totalSaltStracciatella += pr.saltStracciatellaG;
      totalSaltCream += pr.saltCreamG;
      totalSalt += pr.saltG;
      totalLosses += pr.bowlLossG + pr.dispenserLossG;
      totalBowls += pr.bowls;
      totalSalsa += pr.salsaTotalG;
      partyResults.push(pr);
    }

    totalAcid = prodRound(totalAcid);
    totalRennet = prodRound(totalRennet);
    totalCagliataG = prodRound(totalCagliataG);
    totalFillingWithLosses = prodRound(totalFillingWithLosses);
    totalStracciatella = prodRound(totalStracciatella);
    totalCream = prodRound(totalCream);
    totalSaltCagliata = prodRound(totalSaltCagliata);
    totalSaltStracciatella = prodRound(totalSaltStracciatella);
    totalSaltCream = prodRound(totalSaltCream);
    totalSalt = prodRound(totalSalt);
    totalLosses = prodRound(totalLosses);
    totalSalsa = prodRound(totalSalsa);

    const resultData = {
      isTruffle,
      requestKg,
      parties: plan.parties,
      basePieces: plan.basePieces,
      extraPieces: plan.extraPieces,
      additionalPieces: plan.additionalPieces,
      totalPieces: plan.totalPieces,
      requestWithOtkKg: plan.requestWithOtkKg,
      totalMilkKg: plan.totalMilkKg,
      totalCagliataG,
      totalFillingWithLosses,
      totalStracciatella,
      totalCream,
      totalSaltCagliata,
      totalSaltStracciatella,
      totalSaltCream,
      totalSalt,
      totalBowls,
      totalAcid,
      totalRennet,
      totalSalsa,
      partyResults,
      boxesByParty: plan.boxesByParty,
      boxesTotal: plan.boxesTotal,
      usedBoxes: !!plan.boxesByParty,
      manualPartiesUsed: !plan.boxesByParty && !!manualParties
    };

    results.innerHTML = renderProductResults(resultData);
    const plain = buildPlainResult({
      ...resultData,
      totalLosses
    });

    if (isTruffle) lastTruffleText = plain;
    else lastBurrataText = plain;
    copyBtn.classList.remove('hidden');
    saveResultState(isTruffle ? 'truffle' : 'burrata', results.innerHTML, plain);
  }

  function renderProductResults(data) {
    const partyCards = data.partyResults.map((p) => renderPartyCard(p)).join('');
    const boxInfo = data.usedBoxes
      ? ` • Коробки: ${data.boxesByParty.map((v) => fmt(v)).join('/')} = ${fmt(data.boxesTotal)} кор. • ${formatRaw(settings.piecesPerBox)} шт. в коробке`
      : (data.manualPartiesUsed ? ' • Количество партий задано вручную' : '');
    const extraInfo = data.additionalPieces > 0 ? ` • Доп. штуки: +${fmt(data.additionalPieces)} шт.` : '';
    return `
      ${headerCard('Итог заявки', `${fmt(data.requestKg)} кг • ${fmt(data.totalPieces)} шт. • ${data.parties} парт.`, `Без ОТК: ${fmt(data.basePieces)} шт. • ОТК: +${fmt(data.extraPieces)} шт.${extraInfo}${boxInfo}`)}
      <div class="section-title">Главные результаты</div>
      <div class="metrics-grid">
        ${metric('Заявка', `${fmt(data.requestKg)} кг`, 'soft-green')}
        ${metric('Штук всего с ОТК', `${fmt(data.totalPieces)} шт.`, 'soft-green')}
        ${data.additionalPieces > 0 ? metric('Доп. штуки', `+${fmt(data.additionalPieces)} шт.`, 'soft-blue') : ''}
        ${metric('Кальятта расплав', `${fmt(data.totalCagliataG)} г`, 'soft-orange')}
        ${metric('Молоко', `${fmt(data.totalMilkKg)} кг`, 'soft-blue')}
        ${metric('Начинка с потерями', `${fmt(data.totalFillingWithLosses)} г`, 'soft-orange')}
        ${metric('Тазов всего', `${data.totalBowls}`, 'soft-blue')}
        ${metric('Страчителла', `${fmt(data.totalStracciatella)} г`, 'soft-green')}
        ${metric('Сливки', `${fmt(data.totalCream)} г`, 'soft-orange')}
        ${metric('Соль кальятта', `${fmt(data.totalSaltCagliata)} г`, 'soft-orange')}
        ${metric('Соль страчителла', `${fmt(data.totalSaltStracciatella)} г`, 'soft-orange')}
        ${metric('Соль в сливки', `${fmt(data.totalSaltCream)} г`, 'soft-orange')}
        ${metric('Соль всего', `${fmt(data.totalSalt)} г`, 'soft-orange')}
        ${metric('Лимонная кислота', `${fmt(data.totalAcid)} г`, 'soft-blue')}
        ${metric('Фермент', `${fmt(data.totalRennet)} г`, 'soft-blue')}
        ${data.isTruffle ? metric('Сальса всего', `${fmt(data.totalSalsa)} г`, 'soft-orange') + metric('Баночки/тазы', `${data.totalBowls}`, 'soft-blue') : ''}
      </div>
      <div class="section-title">Подробно по партиям</div>
      ${partyCards}
      <div class="card note-card">Примечание: заявка в кг показывается как исходная. Штуки, молоко, начинка и главные результаты считаются с ОТК. Если заполнены коробки по партиям, количество партий берётся по числу значений, а ОТК добавляется отдельно и в коробки не входит. Кальятта расплав считается по ${formatRaw(settings.cagliataPerPieceG)} г на 1 шт. Соль в сливки считается по ${formatRaw(settings.creamSaltPerKgG)} г на 1 кг сливок. Начинка в 1 тазу считается как начинка с потерями / количество тазов. Молоко по партиям распределяется от общего количества с ОТК так, чтобы сумма партий точно совпадала с общим молоком. Коэффициент лимонной кислоты берётся из того чана, к которому распределена партия.</div>
    `;
  }

  function renderPartyCard(p) {
    return `
      <div class="card">
        <h3 class="party-title">Партия ${p.index}</h3>
        ${p.boxes !== null ? line('Коробок в партии', `${fmt(p.boxes)} кор. × ${formatRaw(settings.piecesPerBox)} шт.`) : ''}
        ${line('Штук без ОТК', `${fmt(p.basePieces)} шт.`)}
        ${line('ОТК', `+${fmt(p.extraPieces)} шт.`)}
        ${p.additionalPieces > 0 ? line('Дополнительные штуки', `+${fmt(p.additionalPieces)} шт.`) : ''}
        ${strongLine('Штук всего в партии', `${fmt(p.pieces)} шт.`, 'success')}
        ${strongLine('Кальятта расплав на партию', `${fmt(p.cagliataG)} г`, 'warning')}
        <div class="divider"></div>
        ${line('Молоко', `${fmt(p.milkKg)} кг`)}
        ${line('Литры', `${fmt(p.milkLiters)} л`)}
        ${strongLine('Чан', `${p.chanIndex}`, 'primary')}
        ${line('Линейка партии', p.chanCmText)}
        ${line('Лимонка: молоко кг ×', formatRaw(p.acidPerMilk))}
        ${strongLine('Лимонная кислота', `${fmt(p.citricAcidG)} г`, 'primary')}
        ${line('Фермент', `${fmt(p.rennetG)} г`)}
        <div class="divider"></div>
        ${strongLine('Тазов в партии', `${p.bowls}`, 'primary')}
        ${strongLine('Начинка с потерями', `${fmt(p.fillingWithLossG)} г`, 'warning')}
        ${strongLine('Общее в 1 тазу', `${fmt(p.totalPerBowlG)} г`, 'warning')}
        <div class="divider"></div>
        ${strongLine('Страчителла на 1 таз', `${fmt(p.stracciatellaPerBowlG)} г`, 'success')}
        ${strongLine('Сливки на 1 таз', `${fmt(p.creamPerBowlG)} г`, 'primary')}
        ${p.hasSalsa ? `
          <div class="divider"></div>
          ${strongLine('Сальса на баночку', `${fmt(p.salsaJarG)} г`, 'warning')}
          ${strongLine('Сальса всего', `${fmt(p.salsaTotalG)} г`, 'primary')}
          ${p.salsaJarG === 18 ? line('Подсказка', '18 г: можно перекинуть 2 г из одной банки') : ''}
        ` : ''}
        <div class="divider"></div>
        ${line('Страчителла всего в партии', `${fmt(p.stracciatellaG)} г`)}
        ${line('Сливки всего в партии', `${fmt(p.creamG)} г`)}
        ${strongLine('Соль кальятта', `${fmt(p.saltCagliataG)} г`, 'warning')}
        ${strongLine('Соль страчителла', `${fmt(p.saltStracciatellaG)} г`, 'warning')}
        ${strongLine('Соль в сливки', `${fmt(p.saltCreamG)} г`, 'warning')}
        ${strongLine('Соль всего на партию', `${fmt(p.saltG)} г`, 'primary')}
      </div>
    `;
  }


  function parseBoxesByParty(rawBoxes, results, copyBtn) {
    if (!rawBoxes) return [];
    const cleaned = rawBoxes.replace(/,/g, '.').replace(/[\\|;\s]+/g, '/');
    const parts = cleaned.split('/').map((v) => v.trim()).filter(Boolean);
    if (!parts.length) return [];
    const values = [];
    for (const part of parts) {
      const value = Number(part);
      if (!Number.isFinite(value) || value <= 0) {
        showError(results, 'Коробки по партиям должны быть числами больше 0. Пример: 20/41/41/41.');
        copyBtn.classList.add('hidden');
        return null;
      }
      values.push(value);
    }
    if (values.length > 30) {
      showError(results, 'Слишком много партий в коробках. Максимум 30.');
      copyBtn.classList.add('hidden');
      return null;
    }
    return values;
  }

  function parseManualParties(raw, results, copyBtn) {
    // Пустое поле означает автоматический расчёт количества партий по заявке в кг.
    if (!raw) return undefined;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 1 || Math.round(value) !== value) {
      showError(results, 'Количество партий вручную должно быть целым числом: 4, 5 и т.д.');
      copyBtn.classList.add('hidden');
      return null;
    }
    if (value > 30) {
      showError(results, 'Слишком много партий. Максимум 30.');
      copyBtn.classList.add('hidden');
      return null;
    }
    return value;
  }

  function parseAdditionalPieces(raw, results, copyBtn) {
    if (!raw) return 0;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || Math.round(value) !== value) {
      showError(results, 'Дополнительные штуки должны быть целым числом: 0, 6, 12 и т.д.');
      copyBtn.classList.add('hidden');
      return null;
    }
    if (value > 10000) {
      showError(results, 'Слишком много дополнительных штук. Проверьте значение.');
      copyBtn.classList.add('hidden');
      return null;
    }
    return value;
  }

  function buildProductPlan({ requestKg, boxesByParty, manualParties, isTruffle, extraPiecesPerPartyOverride, manualAdditionalPieces }) {
    const piecesPerBox = settings.piecesPerBox > 0 ? settings.piecesPerBox : 6;
    let parties;
    let basePiecesByParty;
    let boxesTotal = 0;
    let normalizedBoxes = null;

    if (boxesByParty && boxesByParty.length) {
      normalizedBoxes = boxesByParty;
      parties = normalizedBoxes.length;
      boxesTotal = normalizedBoxes.reduce((sum, v) => sum + v, 0);
      basePiecesByParty = normalizedBoxes.map((boxes) => piecesRound(boxes * piecesPerBox));
      if (!Number.isFinite(requestKg) || requestKg <= 0) {
        requestKg = basePiecesByParty.reduce((sum, v) => sum + v, 0) / settings.requestToPieces;
      }
    } else {
      parties = manualParties || (isTruffle ? getTruffleParties(requestKg) : getParties(requestKg));
      const basePiecesFromKg = piecesRound(requestKg * settings.requestToPieces);
      basePiecesByParty = splitWholeKgToParts(basePiecesFromKg, parties);
    }

    const extraPiecesPerParty = piecesRound(extraPiecesPerPartyOverride !== undefined && extraPiecesPerPartyOverride !== null ? extraPiecesPerPartyOverride : settings.extraPiecesPerParty);
    const additionalPieces = piecesRound(manualAdditionalPieces || 0);
    const additionalPiecesByParty = splitWholeKgToParts(additionalPieces, parties);
    const piecesByParty = basePiecesByParty.map((p, idx) => piecesRound(p + extraPiecesPerParty + (additionalPiecesByParty[idx] || 0)));
    const basePieces = sumArray(basePiecesByParty);
    const extraPieces = piecesRound(extraPiecesPerParty * parties);
    const totalPieces = sumArray(piecesByParty);
    const requestWithOtkKg = totalPieces / settings.requestToPieces;
    const totalMilkKg = milkRound(totalPieces * settings.milkPerPieceKg);
    const milkByPartyKg = splitWholeByWeights(totalMilkKg, piecesByParty);

    return {
      requestKg,
      parties,
      basePiecesByParty,
      piecesByParty,
      extraPiecesPerParty,
      additionalPiecesByParty,
      basePieces,
      extraPieces,
      additionalPieces,
      totalPieces,
      requestWithOtkKg,
      totalMilkKg,
      milkByPartyKg,
      boxesByParty: normalizedBoxes,
      boxesTotal
    };
  }

  function splitWholeByWeights(totalKg, weights) {
    const parts = weights.length || 1;
    const total = Math.round(totalKg);
    const weightSum = weights.reduce((sum, v) => sum + Math.max(0, v), 0);
    if (weightSum <= 0) return splitWholeKgToParts(total, parts);
    const raw = weights.map((w) => total * Math.max(0, w) / weightSum);
    const floors = raw.map((v) => Math.floor(v));
    let remainder = total - floors.reduce((sum, v) => sum + v, 0);
    const order = raw.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
    for (let k = 0; k < remainder; k++) floors[order[k % order.length].i] += 1;
    return floors;
  }

  function sumArray(values) {
    return values.reduce((sum, v) => sum + v, 0);
  }

  function readFillingNumberForChan(id, fallback, label, results, opts = {}) {
    const input = $(id);
    const raw = String(input && input.value || '').trim().replace(',', '.');
    if (!raw) return fallback;
    const value = Number(raw);
    const allowZero = !!opts.allowZero;
    const integer = !!opts.integer;
    if (!Number.isFinite(value) || value < 0 || (!allowZero && value === 0) || (integer && Math.round(value) !== value)) {
      showError(results, `${label}: введите корректное число${integer ? ' целыми штуками' : ''}.`);
      $('copyChan').classList.add('hidden');
      return null;
    }
    return value;
  }

  function readProductForChan(isTruffle, results, extraPiecesPerPartyOverride) {
    const label = isTruffle ? 'Трюфель' : 'Классика';
    const input = isTruffle ? $('fillingTruffleKg') : $('fillingClassicKg');
    const manualPartiesInput = isTruffle ? $('fillingTruffleParties') : $('fillingClassicParties');
    const extraPiecesInput = isTruffle ? $('fillingTruffleExtraPieces') : $('fillingClassicExtraPieces');
    const raw = String(input && input.value || '').trim().replace(',', '.');
    const rawManualParties = String(manualPartiesInput && manualPartiesInput.value || '').trim().replace(',', '.');
    const rawExtraPieces = String(extraPiecesInput && extraPiecesInput.value || '').trim().replace(',', '.');

    if (!raw && !rawManualParties) {
      return {
        active: false,
        label,
        requestKg: 0,
        parties: 0,
        basePieces: 0,
        extraPieces: 0,
        additionalPieces: 0,
        totalPieces: 0,
        totalMilkKg: 0,
        milkByPartyKg: [],
        boxesByParty: null,
        boxesTotal: 0,
        usedBoxes: false,
        manualPartiesUsed: false
      };
    }

    if (!raw) {
      showError(results, `${label}: в первом разделе “Начинка” введите заявку в кг.`);
      $('copyChan').classList.add('hidden');
      return null;
    }
    const requestKg = Number(raw);
    if (!Number.isFinite(requestKg) || requestKg <= 0) {
      showError(results, `${label}: заявка в “Начинке” должна быть числом больше 0. Пример: 45 или 45,5.`);
      $('copyChan').classList.add('hidden');
      return null;
    }

    let manualParties = null;
    if (rawManualParties) {
      manualParties = parseManualParties(rawManualParties, results, $('copyChan'));
      if (manualParties === null) return null;
    }

    const manualAdditionalPieces = parseAdditionalPieces(rawExtraPieces, results, $('copyChan'));
    if (manualAdditionalPieces === null) return null;

    const plan = buildProductPlan({
      requestKg,
      boxesByParty: null,
      manualParties,
      isTruffle,
      extraPiecesPerPartyOverride,
      manualAdditionalPieces
    });
    return {
      active: true,
      label,
      requestKg: plan.requestKg,
      parties: plan.parties,
      basePieces: plan.basePieces,
      extraPieces: plan.extraPieces,
      additionalPieces: plan.additionalPieces,
      totalPieces: plan.totalPieces,
      totalMilkKg: plan.totalMilkKg,
      milkByPartyKg: plan.milkByPartyKg.slice(),
      boxesByParty: null,
      boxesTotal: 0,
      usedBoxes: false,
      manualPartiesUsed: !!manualParties
    };
  }

  function calculateChan(options = {}) {
    const previousTab = currentTab;
    currentTab = 'chan';
    try {
    const parsed = readSettingsFromFields(false);
    if (!parsed) return;
    settings = parsed;
    saveSettings(settings);

    const results = $('chanResults');
    const fillingOtkPerParty = readFillingNumberForChan('fillingOtkPerParty', settings.extraPiecesPerParty, 'ОТК на партию в “Начинке”', results, { integer: true });
    if (fillingOtkPerParty === null) return;
    const classicPlan = readProductForChan(false, results, fillingOtkPerParty);
    if (!classicPlan) return;
    const trufflePlan = readProductForChan(true, results, fillingOtkPerParty);
    if (!trufflePlan) return;

    if (!classicPlan.active && !trufflePlan.active) {
      showError(results, 'Заполните заявку в первом разделе “Начинка”, потом снова нажмите расчёт чана. Партии можно оставить пустыми — они рассчитаются автоматически.');
      $('copyChan').classList.add('hidden');
      return;
    }

    const totalRequestKg = classicPlan.requestKg + trufflePlan.requestKg;
    const classicParties = classicPlan.parties;
    const truffleParties = trufflePlan.parties;
    const parties = classicParties + truffleParties;
    const classicPieces = classicPlan.totalPieces;
    const trufflePieces = trufflePlan.totalPieces;
    const basePieces = piecesRound(classicPlan.basePieces + trufflePlan.basePieces);
    const extraPieces = piecesRound(classicPlan.extraPieces + trufflePlan.extraPieces);
    const additionalPieces = piecesRound((classicPlan.additionalPieces || 0) + (trufflePlan.additionalPieces || 0));
    const totalPieces = piecesRound(classicPieces + trufflePieces);
    const requestWithOtkKg = totalPieces / settings.requestToPieces;
    // Общее молоко совпадает с разделами продуктов, но по чанам оно делится
    // независимо от партий — партии используются только как привязка к чанам.
    const totalMilkKg = milkRound(classicPlan.totalMilkKg + trufflePlan.totalMilkKg);
    const boxesTotal = prodRound((classicPlan.boxesTotal || 0) + (trufflePlan.boxesTotal || 0));

    if (totalMilkKg <= 0) {
      showError(results, 'Количество молока должно быть больше 0 кг.');
      $('copyChan').classList.add('hidden');
      return;
    }

    const totalLiters = prodRound(totalMilkKg / settings.milkDensity);
    const rulerTotal = rulerText(totalLiters);
    const chanLoads = splitPartiesToChans(classicPlan, trufflePlan, totalMilkKg);
    const chanCount = chanLoads.length;
    lastChanLoads = chanLoads;
    lastChanCount = Math.max(1, chanCount);
    if ($('chanSettingsPanel') && !$('chanSettingsPanel').classList.contains('hidden')) {
      buildChanAcidSettingsFields(lastChanCount);
    }
    const milkPerChanKg = chanCount > 0 ? prodRound(totalMilkKg / chanCount) : 0;
    const litersPerChan = chanCount > 0 ? prodRound(milkPerChanKg / settings.milkDensity) : 0;
    const rulerPerChan = rulerText(litersPerChan);
    let totalAcid = 0;
    let totalRennet = 0;
    chanLoads.forEach((load) => {
      totalAcid += load.acidG;
      totalRennet += load.rennetG;
    });
    totalAcid = prodRound(totalAcid);
    totalRennet = prodRound(totalRennet);

    const data = {
      classicPlan,
      trufflePlan,
      classicKg: classicPlan.requestKg,
      truffleKg: trufflePlan.requestKg,
      totalRequestKg,
      classicParties,
      truffleParties,
      parties,
      classicPieces,
      trufflePieces,
      basePieces,
      extraPieces,
      additionalPieces,
      totalPieces,
      requestWithOtkKg,
      boxesTotal,
      totalMilkKg,
      totalLiters,
      rulerTotal,
      chanLoads,
      chanCount,
      milkPerChanKg,
      litersPerChan,
      rulerPerChan,
      totalAcid,
      totalRennet
    };

    results.innerHTML = renderChanResults(data);
    lastChanText = buildPlainChanResult(data);
    $('copyChan').classList.remove('hidden');
    saveResultState('chan', results.innerHTML, lastChanText);
    return true;
    } finally {
      if (options && options.keepCurrentTab) currentTab = previousTab;
    }
  }

  function renderChanResults(d) {
    const boxesLine = d.boxesTotal > 0 ? ` • Коробки: ${fmt(d.boxesTotal)} кор.` : '';
    return `
      ${headerCard('Итог по чану', `${d.chanCount} чан(ов) • ${d.parties} парт. • ${fmt(d.totalPieces)} шт.${boxesLine}`, `Молоко всего: ${fmt(d.totalMilkKg)} кг • Литры всего: ${fmt(d.totalLiters)} л`)}

      <details class="collapsible-section chan-collapsible">
        <summary class="collapsible-summary"><span>Главные результаты</span></summary>
        <div class="collapsible-body">
          <div class="metrics-grid">
            ${metric('Заявка всего', `${fmt(d.totalRequestKg)} кг`, 'soft-green')}
            ${metric('Штук всего с ОТК', `${fmt(d.totalPieces)} шт.`, 'soft-green')}
            ${d.additionalPieces > 0 ? metric('Доп. штуки всего', `+${fmt(d.additionalPieces)} шт.`, 'soft-blue') : ''}
            ${metric('Партии всего', `${d.parties}`, 'soft-blue')}
            ${metric('Партии по чанам', d.chanLoads.map((load) => `Ч${load.index}: ${load.partyCount}`).join(' / '), 'soft-green')}
            ${d.boxesTotal > 0 ? metric('Коробки всего', `${fmt(d.boxesTotal)} кор.`, 'soft-orange') : ''}
            ${metric('Молоко всего', `${fmt(d.totalMilkKg)} кг`, 'soft-blue')}
            ${metric('Литры всего', `${fmt(d.totalLiters)} л`, 'soft-green')}
            ${metric('Чанов нужно', `${d.chanCount}`, 'soft-orange')}
            ${metric('Кг по чанам', joinChanMilkKg(d.chanLoads), 'soft-blue')}
            ${metric('Литры на чан', `${fmt(d.litersPerChan)} л`, 'soft-green')}
            ${metric('Лимонка всего', `${fmt(d.totalAcid)} г`, 'soft-blue')}
            ${metric('Фермент всего', `${fmt(d.totalRennet)} г`, 'soft-blue')}
          </div>
        </div>
      </details>

      ${d.chanLoads.map((load) => `
        <div class="card">
          <h3 class="chan-title">Чан ${load.index}</h3>
          ${strongLine('Партии', `${load.partyCount} • ${formatChanParties(load.parties)}`, 'success')}
          ${strongLine('Молоко', `${fmt(load.milkKg)} кг`, 'primary')}
          ${strongLine('Литры', `${fmt(load.liters)} л`, 'success')}
          ${strongLine('Набрать по линейке', load.rulerText, 'warning')}
          ${line('Лимонка: молоко кг ×', formatRaw(load.acidPerMilk))}
          ${strongLine('Лимонная кислота', `${fmt(load.acidG)} г`, 'primary')}
          ${strongLine('Фермент', `${fmt(load.rennetG)} г`, 'primary')}
        </div>
      `).join('')}

      ${chanTableCard()}
    `;
  }

  function renderChanProductLines(name, plan) {
    if (!plan.active) return `${line(name, 'не заполнено')}`;
    const boxes = plan.usedBoxes ? ` • коробки ${plan.boxesByParty.map((v) => fmt(v)).join('/')} = ${fmt(plan.boxesTotal)} кор.` : '';
    const manual = plan.manualPartiesUsed ? ' • партии вручную' : '';
    return `
      ${strongLine(name, `${fmt(plan.requestKg)} кг • ${plan.parties} парт.${boxes}${manual}`, 'primary')}
      ${line(`${name}: штук с ОТК`, `${fmt(plan.totalPieces)} шт.`)}
      ${line(`${name}: ОТК`, `+${fmt(plan.extraPieces)} шт.`)}
      ${(plan.additionalPieces || 0) > 0 ? line(`${name}: доп. штуки`, `+${fmt(plan.additionalPieces)} шт.`) : ''}
    `;
  }

  function splitPartiesToChans(classicPlan, trufflePlan, totalMilkKg) {
    const maxMilkInChanKg = settings.maxChanMilkKg > 0 ? settings.maxChanMilkKg : 280;
    let chanCount = Math.ceil(totalMilkKg / maxMilkInChanKg);
    if (chanCount < 1) chanCount = 1;
    if (chanCount > 20) chanCount = 20;

    const partyItems = buildChanPartyItems(classicPlan, trufflePlan);

    // ВАЖНО: партии здесь только привязываются к чанам как метки для
    // коэффициента лимонной кислоты. Их молоко НЕ складывается в объём чана.
    // Само молоко всегда делится от общего количества по рассчитанному числу
    // чанов, поэтому ни один чан не превышает установленный лимит.
    const milkByChanKg = splitWholeKgToParts(totalMilkKg, chanCount);
    const partyCounts = splitCountToParts(partyItems.length, chanCount);
    const loads = [];
    lastPartyChanMap = {};
    let cursor = 0;

    for (let i = 1; i <= chanCount; i++) {
      const count = partyCounts[i - 1] || 0;
      const assigned = partyItems.slice(cursor, cursor + count);
      cursor += count;
      assigned.forEach((party) => {
        lastPartyChanMap[party.key] = i;
      });

      const milkKg = Number(milkByChanKg[i - 1]) || 0;
      const liters = prodRound(milkKg / settings.milkDensity);
      const acidPerMilk = getChanAcidPerMilk(i);
      const acidG = prodRound(milkKg * acidPerMilk);
      const rennetG = prodRound(milkKg * settings.rennetPerMilk);
      loads.push({
        index: i,
        parties: assigned,
        partyCount: assigned.length,
        milkKg: prodRound(milkKg),
        liters,
        rulerText: rulerText(liters),
        acidPerMilk,
        acidG,
        rennetG
      });
    }
    return loads;
  }

  function buildChanPartyItems(classicPlan, trufflePlan) {
    const classic = [];
    const truffle = [];
    if (classicPlan && classicPlan.active) {
      for (let i = 0; i < classicPlan.parties; i++) {
        classic.push({
          key: `classic:${i + 1}`,
          type: 'classic',
          label: 'Классика',
          partyIndex: i + 1,
          milkKg: Number(classicPlan.milkByPartyKg && classicPlan.milkByPartyKg[i]) || 0
        });
      }
    }
    if (trufflePlan && trufflePlan.active) {
      for (let i = 0; i < trufflePlan.parties; i++) {
        truffle.push({
          key: `truffle:${i + 1}`,
          type: 'truffle',
          label: 'Трюфель',
          partyIndex: i + 1,
          milkKg: Number(trufflePlan.milkByPartyKg && trufflePlan.milkByPartyKg[i]) || 0
        });
      }
    }

    // Трюфель начинаем с первого чана и, когда есть классика, ставим рядом
    // соответствующую партию классики. Дальше партии идут попарно по номерам.
    const ordered = [];
    const max = Math.max(truffle.length, classic.length);
    for (let i = 0; i < max; i++) {
      if (truffle[i]) ordered.push(truffle[i]);
      if (classic[i]) ordered.push(classic[i]);
    }
    return ordered;
  }

  function splitCountToParts(total, parts) {
    const count = Math.max(1, Math.round(parts || 1));
    const base = Math.floor(total / count);
    const remainder = total % count;
    return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
  }

  function partyMapKey(isTruffle, partyIndex) {
    return `${isTruffle ? 'truffle' : 'classic'}:${partyIndex}`;
  }

  function getPartyChanIndex(isTruffle, partyIndex, productParties) {
    const mapped = Number(lastPartyChanMap[partyMapKey(isTruffle, partyIndex)]);
    if (Number.isFinite(mapped) && mapped > 0) return mapped;

    const chans = Math.max(1, Math.min(lastChanCount || 1, productParties || 1));
    const counts = splitCountToParts(productParties || 1, chans);
    let end = 0;
    for (let i = 0; i < counts.length; i++) {
      end += counts[i];
      if (partyIndex <= end) return i + 1;
    }
    return chans;
  }

  function formatChanParties(parties) {
    if (!parties || !parties.length) return '—';
    const truffle = parties.filter((p) => p.type === 'truffle').map((p) => p.partyIndex);
    const classic = parties.filter((p) => p.type === 'classic').map((p) => p.partyIndex);
    const chunks = [];
    if (truffle.length) chunks.push(`Трюфель ${truffle.join(', ')}`);
    if (classic.length) chunks.push(`Классика ${classic.join(', ')}`);
    return chunks.join(' • ');
  }

  function parseOptionalNumber(raw, label, results) {
    if (!raw) return 0;
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      showError(results, `${label} должно быть числом. Пример: 45 или 45,5.`);
      $('copyChan').classList.add('hidden');
      return Number.NaN;
    }
    return value;
  }

  function getParties(requestKg) {
    if (requestKg <= settings.onePartyLimitKg) return 1;
    if (requestKg <= settings.twoPartyLimitKg) return 2;
    return 3;
  }

  function getTruffleParties(requestKg) {
    if (requestKg < settings.truffleOnePartyLimitKg) return 1;
    if (requestKg < settings.truffleTwoPartyLimitKg) return 2;
    return 3;
  }

  function getAcidPerMilk(index) {
    if (index <= 1) return settings.acidPerMilk1;
    if (index === 2) return settings.acidPerMilk2;
    if (index === 3) return settings.acidPerMilk3;
    if (index === 4) return settings.acidPerMilk4;
    if (index === 5) return settings.acidPerMilk5;
    return settings.acidPerMilk6;
  }

  function getChanAcidPerMilk(index) {
    const key = `chanAcidPerMilk${Math.max(1, Math.min(20, index))}`;
    const value = settings[key];
    return Number.isFinite(value) && value > 0 ? value : 1.34;
  }

  function piecesRound(value) {
    if (value < 0) return -piecesRound(Math.abs(value));
    const floor = Math.floor(value);
    const fraction = value - floor;
    return fraction + 0.0000001 >= ROUNDING_THRESHOLD ? Math.ceil(value) : floor;
  }

  function prodRound(value) { return piecesRound(value); }
  function milkRound(value) { return piecesRound(value); }

  function splitWholeKgToParts(totalKg, parts) {
    if (parts < 1) parts = 1;
    const total = Math.round(totalKg);
    const base = Math.floor(total / parts);
    const remainder = total % parts;
    return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
  }

  function rulerText(liters) {
    if (liters <= CHAN_LITERS[0]) return '0 см';
    if (liters > CHAN_LITERS[CHAN_LITERS.length - 1]) return 'больше 55 см';
    for (let i = 1; i < CHAN_LITERS.length; i++) {
      const l0 = CHAN_LITERS[i - 1];
      const l1 = CHAN_LITERS[i];
      if (liters <= l1) {
        const cm0 = CHAN_CM[i - 1];
        const cm1 = CHAN_CM[i];
        const ratio = (liters - l0) / (l1 - l0);
        const cm = cm0 + ratio * (cm1 - cm0);
        return `примерно ${fmt(prodRound(cm))} см`;
      }
    }
    return 'больше 55 см';
  }

  function calculateBowlCount(fillingNoLossG, bowlCapacityG, bowlLossG, dispenserLossG) {
    if (bowlCapacityG <= 0) return 1;
    let bowls;
    if (bowlCapacityG > bowlLossG) {
      bowls = Math.ceil((fillingNoLossG + dispenserLossG) / (bowlCapacityG - bowlLossG));
    } else {
      bowls = Math.ceil(fillingNoLossG / bowlCapacityG);
    }
    bowls = Math.max(1, bowls);

    // Начинка с потерями в одном тазу должна быть строго не больше нормы:
    // для классики — не больше 3000 г или значения из настроек,
    // для трюфеля — не больше 2100 г или значения из настроек.
    while (bowls < 10000) {
      const totalWithLoss = prodRound(fillingNoLossG + prodRound(bowls * bowlLossG) + dispenserLossG);
      const perBowl = prodRound(totalWithLoss / bowls);
      if (perBowl <= bowlCapacityG + 0.0000001) return bowls;
      bowls += 1;
    }
    return bowls;
  }

  function salsaJarForFilling(fillingPerBowlG) {
    if (fillingPerBowlG >= 1929) return 20;
    if (fillingPerBowlG >= 1675) return 18;
    return 16;
  }

  function getCreamSubtraction(stracciatellaG) {
    const value = Math.floor(Math.abs(stracciatellaG));
    const s = String(value);
    if (s.length >= 5) return Number(s.substring(0, 3));
    if (s.length === 4) return Number(s.substring(0, 2));
    if (s.length > 0) return Number(s.substring(0, 1));
    return 0;
  }

  function headerCard(kicker, big, sub) {
    return `<div class="header-card"><div class="kicker">${escapeHtml(kicker)}</div><div class="big">${escapeHtml(big)}</div><div class="sub">${escapeHtml(sub)}</div></div>`;
  }

  function metric(labelText, valueText, colorClass) {
    return `<div class="metric ${colorClass}"><div class="value">${escapeHtml(valueText)}</div><div class="label">${escapeHtml(labelText)}</div></div>`;
  }

  function line(labelText, valueText) {
    return `<div class="line"><div class="label">${escapeHtml(labelText)}</div><div class="val">${escapeHtml(valueText)}</div></div>`;
  }

  function strongLine(labelText, valueText, color) {
    return `<div class="line strong ${color || ''}"><div class="label">${escapeHtml(labelText)}</div><div class="val">${escapeHtml(valueText)}</div></div>`;
  }

  function startCard(text) {
    return `<div class="card"><p class="hint" style="font-size:15px;margin:0">${escapeHtml(text)}</p></div>`;
  }

  function showError(resultsEl, message) {
    resultsEl.innerHTML = `<div class="card error-card"><h3>Ошибка</h3><div>${escapeHtml(message)}</div></div>`;
  }

  function chanTableCard() {
    const rows = CHAN_CM.map((cm, i) => line(fmt(cm), fmt(CHAN_LITERS[i]))).join('');
    return `<details class="collapsible-section chan-collapsible"><summary class="collapsible-summary"><span>Таблица большого чана</span></summary><div class="collapsible-body"><div class="card"><div class="line"><div class="label" style="font-weight:900;color:var(--text)">Линейка, см</div><div class="val">Объём, л</div></div><div class="divider"></div>${rows}</div></div></details>`;
  }

  function joinPartyMilkKg(partyResults) {
    return partyResults.map((p) => fmt(p.milkKg)).join(' / ') + ' кг';
  }

  function joinChanMilkKg(loads) {
    return loads.map((l) => fmt(l.milkKg)).join(' / ') + ' кг';
  }

  function buildPlainResult(d) {
    let sb = '';
    sb += d.isTruffle ? 'Калькулятор трюфеля\n\n' : 'Калькулятор классики\n\n';
    sb += `Заявка: ${fmt(d.requestKg)} кг\n`;
    sb += `Количество партий: ${d.parties}\n`;
    if (d.usedBoxes) {
      sb += `Коробки по партиям: ${d.boxesByParty.map((v) => fmt(v)).join('/')}\n`;
      sb += `Всего коробок: ${fmt(d.boxesTotal)}\n`;
      sb += `В одной коробке: ${formatRaw(settings.piecesPerBox)} шт.\n`;
      sb += `Штук в коробках: ${fmt(d.basePieces)} шт.\n`;
    } else {
      sb += `Заявка × ${formatRaw(settings.requestToPieces)}: ${fmt(d.basePieces)} шт.\n`;
      if (d.manualPartiesUsed) sb += 'Количество партий задано вручную\n';
    }
    sb += `ОТК на партии: +${fmt(d.extraPieces)} шт.\n`;
    sb += `Общее количество с ОТК: ${fmt(d.totalPieces)} шт.\n\n`;
    sb += 'Главные результаты\n';
    sb += `Заявка: ${fmt(d.requestKg)} кг\n`;
    sb += `Штук всего с ОТК: ${fmt(d.totalPieces)} шт.\n`;
    sb += `Кальятта расплав всего: ${fmt(d.totalCagliataG)} г\n`;
    sb += `Молоко всего: ${fmt(d.totalMilkKg)} кг\n`;
    sb += `Молоко по партиям: ${joinPartyMilkKg(d.partyResults)}\n`;
    sb += `Лимонная кислота всего: ${fmt(d.totalAcid)} г\n`;
    sb += `Фермент всего: ${fmt(d.totalRennet)} г\n`;
    sb += `Начинка с потерями всего: ${fmt(d.totalFillingWithLosses)} г\n`;
    sb += `Тазов всего: ${d.totalBowls}\n`;
    sb += `Страчителла всего: ${fmt(d.totalStracciatella)} г\n`;
    sb += `Сливки всего: ${fmt(d.totalCream)} г\n`;
    sb += `Соль кальятта всего: ${fmt(d.totalSaltCagliata)} г\n`;
    sb += `Соль страчителла всего: ${fmt(d.totalSaltStracciatella)} г\n`;
    sb += `Соль в сливки всего: ${fmt(d.totalSaltCream)} г\n`;
    sb += `Соль всего: ${fmt(d.totalSalt)} г\n`;
    if (d.isTruffle) sb += `Сальса всего: ${fmt(d.totalSalsa)} г\n`;
    sb += '\n';
    d.partyResults.forEach((p) => {
      sb += `Партия ${p.index}\n`;
      if (p.boxes !== null) sb += `Коробок: ${fmt(p.boxes)}\n`;
      sb += `Штук без ОТК: ${fmt(p.basePieces)} шт.\n`;
      sb += `ОТК: +${fmt(p.extraPieces)} шт.\n`;
      sb += `Штук всего в партии: ${fmt(p.pieces)} шт.\n`;
      sb += `Кальятта расплав на партию: ${fmt(p.cagliataG)} г\n`;
      sb += `Молоко: ${fmt(p.milkKg)} кг\n`;
      sb += `Литры: ${fmt(p.milkLiters)} л\n`;
      sb += `Чан: ${p.chanIndex}\n`;
      sb += `Линейка партии: ${p.chanCmText}\n`;
      sb += `Лимонка: молоко кг × ${formatRaw(p.acidPerMilk)}\n`;
      sb += `Лимонная кислота: ${fmt(p.citricAcidG)} г\n`;
      sb += `Фермент: ${fmt(p.rennetG)} г\n`;
      sb += `Тазов в партии: ${p.bowls}\n`;
      sb += `Начинка с потерями: ${fmt(p.fillingWithLossG)} г\n`;
      sb += `Общее в 1 тазу: ${fmt(p.totalPerBowlG)} г\n`;
      sb += `Страчителла на 1 таз: ${fmt(p.stracciatellaPerBowlG)} г\n`;
      sb += `Сливки на 1 таз: ${fmt(p.creamPerBowlG)} г\n`;
      if (p.hasSalsa) {
        sb += `Сальса на баночку: ${fmt(p.salsaJarG)} г\n`;
        sb += `Сальса всего: ${fmt(p.salsaTotalG)} г\n`;
      }
      sb += `Страчителла всего в партии: ${fmt(p.stracciatellaG)} г\n`;
      sb += `Сливки всего в партии: ${fmt(p.creamG)} г\n`;
      sb += `Соль кальятта: ${fmt(p.saltCagliataG)} г\n`;
      sb += `Соль страчителла: ${fmt(p.saltStracciatellaG)} г\n`;
      sb += `Соль в сливки: ${fmt(p.saltCreamG)} г\n`;
      sb += `Соль всего на партию: ${fmt(p.saltG)} г\n\n`;
    });
    sb += `Округление 0,6 применяется как раньше. Заявка в кг показывается как исходная, а штуки и главные результаты считаются с ОТК. Кальятта расплав считается по ${formatRaw(settings.cagliataPerPieceG)} г на 1 шт. Соль в сливки считается по ${formatRaw(settings.creamSaltPerKgG)} г на 1 кг сливок. Молоко по партиям делится от общего количества с ОТК так, чтобы сумма партий точно совпадала с общим молоком.\n`;
    return sb;
  }

  function buildPlainChanResult(d) {
    let sb = '';
    sb += 'Калькулятор чана\n\n';
    sb += 'Данные взяты автоматически из первого раздела “Начинка”.\n\n';
    [d.classicPlan, d.trufflePlan].forEach((plan) => {
      sb += `${plan.label}: `;
      if (!plan.active) {
        sb += 'не заполнено\n';
        return;
      }
      sb += `${fmt(plan.requestKg)} кг, партий: ${plan.parties}\n`;
      if (plan.usedBoxes) {
        sb += `Коробки ${plan.label.toLowerCase()}: ${plan.boxesByParty.map((v) => fmt(v)).join('/')} = ${fmt(plan.boxesTotal)} кор.\n`;
      }
      if (plan.manualPartiesUsed) sb += `Партии ${plan.label.toLowerCase()} заданы вручную\n`;
      sb += `Штук ${plan.label.toLowerCase()} с ОТК: ${fmt(plan.totalPieces)} шт.\n`;
      sb += `ОТК ${plan.label.toLowerCase()}: +${fmt(plan.extraPieces)} шт.\n\n`;
    });
    sb += `Заявка всего: ${fmt(d.totalRequestKg)} кг\n`;
    sb += `Партии всего: ${d.parties}\n`;
    if (d.boxesTotal > 0) sb += `Коробки всего: ${fmt(d.boxesTotal)} кор.\n`;
    sb += `Штук без добавки: ${fmt(d.basePieces)} шт.\n`;
    sb += `Добавка по партиям: +${fmt(d.extraPieces)} шт.\n`;
    sb += `Штук всего: ${fmt(d.totalPieces)} шт.\n`;
    sb += `Молоко всего: ${fmt(d.totalMilkKg)} кг\n`;
    sb += `Плотность молока: ${formatRaw(settings.milkDensity)} кг/л\n`;
    sb += `Литры всего: ${fmt(d.totalLiters)} л\n`;
    sb += `Линейка, если весь объём в одном чане: ${d.rulerTotal}\n`;
    sb += `Максимум на 1 чан: ${fmt(settings.maxChanMilkKg)} кг\n\n`;
    sb += 'Деление общего молока\n';
    sb += `Чанов нужно: ${d.chanCount}\n`;
    sb += `Партии по чанам: ${d.chanLoads.map((load) => `Ч${load.index}: ${load.partyCount}`).join(' / ')}\n`;
    sb += `Молоко по чанам: ${joinChanMilkKg(d.chanLoads)}\n`;
    sb += `Литры на 1 чан примерно: ${fmt(d.litersPerChan)} л\n`;
    sb += `Линейка чана: ${d.rulerPerChan}\n\n`;
    sb += 'Чаны\n';
    d.chanLoads.forEach((load) => {
      sb += `Чан ${load.index}\n`;
      sb += `Партии: ${load.partyCount} • ${formatChanParties(load.parties)}\n`;
      sb += `Молоко: ${fmt(load.milkKg)} кг\n`;
      sb += `Литры: ${fmt(load.liters)} л\n`;
      sb += `Линейка: ${load.rulerText}\n`;
      sb += `Лимонка: молоко кг × ${formatRaw(load.acidPerMilk)}\n`;
      sb += `Лимонная кислота: ${fmt(load.acidG)} г\n`;
      sb += `Фермент: ${fmt(load.rennetG)} г\n\n`;
    });
    sb += 'Итого\n';
    sb += `Лимонная кислота всего: ${fmt(d.totalAcid)} г\n`;
    sb += `Фермент всего: ${fmt(d.totalRennet)} г\n`;
    return sb;
  }


  function restoreCachedAppState() {
    const formState = loadJson(FORM_STORAGE_KEY, {});
    // Keep the filling-panel field in sync with the new v1.13.28 default as well.
    if (String(formState.fillingTruffleBowlCapacityG ?? '').replace(',', '.') === '2067') {
      formState.fillingTruffleBowlCapacityG = '2100';
      try { localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(formState)); } catch (e) {}
    }
    FORM_INPUT_IDS.forEach((id) => {
      const input = $(id);
      if (input && formState[id] !== undefined) input.value = formState[id];
    });

    const resultState = loadJson(RESULT_STORAGE_KEY, {});
    restoreOneResult('filling', resultState.filling, $('fillingResults'), $('copyFilling'));
    restoreOneResult('burrata', resultState.burrata, $('burrataResults'), $('copyBurrata'));
    restoreOneResult('truffle', resultState.truffle, $('truffleResults'), $('copyTruffle'));
    restoreOneResult('chan', resultState.chan, $('chanResults'), $('copyChan'));
    updateProductSourceSummaries();

    return resultState.currentTab || formState.currentTab || 'filling';
  }

  function restoreOneResult(tab, cached, resultsEl, copyBtn) {
    if (!cached || !cached.html || !resultsEl) return;
    resultsEl.innerHTML = cached.html;
    if (tab === 'filling') lastFillingText = cached.plain || '';
    if (tab === 'burrata') lastBurrataText = cached.plain || '';
    if (tab === 'truffle') lastTruffleText = cached.plain || '';
    if (tab === 'chan') lastChanText = cached.plain || '';
    if (copyBtn && cached.plain) copyBtn.classList.remove('hidden');
  }

  function saveFormState() {
    try {
      const state = { currentTab };
      FORM_INPUT_IDS.forEach((id) => {
        const input = $(id);
        if (input) state[id] = input.value || '';
      });
      localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function saveResultState(tab, html, plain) {
    try {
      const state = loadJson(RESULT_STORAGE_KEY, {});
      state.currentTab = tab;
      state[tab] = {
        html,
        plain,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(state));
      saveFormState();
    } catch (e) {}
  }

  function saveCurrentTab(tab) {
    try {
      const resultState = loadJson(RESULT_STORAGE_KEY, {});
      resultState.currentTab = tab;
      localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(resultState));
      saveFormState();
    } catch (e) {}
  }

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  async function copyText(text, emptyMessage) {
    if (!text) {
      toast(emptyMessage);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast('Расчёт скопирован');
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast('Расчёт скопирован');
    }
  }

  function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.classList.remove('hidden');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.add('hidden'), 2100);
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed = JSON.parse(raw);
      // v1.13.28: migrate the previous default truffle bowl maximum (2067 g) to 2100 g.
      // Any other custom value is preserved.
      if (Number(parsed.truffleBowlCapacityG) === 2067) {
        parsed.truffleBowlCapacityG = 2100;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }
      return { ...DEFAULTS, ...parsed };
    } catch (e) {
      return { ...DEFAULTS };
    }
  }

  function saveSettings(s) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }

  function fmt(value) {
    if (!Number.isFinite(value)) return '0';
    const rounded = Math.round(value * 1000) / 1000;
    return rounded.toLocaleString('ru-RU', { maximumFractionDigits: 3, useGrouping: false });
  }

  function formatRaw(value) {
    if (!Number.isFinite(value)) return '0';
    const rounded = Math.round(value * 1000) / 1000;
    return String(rounded).replace('.', ',');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[ch]));
  }
})();
