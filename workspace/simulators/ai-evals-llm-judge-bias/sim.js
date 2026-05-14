// Monte Carlo симуляция position bias в LLM-as-judge.

const Sim = {

  // Один вызов judge для одной пары.
  // trueBetter: 'A' | 'B' — кто истинно лучше
  // order: 'AB' | 'BA' — кто первый в промпте
  // accuracy: вероятность что судья выберет истинно лучшего
  //           при отсутствии bias (base_p)
  // bias: position bias strength (добавляется к первому)
  judge: function(trueBetter, order, accuracy, bias) {
    // X = первый показанный, Y = второй
    const firstIsTrue = (order === 'AB' && trueBetter === 'A') ||
                        (order === 'BA' && trueBetter === 'B');

    let pFirstWins;
    if (firstIsTrue) {
      // Первый — истинно лучший; bias помогает ему
      pFirstWins = accuracy + bias / 2;
    } else {
      // Первый — истинно хуже; bias тянет к нему несмотря на это
      pFirstWins = (1 - accuracy) + bias / 2;
    }

    // Clamp в [0, 1]
    pFirstWins = Math.min(1, Math.max(0, pFirstWins));

    const firstWon = Math.random() < pFirstWins;
    if (order === 'AB') return firstWon ? 'A' : 'B';
    else                return firstWon ? 'B' : 'A';
  },

  // Одна симуляция N пар для заданной стратегии.
  // Возвращает { winRateB, winRateA, tieRate, biasInEstimate }
  simulateOnce: function(params) {
    const { trueWinRateB, biasStrength, judgeAccuracy, n, strategy } = params;
    let countB = 0, countA = 0, countTie = 0;

    for (let i = 0; i < n; i++) {
      const trueBetter = Math.random() < trueWinRateB ? 'B' : 'A';

      if (strategy === 'mirror_both') {
        // Mirror: судим оба порядка
        const v1 = Sim.judge(trueBetter, 'AB', judgeAccuracy, biasStrength);
        const v2 = Sim.judge(trueBetter, 'BA', judgeAccuracy, biasStrength);

        if (v1 === 'B' && v2 === 'B') countB++;
        else if (v1 === 'A' && v2 === 'A') countA++;
        else countTie++;
      } else {
        let order;
        if (strategy === 'always_A_first') order = 'AB';
        else if (strategy === 'always_B_first') order = 'BA';
        else order = Math.random() < 0.5 ? 'AB' : 'BA'; // random_order

        const verdict = Sim.judge(trueBetter, order, judgeAccuracy, biasStrength);
        if (verdict === 'B') countB++;
        else countA++;
      }
    }

    const tieRate = countTie / n;

    // Для mirror: win rate среди решённых пар (excluding ties)
    // Это правильная unbiased оценка true win rate.
    // Для остальных стратегий: простое countB / n.
    let winRateB, winRateA;
    if (params.strategy === 'mirror_both') {
      const decided = countB + countA;
      winRateB = decided > 0 ? countB / decided : 0;
      winRateA = decided > 0 ? countA / decided : 0;
    } else {
      winRateB = countB / n;
      winRateA = countA / n;
    }

    return {
      winRateB,
      winRateA,
      tieRate,
      tieRateRaw: countTie / n,     // для bar chart
      biasInEstimate: winRateB - params.trueWinRateB
    };
  },

  // Усреднённая симуляция (K прогонов для снижения MC-шума).
  simulate: function(params, K) {
    if (K === undefined) K = 40;

    let sumWinRateB = 0, sumWinRateA = 0, sumTieRate = 0;

    for (let k = 0; k < K; k++) {
      const r = Sim.simulateOnce(params);
      sumWinRateB += r.winRateB;
      sumWinRateA += r.winRateA;
      sumTieRate += r.tieRate;
    }

    const winRateB = sumWinRateB / K;
    const winRateA = sumWinRateA / K;
    const tieRate = sumTieRate / K;

    return {
      winRateB,
      winRateA,
      tieRate,
      biasInEstimate: winRateB - params.trueWinRateB,
      // CI для winRateB (Wilson, на основе effective n)
      ci: Utils.wilsonCI(winRateB, params.n)
    };
  },

  // Симулируем все 4 стратегии для chart comparison.
  // Возвращает { always_A_first, always_B_first, random_order, mirror_both }
  simulateAllStrategies: function(params, K) {
    if (K === undefined) K = 40;
    const strategies = ['always_A_first', 'always_B_first',
                        'random_order', 'mirror_both'];
    const result = {};
    for (const strategy of strategies) {
      result[strategy] = Sim.simulate({ ...params, strategy }, K);
    }
    return result;
  }
};
