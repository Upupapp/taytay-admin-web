import { addMoney, centavos, parsePesos, pesos, sumMoney, toDecimal, ZERO_PESOS } from './money';

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

  it('reads typed pesos into whole centavos without decimal arithmetic', () => {
    expect(parsePesos('3200')).toEqual(centavos(320000));
    expect(parsePesos(' ₱3,200.5 ')).toEqual(centavos(320050));
    // 0.29 * 100 is 28.999… in floating point; read as two integers it is 29.
    expect(parsePesos('0.29')).toEqual(centavos(29));
  });

  it('refuses what is not an amount rather than rounding it', () => {
    for (const typed of ['', 'abc', '-5', '1.234', '1.2.3']) {
      expect(parsePesos(typed)).toBeNull();
    }
  });
});
