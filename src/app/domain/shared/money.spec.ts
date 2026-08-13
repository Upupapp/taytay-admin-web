import { addMoney, centavos, pesos, sumMoney, toDecimal, ZERO_PESOS } from './money';

describe('money', () => {
  it('stores pesos as whole centavos', () => {
    expect(pesos(1234.56).centavos).toBe(123456);
    expect(centavos(500).centavos).toBe(500);
  });

  it('rounds sub-centavo input rather than carrying a float', () => {
    expect(pesos(0.005).centavos).toBe(1);
    expect(pesos(10.014).centavos).toBe(1001);
  });

  it('adds without floating-point drift', () => {
    const total = addMoney(pesos(0.1), pesos(0.2));
    expect(total.centavos).toBe(30);
    expect(toDecimal(total)).toBe(0.3);
  });

  it('sums a batch of grants exactly', () => {
    const total = sumMoney([pesos(8000), pesos(3000), pesos(1000.5)]);
    expect(total.centavos).toBe(1200050);
    expect(toDecimal(total)).toBe(12000.5);
  });

  it('sums an empty batch to zero', () => {
    expect(sumMoney([])).toEqual(ZERO_PESOS);
  });
});
