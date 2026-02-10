/* ui.js — DOM updates, decision flow, explanation drawer */
(() => {
  'use strict';
  const U = window.Utils;

  function createUI(els, sim, charts) {

    const CI_WIDE_THRESHOLD = 0.025;

    /* ── Verdict bar + hint + delta opacity ───────────────── */
    function updateVerdictBar(s) {
      // quiet hint — appears only in the temptation window
      const early = s.time < sim.MAX_DAYS * 0.5;
      const wide  = (s.ci[1] - s.ci[0]) > CI_WIDE_THRESHOLD;
      els.verdictHint.style.display = (s.significant && early && wide) ? '' : 'none';

      // significance pill
      const pill = els.vSignificance;
      if (s.totalUsers < 20) {
        pill.textContent = 'COLLECTING'; pill.className = 'verdict-pill verdict-pill--none';
      } else if (s.significant) {
        pill.textContent = 'SIGNIFICANT'; pill.className = 'verdict-pill verdict-pill--sig';
      } else if (s.borderline) {
        pill.textContent = 'BORDERLINE'; pill.className = 'verdict-pill verdict-pill--border';
      } else {
        pill.textContent = 'NOT SIGNIFICANT'; pill.className = 'verdict-pill verdict-pill--none';
      }

      // delta values
      els.vDelta.textContent = U.fmtPct(s.relDelta, 1);
      els.vPValue.textContent = U.fmtP(s.pVal);
      els.vCI.textContent = U.fmtPct(s.ci[0], 2) + ' … ' + U.fmtPct(s.ci[1], 2);
      els.vCI.className = 'verdict-bar__value mono' + (s.ci[0] > 0 ? ' c-pos' : s.ci[1] < 0 ? ' c-neg' : '');
      els.vTime.textContent = U.fmtDay(s.time);

      // delta confidence fading — intensity decreases when data is unreliable
      const ciWidth  = s.ci[1] - s.ci[0];
      const timeFrac = s.time / sim.MAX_DAYS;
      const riskCnt  = Object.values(sim.getRisks()).filter(Boolean).length;
      const ciFade   = U.clamp((ciWidth - 0.02) / 0.04, 0, 0.5);
      const timeFade = U.clamp(1 - timeFrac / 0.6, 0, 0.4);
      const riskFade = riskCnt * 0.15;
      const opacity  = U.clamp(1 - ciFade - timeFade - riskFade, 0.25, 1);

      const deltaClass = 'verdict-bar__value mono' + (s.delta > 0 ? ' c-pos' : s.delta < 0 ? ' c-neg' : '');
      els.vDelta.className = deltaClass;
      els.vDelta.style.opacity = opacity;
    }

    /* ── Metric cards ─────────────────────────────────────── */
    function updateMetrics(s) {
      els.mCtrlUsers.textContent  = U.fmtNum(s.ctrlUsers);
      els.mTestUsers.textContent  = U.fmtNum(s.testUsers);
      els.mTotalUsers.textContent = U.fmtNum(s.totalUsers);
      els.mCRCtrl.textContent = U.fmtPct(s.crCtrl, 2);
      els.mCRTest.textContent = U.fmtPct(s.crTest, 2);

      // delta with confidence opacity
      const ciWidth  = s.ci[1] - s.ci[0];
      const timeFrac = s.time / sim.MAX_DAYS;
      const riskCnt  = Object.values(sim.getRisks()).filter(Boolean).length;
      const opacity  = U.clamp(1 - U.clamp((ciWidth - 0.02) / 0.04, 0, 0.5)
                                  - U.clamp(1 - timeFrac / 0.6, 0, 0.4)
                                  - riskCnt * 0.15, 0.25, 1);

      els.mDeltaAbs.textContent = (s.delta > 0 ? '+' : '') + U.fmtPct(s.delta, 3);
      els.mDeltaAbs.className = 'metric-pair__value mono' + (s.delta > 0 ? ' c-pos' : s.delta < 0 ? ' c-neg' : '');
      els.mDeltaAbs.style.opacity = opacity;
      els.mDeltaRel.textContent = (s.relDelta > 0 ? '+' : '') + U.fmtPct(s.relDelta, 1);
      els.mDeltaRel.className = 'metric-pair__value mono' + (s.relDelta > 0 ? ' c-pos' : s.relDelta < 0 ? ' c-neg' : '');
      els.mDeltaRel.style.opacity = opacity;

      els.mPValue.textContent = U.fmtP(s.pVal);
      els.mPValue.className = 'metric-pair__value mono' + (s.pVal < 0.05 ? ' c-sig' : '');
      els.mCIWidth.textContent = U.fmtPct(ciWidth, 2);
      els.mZScore.textContent = s.z.toFixed(2);

      const risks = sim.getRisks();
      const cnt = Object.values(risks).filter(Boolean).length;
      els.riskCount.textContent = cnt;
      els.riskCount.className = 'risk-count' + (cnt > 0 ? ' risk-count--active' : '');
    }

    /* ── Decision zone emphasis ────────────────────────────── */
    function updateDecisionZone(s) {
      if (sim.getDecision()) return;
      const muted = s.time < sim.MAX_DAYS * 0.4;
      els.btnShip.className = 'btn ' + (muted ? 'btn--ship-muted' : 'btn--ship');
    }

    /* ── Decision flow ────────────────────────────────────── */
    function onDecision(type) {
      const d = sim.makeDecision(type);
      if (!d) return;
      els.decisionZone.style.display = 'none';
      els.decisionOutcome.style.display = '';
      const labels = { ship: '🚀 Запущено', stop: '✕ Остановлено', wait: '⏳ Продолжено' };
      els.decisionLabel.textContent = labels[type] || type;
      els.decisionLabel.className = 'decision-outcome__label decision-outcome__label--' + type;
      els.decisionTime.textContent = U.fmtDayHour(d.time);
      els.decisionDetails.innerHTML =
        '<span class="dim">Δ = ' + U.fmtPct(d.stats.delta, 3) + '</span> · ' +
        '<span class="dim">p = ' + U.fmtP(d.stats.pVal) + '</span> · ' +
        '<span class="dim">n = ' + U.fmtNum(d.stats.totalUsers) + '</span>';
      els.btnReveal.style.display = 'none';
    }

    function showRevealButton() {
      if (sim.getDecision() && !sim.isRevealed()) els.btnReveal.style.display = '';
    }

    function onReveal() {
      const r = sim.reveal();
      if (!r) return;
      els.btnReveal.style.display = 'none';
      els.revealPanel.style.display = '';

      const v = r.verdict;
      let html = '<div class="card__title" style="margin-bottom:12px">🧠 Итог теста</div>';
      html += '<div class="reveal-verdict reveal-verdict--' + v.cls + '">' +
        '<div class="reveal-verdict__label">' + v.label + '</div>' +
        '<div class="reveal-verdict__sub">' + v.sub + '</div></div>';

      html += '<div class="reveal-facts">';
      html += '<div class="reveal-fact"><span class="dim">Сценарий:</span> ' + (r.scenario.labelRu || r.scenario.label) + '</div>';
      html += '<div class="reveal-fact"><span class="dim">Устойчивый эффект (Δ):</span> ' +
        (r.sustainedDelta === 0 ? '0 (нет устойчивого эффекта)' : (r.sustainedDelta > 0 ? '+' : '') + U.fmtPct(r.sustainedDelta, 2) +
         ' (' + U.fmtPct(r.sustainedDelta / 0.05, 0) + ' относительный)') + '</div>';
      html += '<div class="reveal-fact"><span class="dim">Итоговое p-value:</span> ' + U.fmtP(r.finalStats.pVal) + '</div>';
      html += '<div class="reveal-fact"><span class="dim">Финальная наблюдаемая Δ:</span> ' + U.fmtPct(r.finalStats.delta, 3) + '</div>';
      html += '<div class="reveal-fact"><span class="dim">Всего пользователей:</span> ' + U.fmtNum(r.finalStats.totalUsers) + '</div>';
      html += '</div>';

      html += '<div class="reveal-explanation"><p>' + r.insight + '</p></div>';

      els.revealContent.innerHTML = html;
      _updateExplanation(r);
    }

    function _updateExplanation(r) {
      let html = '';
      if (!r) {
        html = '<p>Запустите симуляцию, чтобы увидеть, как метрики A/B-теста меняются со временем.</p>' +
               '<p>p-value будет колебаться. Вопрос: когда данных <em>достаточно</em> для решения?</p>';
      } else {
        html = '<p><strong>Что произошло:</strong></p><p>' + r.insight + '</p>';
        const risks = sim.getRisks();
        if (risks.imbalance) html += '<p><strong>Дисбаланс выборки</strong> снизил статистическую мощность — неравные группы требуют больше пользователей для обнаружения того же эффекта.</p>';
        if (risks.spillover) html += '<p><strong>Спилловер</strong> размыл измеряемый эффект — часть воздействия просочилась в контроль, занижая истинную Δ.</p>';
      }
      els.explanationContent.innerHTML = html;
    }

    /* ── Reset ────────────────────────────────────────────── */
    function resetDecisionUI() {
      els.decisionZone.style.display = '';
      els.decisionOutcome.style.display = 'none';
      els.revealPanel.style.display = 'none';
      els.btnReveal.style.display = 'none';
      els.btnShip.className = 'btn btn--ship-muted';
      _updateExplanation(null);
    }

    return {
      updateVerdictBar, updateMetrics, updateDecisionZone,
      onDecision, onReveal, showRevealButton, resetDecisionUI,
    };
  }

  window.UI = { createUI };
})();
