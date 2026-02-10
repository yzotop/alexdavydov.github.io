/* sim.js — A/B test simulation engine (scenario-based) */
(() => {
  'use strict';
  const U = window.Utils;

  /* ── Scenario definitions ─────────────────────────────── */
  const SCENARIOS = {
    big_early: {
      id: 'big_early',
      label: 'Big Early Win',
      labelRu: 'Ранний сильный рост',
      usersPerDay: 600,
      // starts ~3.5 pp, converges to ~0.8 pp
      deltaFn(t) { return 0.008 + 0.027 * Math.exp(-0.20 * t); },
      sustainedDelta: 0.008,
      autoRisks: {},
      insight: 'Ранние крупные эффекты — наименее надёжны. Первая неделя эксперимента — худшее время для принятия решения.',
    },
    small_real: {
      id: 'small_real',
      label: 'Small Real Win',
      labelRu: 'Слабый реальный рост',
      usersPerDay: 3000,
      deltaFn() { return 0.003; },
      sustainedDelta: 0.003,
      autoRisks: {},
      insight: 'Большинство реальных продуктовых улучшений — маленькие и скучные. Им нужны терпение и выборка, а не интуиция.',
    },
    early_spike: {
      id: 'early_spike',
      label: 'Early Spike',
      labelRu: 'Ранний всплеск',
      usersPerDay: 600,
      // novelty: ~4 pp → 0
      deltaFn(t) { return 0.04 * Math.exp(-0.15 * t); },
      sustainedDelta: 0,
      autoRisks: {},
      insight: 'Эффекты новизны реальны — и временны. Раннее подглядывание превращает затухающий сигнал в ложную «победу».',
    },
    risky_sig: {
      id: 'risky_sig',
      label: 'Risky but Significant',
      labelRu: 'Рискованный, но значимый',
      usersPerDay: 800,
      deltaFn() { return 0.02; },
      sustainedDelta: 0.02,
      autoRisks: { imbalance: true, spillover: true },
      insight: 'Малое p-value означает, что сигнал вряд ли шум. Но оно ничего не говорит о корректности измерения.',
    },
  };

  const SCENARIO_IDS = Object.keys(SCENARIOS);
  const BASE_CR     = 0.05;
  const SAMPLE_DT   = 0.05;
  const SERIES_CAP  = 2000;
  const MAX_DAYS    = 30;

  function createSim(scenarioId, seed) {
    scenarioId = scenarioId || 'big_early';
    seed = seed || 42;
    let rng, def;
    let t, cU, cC, tU, tC;
    let sampleAcc, decision, revealed;
    let series, risks;

    function _resetSeries() {
      series = {};
      for (const k of ['time','crCtrl','crTest','delta','pVal','ciLo','ciHi','cumUsers'])
        series[k] = new U.RingSeries(SERIES_CAP);
    }

    function reset(newScenario, newSeed) {
      if (newScenario) scenarioId = newScenario;
      if (newSeed !== undefined && newSeed !== null) seed = newSeed;
      def = SCENARIOS[scenarioId];
      rng = new U.RNG(seed);

      t = 0; cU = 0; cC = 0; tU = 0; tC = 0;
      sampleAcc = 0; decision = null; revealed = false;
      risks = { imbalance: false, spillover: false };
      for (const k in def.autoRisks) if (def.autoRisks[k]) risks[k] = true;
      _resetSeries();
    }

    function tick(dt) {
      if (t >= MAX_DAYS) return;
      t = Math.min(t + dt, MAX_DAYS);

      const expected = def.usersPerDay * dt;
      const batch = Math.max(0, Math.round(rng.normal(expected, Math.sqrt(expected * 0.25))));

      const pAlloc = risks.imbalance ? 0.70 : 0.50;
      const expCtrl = batch * pAlloc;
      let nCtrl = Math.max(0, Math.min(batch, Math.round(rng.normal(expCtrl, Math.sqrt(Math.max(1, expCtrl * (1 - pAlloc)))))));
      const nTest = batch - nCtrl;
      cU += nCtrl; tU += nTest;

      const delta = def.deltaFn(t);
      let pCtrl = BASE_CR;
      let pTest = BASE_CR + delta;
      if (risks.spillover) { pCtrl = BASE_CR + delta * 0.15; pTest = BASE_CR + delta * 0.85; }
      pCtrl = U.clamp(pCtrl, 0.001, 0.999);
      pTest = U.clamp(pTest, 0.001, 0.999);

      if (nCtrl > 0) {
        const mu = nCtrl * pCtrl, sig = Math.sqrt(nCtrl * pCtrl * (1 - pCtrl));
        cC += Math.max(0, Math.round(rng.normal(mu, Math.max(sig, 0.5))));
      }
      if (nTest > 0) {
        const mu = nTest * pTest, sig = Math.sqrt(nTest * pTest * (1 - pTest));
        tC += Math.max(0, Math.round(rng.normal(mu, Math.max(sig, 0.5))));
      }

      sampleAcc += dt;
      if (sampleAcc >= SAMPLE_DT) {
        sampleAcc -= SAMPLE_DT;
        const s = stats();
        series.time.push(t);
        series.crCtrl.push(s.crCtrl);  series.crTest.push(s.crTest);
        series.delta.push(s.delta);     series.pVal.push(s.pVal);
        series.ciLo.push(s.ci[0]);      series.ciHi.push(s.ci[1]);
        series.cumUsers.push(s.totalUsers);
      }
    }

    function stats() {
      const r = U.zTest2Prop(cC, cU, tC, tU);
      return {
        time: t,
        ctrlUsers: cU, testUsers: tU, totalUsers: cU + tU,
        ctrlConv: cC, testConv: tC,
        crCtrl: cU > 0 ? cC / cU : 0,
        crTest: tU > 0 ? tC / tU : 0,
        delta: r.delta,
        relDelta: r.pA > 0 ? r.delta / r.pA : 0,
        pVal: r.p, ci: r.ci, z: r.z,
        significant: r.p < 0.05,
        borderline: r.p >= 0.05 && r.p < 0.10,
      };
    }

    function makeDecision(type) {
      if (decision) return decision;
      decision = { type, time: t, stats: stats() };
      return decision;
    }

    function reveal() {
      if (revealed) return null;
      revealed = true;
      const s = stats();
      return {
        scenario: def, scenarioId,
        sustainedDelta: def.sustainedDelta,
        finalStats: s, decision,
        verdict: _verdict(s),
        insight: def.insight,
      };
    }

    function _verdict(finalStats) {
      const d = decision;
      if (!d) return { label: 'Нет решения', sub: 'Эксперимент завершён без решения.', cls: 'neutral' };
      const early = d.time < MAX_DAYS * 0.4;

      /* ── big_early ── */
      if (scenarioId === 'big_early') {
        if (d.type === 'ship') {
          if (early) return {
            label: 'Преждевременно',
            sub: 'Запуск при ' + U.fmtPct(d.stats.relDelta, 0) + ' аплифте на ' + U.fmtDay(d.time) +
                 '. Ранний всплеск был реальным, но временным. Устойчивый эффект — ~' +
                 U.fmtPct(def.sustainedDelta / BASE_CR, 0) +
                 '. Решение принято на основе числа, в 3–4 раза превышающего реальность.',
            cls: 'warn' };
          return { label: 'Обоснованно ✓', sub: 'Ожидание позволило увидеть, как ранний эффект стабилизировался, и подтвердить реальный устойчивый рост.', cls: 'good' };
        }
        if (d.type === 'stop') return { label: 'Ошибка — остановлен реальный рост', sub: 'Эффект был настоящим — просто меньше, чем показывали ранние данные.', cls: 'bad' };
        return { label: 'Осмотрительно ✓', sub: 'Ожидание было разумным. Ранний сигнал был завышен и требовал времени на стабилизацию.', cls: 'good' };
      }

      /* ── small_real ── */
      if (scenarioId === 'small_real') {
        if (d.type === 'ship') {
          if (d.stats.pVal < 0.05) return {
            label: 'Обоснованно ✓',
            sub: 'Терпение оправдалось. Аплифт ' + U.fmtPct(def.sustainedDelta / BASE_CR, 0) + ' выглядит скучно, но он реален. Большинство продуктовых побед выглядят именно так.',
            cls: 'good' };
          return { label: 'Повезло', sub: 'Эффект реален, но данные ещё не подтвердили это. Вы могли запустить шум.', cls: 'warn' };
        }
        if (d.type === 'stop') return { label: 'Ошибка — остановлен реальный рост', sub: 'Реальное улучшение остановлено, потому что выглядело скучно. Большинство настоящих продуктовых побед — маленькие.', cls: 'bad' };
        if (d.stats.pVal > 0.10) return { label: 'Осмотрительно ✓', sub: 'Данные были неубедительны. Эффект реален, но требовал больше времени.', cls: 'good' };
        return { label: 'Осторожно', sub: 'Сигнал формировался. Ожидание было оправданным.', cls: 'warn' };
      }

      /* ── early_spike ── */
      if (scenarioId === 'early_spike') {
        if (d.type === 'ship') return { label: 'Ошибка — запущен мираж', sub: 'Запущен эффект новизны. Ранние пользователи отреагировали, но рост сошёл на нет. Устойчивого улучшения нет.', cls: 'bad' };
        if (d.type === 'stop') {
          if (early) return { label: 'Проницательно', sub: 'Вы увидели за ранним шумом суть. Эффект был настоящим, но временным.', cls: 'good' };
          return { label: 'Обоснованно ✓', sub: 'Ранний сигнал угас. Остановка позволила избежать запуска изменения с нулевым устойчивым эффектом.', cls: 'good' };
        }
        return { label: 'Осмотрительно ✓', sub: 'Ранние данные были по-настоящему обманчивы. Ожидание обнажило затухание.', cls: 'good' };
      }

      /* ── risky_sig ── */
      if (scenarioId === 'risky_sig') {
        if (d.type === 'ship') return {
          label: 'Рискованное решение',
          sub: 'Эффект существует, но измерение было искажено. Спилловер размыл Δ, дисбаланс снизил мощность. p-value показало «значимо» — но число, на основе которого принято решение, не отражает реальность.',
          cls: 'warn' };
        if (d.type === 'stop') return { label: 'Избыточная осторожность', sub: 'Эффект был реальным, несмотря на проблемы с измерением. Но скептицизм к качеству данных был обоснован.', cls: 'warn' };
        return { label: 'Оправданная осторожность', sub: 'При активных факторах риска сомнение в цифрах — разумная позиция.', cls: 'good' };
      }

      return { label: 'Завершено', sub: 'Эксперимент завершён.', cls: 'neutral' };
    }

    function setRisk(name, val) { if (name in risks) risks[name] = !!val; }

    reset(scenarioId, seed);

    return {
      tick, reset, stats, makeDecision, reveal, setRisk,
      getSeries: () => series,
      getTime:   () => t,
      getDecision: () => decision,
      isRevealed: () => revealed,
      getScenarioId: () => scenarioId,
      getScenarioDef: () => def,
      getRisks: () => ({ ...risks }),
      MAX_DAYS,
    };
  }

  window.Sim = { createSim, SCENARIOS, SCENARIO_IDS };
})();
