// Расчёт naive vs production-weighted accuracy
// для category matching evaluation.

const Sim = {

  // Precision для food/other сегмента — фиксирован
  PRECISION_FOOD: 0.65,

  // params: {
  //   golden_electronics, golden_fashion, golden_long_tail,
  //   precision_electronics, precision_fashion, precision_long_tail,
  //   prod_electronics, prod_fashion, prod_long_tail
  // }
  calc: function(params) {
    // Доли food/other — остатки до 1.0
    const golden_food = 1
      - params.golden_electronics
      - params.golden_fashion
      - params.golden_long_tail;

    const prod_food = 1
      - params.prod_electronics
      - params.prod_fashion
      - params.prod_long_tail;

    // Naive overall — взвешен по golden distribution
    const naive_overall =
      params.precision_electronics * params.golden_electronics +
      params.precision_fashion * params.golden_fashion +
      Sim.PRECISION_FOOD * golden_food +
      params.precision_long_tail * params.golden_long_tail;

    // Production-weighted overall
    const production_weighted =
      params.precision_electronics * params.prod_electronics +
      params.precision_fashion * params.prod_fashion +
      Sim.PRECISION_FOOD * prod_food +
      params.precision_long_tail * params.prod_long_tail;

    const gap = naive_overall - production_weighted;

    return {
      naive_overall,
      production_weighted,
      gap,
      golden_food,
      prod_food,
      per_segment: {
        electronics: {
          precision: params.precision_electronics,
          n_needed: Utils.sampleSizeForCI(params.precision_electronics),
          golden_share: params.golden_electronics,
          prod_share: params.prod_electronics
        },
        fashion: {
          precision: params.precision_fashion,
          n_needed: Utils.sampleSizeForCI(params.precision_fashion),
          golden_share: params.golden_fashion,
          prod_share: params.prod_fashion
        },
        food: {
          precision: Sim.PRECISION_FOOD,
          n_needed: Utils.sampleSizeForCI(Sim.PRECISION_FOOD),
          golden_share: golden_food,
          prod_share: prod_food
        },
        long_tail: {
          precision: params.precision_long_tail,
          n_needed: Utils.sampleSizeForCI(params.precision_long_tail),
          golden_share: params.golden_long_tail,
          prod_share: params.prod_long_tail
        }
      }
    };
  }
};
