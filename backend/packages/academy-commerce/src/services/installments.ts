// ============================================================================
// Installment calculation — split total into N payments
// ============================================================================

/**
 * Split a total amount into N installments.
 * Rounds each part down to nearest `roundTo` unit.
 * The first installment absorbs the rounding remainder.
 */
export function splitAmount(total: number, n: number, roundTo = 50): number[] {
  if (n <= 1) return [total];
  const part = Math.floor(total / n / roundTo) * roundTo;
  const first = total - part * (n - 1);
  return [first, ...Array(n - 1).fill(part)];
}

/**
 * Calculate due dates for installments.
 * First is immediate, subsequent are 30 days apart.
 */
export function installmentDueDates(n: number, intervalDays = 30): (Date | null)[] {
  const dates: (Date | null)[] = [null]; // first installment: immediate
  for (let i = 1; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + intervalDays * i);
    dates.push(d);
  }
  return dates;
}
