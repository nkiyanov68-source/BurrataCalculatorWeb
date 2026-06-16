(() => {
  'use strict';

  const CHAN_CM = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 55];
  const CHAN_LITERS = [0, 9.8, 22.6, 42.2, 61.8, 82.2, 103.8, 128.8, 155, 183.6, 208.4, 238.6, 270.6, 293.4, 318];
  const ROUNDING_THRESHOLD = 0.6;
  const STORAGE_KEY = 'burrata_web_settings_v1_12_3';

  const DEFAULTS = {
    requestToPieces: 8,
    extraPiecesPerParty: 5,
    onePartyLimitKg: 45,
    twoPartyLimitKg: 90,
    threePartyLimitKg: 123.75,
    truffleOnePartyLimitKg: 20,
    truffleTwoPartyLimitKg: 30,
    milkPerPieceKg: 0.68,
    milkDensity: 1.03,
    acidPerMilk1: 1.4,
    acidPerMilk2: 1.4,
    acidPerMilk3: 1.4,
    acidPerMilk4: 1.4,
    acidPerMilk5: 1.4,
    acidPerMilk6: 1.4,
    rennetPerMilk: 0.2,
    maxChanMilkKg: 280,
    fillingPerPieceG: 93,
    bowlCapacityG: 3000,
    truffleFillingPerPieceG: 95,
    truffleBowlCapacityG: 2067,
    bowlLossG: 65,
    dispenserLossG: 110,
    stracciatellaDivisor: 2
  };

  const SETTINGS_GROUPS = [
    {
      title: 'Партии и штуки',
      fields: [
        ['requestToPieces', 'Заявка кг ×', '8'],
        ['extraPiecesPerParty', 'Добавка штук на 1 партию', '5'],
        ['onePartyLimitKg', 'Классика: 1 партия до, кг', '45'],
        ['twoPartyLimitKg', 'Классика: 2 партии до, кг', '90'],
        ['threePartyLimitKg', 'Классика: 3 партии до, кг', '123,75'],
        ['truffleOnePartyLimitKg', 'Трюфель: 2 партии от, кг', '20'],
        ['truffleTwoPartyLimitKg', 'Трюфель: 3 партии от, кг', '30']
      ]
    },
    {
      title: 'Молоко, чан, кислота, фермент',
      fields: [
        ['milkPerPieceKg', 'Молоко: штук ×', '0,68'],
        ['milkDensity', 'Плотность молока, кг/л', '1,03'],
        ['acidPerMilk1', 'Лимонная кислота 1 партия/чан: молоко кг ×', '1,4'],
        ['acidPerMilk2', 'Лимонная кислота 2 партия/чан: молоко кг ×', '1,4'],
        ['acidPerMilk3', 'Лимонная кислота 3 партия/чан: молоко кг ×', '1,4'],
        ['acidPerMilk4', 'Лимонная кислота 4 партия/чан: молоко кг ×', '1,4'],
        ['acidPerMilk5', 'Лимонная кислота 5 партия/чан: молоко кг ×', '1,4'],
        ['acidPerMilk6', 'Лимонная кислота 6 партия/чан: молоко кг ×', '1,4'],
        ['rennetPerMilk', 'Фермент: молоко кг ×', '0,2'],
        ['maxChanMilkKg', 'Максимум на 1 чан, кг', '280']
      ]
    },
    {
      title: 'Начинка и потери',
      fields: [
        ['fillingPerPieceG', 'Классика начинка: штук партии ×, г', '93'],
        ['bowlCapacityG', 'Классика 1 таз, г', '3000'],
        ['truffleFillingPerPieceG', 'Трюфель начинка: штук партии ×, г', '95'],
        ['truffleBowlCapacityG', 'Трюфель 1 таз, г', '2067'],
        ['bowlLossG', 'Потери на 1 таз, г', '65'],
        ['dispenserLossG', 'Потери дозатора в 1 партии, г', '110'],
        ['stracciatellaDivisor', 'Страчителла: начинка /', '2']
      ]
    }
  ];

  let settings = loadSettings();
  let currentTab = 'burrata';
  let lastBurrataText = '';
  let lastTruffleText = '';
  let lastChanText = '';

  const $ = (id) => document.getElementById(id);

  document.addEventListener('DOMContentLoaded', () => {
    buildSettingsFields();
    addStartMessages();
    bindEvents();
    showTab('burrata');

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  });

  function bindEvents() {
    document.querySelectorAll('.tab').forEach((btn) => {
      btn.addEventListener('click', () => showTab(btn.dataset.tab));
    });

    $('calcBurrata').addEventListener('click', () => calculateProduct(false));
    $('calcTruffle').addEventListener('click', () => calculateProduct(true));
    $('calcChan').addEventListener('click', calculateChan);

    $('copyBurrata').addEventListener('click', () => copyText(lastBurrataText, 'Сначала сделайте расчёт бурраты'));
    $('copyTruffle').addEventListener('click', () => copyText(lastTruffleText, 'Сначала сделайте расчёт трюфеля'));
    $('copyChan').addEventListener('click', () => copyText(lastChanText, 'Сначала сделайте расчёт чана'));

    $('toggleSettings').addEventListener('click', toggleSettings);
    $('openSettingsFromTruffle').addEventListener('click', openSettingsFromOtherTab);
    $('openSettingsFromChan').addEventListener('click', openSettingsFromOtherTab);
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
        const order = ['burrata', 'truffle', 'chan'];
        let idx = order.indexOf(currentTab);
        if (dx < 0 && idx < order.length - 1) showTab(order[idx + 1]);
        if (dx > 0 && idx > 0) showTab(order[idx - 1]);
      }
    }, { passive: true });
  }

  function showTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach((btn) => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle('active', active);
      btn.textContent = (active ? '● ' : '') + (btn.dataset.tab === 'burrata' ? 'Буррата' : btn.dataset.tab === 'truffle' ? 'Трюфель' : 'Чан');
    });
    document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
    $(`page-${tab}`).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    const s = { ...DEFAULTS };
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
    if (currentTab === 'truffle') return $('truffleResults');
    if (currentTab === 'chan') return $('chanResults');
    return $('burrataResults');
  }

  function addStartMessages() {
    $('burrataResults').innerHTML = startCard('После расчёта главные цифры появятся сверху крупными карточками. В партиях будут выделены тазы, начинка с потерями, страчителла на 1 таз, сливки на 1 таз и общее количество в 1 тазу.');
    $('truffleResults').innerHTML = startCard('Введите заявку трюфельной бурраты. По умолчанию: 95 г начинки на штуку, 2067 г на таз. Партии трюфеля: меньше 20 кг — 1 партия, от 20 кг — 2 партии, от 30 кг — 3 партии. Сальса подбирается на каждый таз: 20, 18 или 16 г.');
    $('chanResults').innerHTML = startCard('Введите заявки классики и трюфеля. Партии считаются отдельно по классике и отдельно по трюфелю, затем складываются. После расчёта всего молока приложение делит его равномерно по чанам, чтобы в одном чане не было больше заданного лимита в кг. Литры считаются по формуле: молоко кг / плотность молока.');
  }

  function calculateProduct(isTruffle) {
    const parsed = readSettingsFromFields(false);
    if (!parsed) return;
    settings = parsed;
    saveSettings(settings);

    const input = isTruffle ? $('truffleKg') : $('burrataKg');
    const results = isTruffle ? $('truffleResults') : $('burrataResults');
    const copyBtn = isTruffle ? $('copyTruffle') : $('copyBurrata');
    const raw = String(input.value || '').trim().replace(',', '.');

    if (!raw) {
      showError(results, 'Введите заявку в кг.');
      copyBtn.classList.add('hidden');
      return;
    }

    const requestKg = Number(raw);
    if (!Number.isFinite(requestKg)) {
      showError(results, 'Заявка должна быть числом. Пример: 45 или 45,5.');
      copyBtn.classList.add('hidden');
      return;
    }
    if (requestKg <= 0) {
      showError(results, 'Заявка должна быть больше 0 кг.');
      copyBtn.classList.add('hidden');
      return;
    }
    if (!isTruffle && requestKg > settings.threePartyLimitKg) {
      showError(results, `По текущим настройкам расчёт поддерживается до ${fmt(settings.threePartyLimitKg)} кг. Для большей заявки увеличьте лимит 3-й партии в настройках.`);
      copyBtn.classList.add('hidden');
      return;
    }

    const fillingPerPieceG = isTruffle ? settings.truffleFillingPerPieceG : settings.fillingPerPieceG;
    const bowlCapacityG = isTruffle ? settings.truffleBowlCapacityG : settings.bowlCapacityG;
    const parties = isTruffle ? getTruffleParties(requestKg) : getParties(requestKg);
    const basePieces = piecesRound(requestKg * settings.requestToPieces);
    const extraPieces = piecesRound(parties * settings.extraPiecesPerParty);
    const totalPieces = piecesRound(basePieces + extraPieces);
    const totalMilkKg = milkRound(totalPieces * settings.milkPerPieceKg);
    const milkByPartyKg = splitWholeKgToParts(totalMilkKg, parties);
    const piecesPerParty = piecesRound(totalPieces / parties);

    let totalRennet = 0;
    let totalFillingWithLosses = 0;
    let totalStracciatella = 0;
    let totalCream = 0;
    let totalLosses = 0;
    let totalAcid = 0;
    let totalSalsa = 0;
    let totalBowls = 0;
    const partyResults = [];

    for (let i = 1; i <= parties; i++) {
      const pr = { index: i, hasSalsa: isTruffle };
      pr.milkKg = milkByPartyKg[i - 1];
      pr.milkLiters = prodRound(pr.milkKg / settings.milkDensity);
      pr.chanCmText = rulerText(pr.milkLiters);
      pr.citricAcidG = prodRound(pr.milkKg * getAcidPerMilk(i));
      pr.rennetG = prodRound(pr.milkKg * settings.rennetPerMilk);
      pr.pieces = piecesPerParty;
      pr.fillingNoLossG = prodRound(piecesPerParty * fillingPerPieceG);
      pr.bowls = Math.max(1, Math.ceil(pr.fillingNoLossG / bowlCapacityG));
      pr.bowlLossG = prodRound(pr.bowls * settings.bowlLossG);
      pr.dispenserLossG = i === 1 ? prodRound(settings.dispenserLossG) : 0;
      pr.fillingWithLossG = prodRound(pr.fillingNoLossG + pr.bowlLossG + pr.dispenserLossG);
      pr.fillingPerBowlG = prodRound(pr.fillingWithLossG / pr.bowls);
      pr.stracciatellaG = prodRound(pr.fillingWithLossG / settings.stracciatellaDivisor);
      pr.stracciatellaPerBowlG = prodRound(pr.stracciatellaG / pr.bowls);
      pr.creamSubtractionG = getCreamSubtraction(pr.stracciatellaG);
      pr.creamG = prodRound(pr.stracciatellaG - pr.creamSubtractionG);
      pr.creamPerBowlG = prodRound(pr.creamG / pr.bowls);
      pr.totalPerBowlG = prodRound(pr.stracciatellaPerBowlG + pr.creamPerBowlG);
      if (isTruffle) {
        pr.salsaJarG = salsaJarForFilling(pr.fillingPerBowlG);
        pr.salsaTotalG = prodRound(pr.salsaJarG * pr.bowls);
      } else {
        pr.salsaJarG = 0;
        pr.salsaTotalG = 0;
      }

      totalAcid += pr.citricAcidG;
      totalRennet += pr.rennetG;
      totalFillingWithLosses += pr.fillingWithLossG;
      totalStracciatella += pr.stracciatellaG;
      totalCream += pr.creamG;
      totalLosses += pr.bowlLossG + pr.dispenserLossG;
      totalBowls += pr.bowls;
      totalSalsa += pr.salsaTotalG;
      partyResults.push(pr);
    }

    totalAcid = prodRound(totalAcid);
    totalRennet = prodRound(totalRennet);
    totalFillingWithLosses = prodRound(totalFillingWithLosses);
    totalStracciatella = prodRound(totalStracciatella);
    totalCream = prodRound(totalCream);
    totalLosses = prodRound(totalLosses);
    totalSalsa = prodRound(totalSalsa);

    results.innerHTML = renderProductResults({
      isTruffle,
      requestKg,
      parties,
      basePieces,
      extraPieces,
      totalPieces,
      totalMilkKg,
      totalFillingWithLosses,
      totalStracciatella,
      totalCream,
      totalBowls,
      totalAcid,
      totalRennet,
      totalSalsa,
      partyResults
    });

    const plain = buildPlainResult({
      isTruffle,
      requestKg,
      parties,
      basePieces,
      extraPieces,
      totalPieces,
      totalMilkKg,
      totalFillingWithLosses,
      totalLosses,
      totalStracciatella,
      totalCream,
      totalBowls,
      totalAcid,
      totalRennet,
      totalSalsa,
      partyResults
    });

    if (isTruffle) lastTruffleText = plain;
    else lastBurrataText = plain;
    copyBtn.classList.remove('hidden');
  }

  function renderProductResults(data) {
    const partyCards = data.partyResults.map((p) => renderPartyCard(p)).join('');
    return `
      ${headerCard('Итог заявки', `${fmt(data.totalPieces)} шт. • ${data.parties} парт.`, `Заявка: ${fmt(data.requestKg)} кг • Заявка × ${formatRaw(settings.requestToPieces)} = ${fmt(data.basePieces)} шт. • Добавка: +${fmt(data.extraPieces)} шт.`)}
      <div class="section-title">Главные результаты</div>
      <div class="metrics-grid">
        ${metric('Молоко', `${fmt(data.totalMilkKg)} кг`, 'soft-blue')}
        ${metric('Штук', `${fmt(data.totalPieces)} шт.`, 'soft-green')}
        ${metric('Начинка с потерями', `${fmt(data.totalFillingWithLosses)} г`, 'soft-orange')}
        ${metric('Тазов всего', `${data.totalBowls}`, 'soft-blue')}
        ${metric('Страчителла', `${fmt(data.totalStracciatella)} г`, 'soft-green')}
        ${metric('Сливки', `${fmt(data.totalCream)} г`, 'soft-orange')}
        ${metric('Лимонная кислота', `${fmt(data.totalAcid)} г`, 'soft-blue')}
        ${metric('Фермент', `${fmt(data.totalRennet)} г`, 'soft-blue')}
        ${data.isTruffle ? metric('Сальса всего', `${fmt(data.totalSalsa)} г`, 'soft-orange') + metric('Баночки/тазы', `${data.totalBowls}`, 'soft-blue') : ''}
      </div>
      <div class="section-title">Подробно по партиям</div>
      ${partyCards}
      <div class="card note-card">Примечание: потери на тазы и дозатор учитываются внутри расчёта, но не выводятся отдельными строками, чтобы не перегружать экран. Округление по правилу 0,6 применяется как раньше. Молоко по партиям распределяется от общего количества так, чтобы сумма партий точно совпадала с общим молоком.</div>
    `;
  }

  function renderPartyCard(p) {
    return `
      <div class="card">
        <h3 class="party-title">Партия ${p.index}</h3>
        ${line('Молоко', `${fmt(p.milkKg)} кг`)}
        ${line('Литры', `${fmt(p.milkLiters)} л`)}
        ${line('Линейка чана', p.chanCmText)}
        ${line('Лимонная кислота', `${fmt(p.citricAcidG)} г`)}
        ${line('Фермент', `${fmt(p.rennetG)} г`)}
        <div class="divider"></div>
        ${line('Штук', `${fmt(p.pieces)} шт.`)}
        ${strongLine('Тазов в партии', `${p.bowls}`, 'primary')}
        ${strongLine('Начинка с потерями', `${fmt(p.fillingWithLossG)} г`, 'warning')}
        <div class="divider"></div>
        ${strongLine('Страчителла на 1 таз', `${fmt(p.stracciatellaPerBowlG)} г`, 'success')}
        ${strongLine('Сливки на 1 таз', `${fmt(p.creamPerBowlG)} г`, 'primary')}
        ${strongLine('Общее в 1 тазу', `${fmt(p.totalPerBowlG)} г`, 'warning')}
        ${p.hasSalsa ? `
          <div class="divider"></div>
          ${line('Начинка в 1 тазу', `${fmt(p.fillingPerBowlG)} г`)}
          ${strongLine('Сальса на баночку', `${fmt(p.salsaJarG)} г`, 'warning')}
          ${strongLine('Сальса всего', `${fmt(p.salsaTotalG)} г`, 'primary')}
          ${p.salsaJarG === 18 ? line('Подсказка', '18 г: можно перекинуть 2 г из одной банки') : ''}
        ` : ''}
        <div class="divider"></div>
        ${line('Страчителла всего в партии', `${fmt(p.stracciatellaG)} г`)}
        ${line('Сливки всего в партии', `${fmt(p.creamG)} г`)}
      </div>
    `;
  }

  function calculateChan() {
    currentTab = 'chan';
    const parsed = readSettingsFromFields(false);
    if (!parsed) return;
    settings = parsed;
    saveSettings(settings);

    const results = $('chanResults');
    const rawClassic = String($('chanClassicKg').value || '').trim().replace(',', '.');
    const rawTruffle = String($('chanTruffleKg').value || '').trim().replace(',', '.');

    const classicKg = parseOptionalNumber(rawClassic, 'Заявка классика', results);
    if (Number.isNaN(classicKg)) return;
    const truffleKg = parseOptionalNumber(rawTruffle, 'Заявка трюфель', results);
    if (Number.isNaN(truffleKg)) return;

    if (classicKg < 0 || truffleKg < 0) {
      showError(results, 'Значения не должны быть отрицательными.');
      $('copyChan').classList.add('hidden');
      return;
    }

    const totalRequestKg = classicKg + truffleKg;
    if (totalRequestKg <= 0) {
      showError(results, 'Введите заявку классики или трюфеля.');
      $('copyChan').classList.add('hidden');
      return;
    }

    const classicParties = classicKg > 0 ? getParties(classicKg) : 0;
    const truffleParties = truffleKg > 0 ? getTruffleParties(truffleKg) : 0;
    const parties = classicParties + truffleParties;

    const classicBasePieces = piecesRound(classicKg * settings.requestToPieces);
    const truffleBasePieces = piecesRound(truffleKg * settings.requestToPieces);
    const classicExtraPieces = piecesRound(classicParties * settings.extraPiecesPerParty);
    const truffleExtraPieces = piecesRound(truffleParties * settings.extraPiecesPerParty);
    const classicPieces = piecesRound(classicBasePieces + classicExtraPieces);
    const trufflePieces = piecesRound(truffleBasePieces + truffleExtraPieces);
    const basePieces = piecesRound(classicBasePieces + truffleBasePieces);
    const extraPieces = piecesRound(classicExtraPieces + truffleExtraPieces);
    const totalPieces = piecesRound(classicPieces + trufflePieces);
    const totalMilkKg = milkRound(totalPieces * settings.milkPerPieceKg);

    if (totalMilkKg <= 0) {
      showError(results, 'Количество молока должно быть больше 0 кг.');
      $('copyChan').classList.add('hidden');
      return;
    }

    const totalLiters = prodRound(totalMilkKg / settings.milkDensity);
    const rulerTotal = rulerText(totalLiters);
    const chanLoads = splitTotalMilkToChans(totalMilkKg);
    const chanCount = chanLoads.length;
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

    results.innerHTML = renderChanResults({
      classicKg,
      truffleKg,
      totalRequestKg,
      classicParties,
      truffleParties,
      parties,
      classicPieces,
      trufflePieces,
      basePieces,
      extraPieces,
      totalPieces,
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
    });

    lastChanText = buildPlainChanResult({
      classicKg,
      truffleKg,
      totalRequestKg,
      classicParties,
      truffleParties,
      parties,
      classicPieces,
      trufflePieces,
      basePieces,
      extraPieces,
      totalPieces,
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
    });
    $('copyChan').classList.remove('hidden');
  }

  function renderChanResults(d) {
    return `
      ${headerCard('Итог по чану', `${d.chanCount} чан(ов) • ${d.parties} парт.`, `Молоко всего: ${fmt(d.totalMilkKg)} кг • делится по чанам, не больше ${fmt(settings.maxChanMilkKg)} кг на 1 чан`)}
      <div class="section-title">Главные результаты</div>
      <div class="metrics-grid">
        ${metric('Молоко всего', `${fmt(d.totalMilkKg)} кг`, 'soft-blue')}
        ${metric('Литры всего', `${fmt(d.totalLiters)} л`, 'soft-green')}
        ${metric('Партии всего', `${d.parties}`, 'soft-blue')}
        ${metric('Чанов нужно', `${d.chanCount}`, 'soft-orange')}
        ${metric('Кг по чанам', joinChanMilkKg(d.chanLoads), 'soft-blue')}
        ${metric('Литры на чан', `${fmt(d.litersPerChan)} л`, 'soft-green')}
        ${metric('Лимонка всего', `${fmt(d.totalAcid)} г`, 'soft-blue')}
        ${metric('Фермент всего', `${fmt(d.totalRennet)} г`, 'soft-blue')}
      </div>

      <div class="section-title">Заявки бурраты</div>
      <div class="card">
        ${line('Классика', `${fmt(d.classicKg)} кг`)}
        ${line('Трюфель', `${fmt(d.truffleKg)} кг`)}
        ${strongLine('Заявка всего', `${fmt(d.totalRequestKg)} кг`, 'primary')}
        <div class="divider"></div>
        ${line('Партии классика', `${d.classicParties}`)}
        ${line('Партии трюфель', `${d.truffleParties}`)}
        ${strongLine('Партии всего', `${d.parties}`, 'primary')}
        ${line('Классика штук', `${fmt(d.classicPieces)} шт.`)}
        ${line('Трюфель штук', `${fmt(d.trufflePieces)} шт.`)}
        ${line(`Заявка × ${formatRaw(settings.requestToPieces)}`, `${fmt(d.basePieces)} шт.`)}
        ${line('Добавка по партиям', `+${fmt(d.extraPieces)} шт.`)}
        ${strongLine('Штук всего', `${fmt(d.totalPieces)} шт.`, 'success')}
        ${strongLine('Молоко рассчитано', `${fmt(d.totalMilkKg)} кг`, 'primary')}
      </div>

      ${d.chanLoads.map((load) => `
        <div class="card">
          <h3 class="chan-title">Чан ${load.index}</h3>
          ${strongLine('Молоко', `${fmt(load.milkKg)} кг`, 'primary')}
          ${strongLine('Литры', `${fmt(load.liters)} л`, 'success')}
          ${strongLine('Набрать по линейке', load.rulerText, 'warning')}
          ${line('Лимонка: молоко кг ×', formatRaw(load.acidPerMilk))}
          ${strongLine('Лимонная кислота', `${fmt(load.acidG)} г`, 'primary')}
          ${strongLine('Фермент', `${fmt(load.rennetG)} г`, 'primary')}
        </div>
      `).join('')}

      ${chanTableCard()}
      <div class="card note-card">Партии считаются отдельно: классика отдельно, трюфель отдельно, потом складываются. После этого всё рассчитанное молоко делится по чанам так, чтобы в одном чане не было больше заданного максимума в кг.</div>
    `;
  }

  function splitTotalMilkToChans(totalMilkKg) {
    const maxMilkInChanKg = settings.maxChanMilkKg > 0 ? settings.maxChanMilkKg : 280;
    let chanCount = Math.ceil(totalMilkKg / maxMilkInChanKg);
    if (chanCount < 1) chanCount = 1;
    const milkByChanKg = splitWholeKgToParts(totalMilkKg, chanCount);
    const loads = [];
    for (let i = 1; i <= chanCount && i <= 20; i++) {
      const milkKg = milkByChanKg[i - 1];
      const liters = prodRound(milkKg / settings.milkDensity);
      const acidPerMilk = getAcidPerMilk(i);
      loads.push({
        index: i,
        milkKg,
        liters,
        rulerText: rulerText(liters),
        acidPerMilk,
        acidG: prodRound(milkKg * acidPerMilk),
        rennetG: prodRound(milkKg * settings.rennetPerMilk)
      });
    }
    return loads;
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
    return `<div class="section-title">Таблица большого чана</div><div class="card"><div class="line"><div class="label" style="font-weight:900;color:var(--text)">Линейка, см</div><div class="val">Объём, л</div></div><div class="divider"></div>${rows}</div>`;
  }

  function joinPartyMilkKg(partyResults) {
    return partyResults.map((p) => fmt(p.milkKg)).join(' / ') + ' кг';
  }

  function joinChanMilkKg(loads) {
    return loads.map((l) => fmt(l.milkKg)).join(' / ') + ' кг';
  }

  function buildPlainResult(d) {
    let sb = '';
    sb += d.isTruffle ? 'Калькулятор трюфеля\n\n' : 'Калькулятор бурраты\n\n';
    sb += `Заявка: ${fmt(d.requestKg)} кг\n`;
    sb += `Количество партий: ${d.parties}\n`;
    sb += `Заявка × ${formatRaw(settings.requestToPieces)}: ${fmt(d.basePieces)} шт.\n`;
    sb += `Добавка на партии: +${fmt(d.extraPieces)} шт.\n`;
    sb += `Общее количество штук: ${fmt(d.totalPieces)} шт.\n\n`;
    sb += 'Главные результаты\n';
    sb += `Молоко всего: ${fmt(d.totalMilkKg)} кг\n`;
    sb += `Молоко по партиям: ${joinPartyMilkKg(d.partyResults)}\n`;
    sb += `Лимонная кислота всего: ${fmt(d.totalAcid)} г\n`;
    sb += `Фермент всего: ${fmt(d.totalRennet)} г\n`;
    sb += `Начинка с потерями всего: ${fmt(d.totalFillingWithLosses)} г\n`;
    sb += `Тазов всего: ${d.totalBowls}\n`;
    sb += `Страчителла всего: ${fmt(d.totalStracciatella)} г\n`;
    sb += `Сливки всего: ${fmt(d.totalCream)} г\n`;
    if (d.isTruffle) sb += `Сальса всего: ${fmt(d.totalSalsa)} г\n`;
    sb += '\n';
    d.partyResults.forEach((p) => {
      sb += `Партия ${p.index}\n`;
      sb += `Молоко: ${fmt(p.milkKg)} кг\n`;
      sb += `Литры: ${fmt(p.milkLiters)} л\n`;
      sb += `Линейка чана: ${p.chanCmText}\n`;
      sb += `Лимонная кислота: ${fmt(p.citricAcidG)} г\n`;
      sb += `Фермент: ${fmt(p.rennetG)} г\n`;
      sb += `Штук: ${fmt(p.pieces)} шт.\n`;
      sb += `Тазов в партии: ${p.bowls}\n`;
      sb += `Начинка с потерями: ${fmt(p.fillingWithLossG)} г\n`;
      sb += `Страчителла на 1 таз: ${fmt(p.stracciatellaPerBowlG)} г\n`;
      sb += `Сливки на 1 таз: ${fmt(p.creamPerBowlG)} г\n`;
      sb += `Общее в 1 тазу: ${fmt(p.totalPerBowlG)} г\n`;
      if (p.hasSalsa) {
        sb += `Начинка в 1 тазу: ${fmt(p.fillingPerBowlG)} г\n`;
        sb += `Сальса на баночку: ${fmt(p.salsaJarG)} г\n`;
        sb += `Сальса всего: ${fmt(p.salsaTotalG)} г\n`;
      }
      sb += `Страчителла всего в партии: ${fmt(p.stracciatellaG)} г\n`;
      sb += `Сливки всего в партии: ${fmt(p.creamG)} г\n\n`;
    });
    sb += 'Округление 0,6 применяется как раньше. Молоко по партиям делится от общего количества так, чтобы сумма партий точно совпадала с общим молоком.\n';
    return sb;
  }

  function buildPlainChanResult(d) {
    let sb = '';
    sb += 'Калькулятор чана\n\n';
    sb += `Классика: ${fmt(d.classicKg)} кг, партий: ${d.classicParties}\n`;
    sb += `Трюфель: ${fmt(d.truffleKg)} кг, партий: ${d.truffleParties}\n`;
    sb += `Заявка всего: ${fmt(d.totalRequestKg)} кг\n`;
    sb += `Партии всего: ${d.parties}\n`;
    sb += `Штук классика: ${fmt(d.classicPieces)} шт.\n`;
    sb += `Штук трюфель: ${fmt(d.trufflePieces)} шт.\n`;
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
    sb += `Молоко по чанам: ${joinChanMilkKg(d.chanLoads)}\n`;
    sb += `Литры на 1 чан примерно: ${fmt(d.litersPerChan)} л\n`;
    sb += `Линейка чана: ${d.rulerPerChan}\n\n`;
    sb += 'Чаны\n';
    d.chanLoads.forEach((load) => {
      sb += `Чан ${load.index}\n`;
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
