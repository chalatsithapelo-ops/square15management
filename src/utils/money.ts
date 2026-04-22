/**
 * Currency rounding helpers.
 *
 * Uses "round half away from zero" at 2 decimal places, which matches what
 * South African invoice totals and SARS reporting expect. We avoid JS's
 * `.toFixed()` pitfalls (binary float representations like 5014.575 ==> "5014.57")
 * by normalising with Number.EPSILON before rounding.
 */

/** Round a currency amount to 2 decimal places (round half away from zero). */
export function roundCurrency(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Format a currency amount to a 2-decimal string (e.g. 5014.58). */
export function formatCurrency2dp(n: number): string {
  return roundCurrency(n).toFixed(2);
}

/**
 * Compute invoice totals from line items using per-step rounding so the
 * web form, stored DB values, and generated PDF always agree to the cent.
 *
 *   subtotal = round( Σ line.total )
 *   vat      = round( subtotal * vatRate )
 *   total    = round( subtotal + vat )
 */
export function computeInvoiceTotals(
  lineItems: Array<{ total?: number | null }>,
  vatRate = 0.15,
): { subtotal: number; tax: number; total: number } {
  const subtotal = roundCurrency(
    lineItems.reduce((sum, item) => sum + (Number(item?.total) || 0), 0),
  );
  const tax = roundCurrency(subtotal * vatRate);
  const total = roundCurrency(subtotal + tax);
  return { subtotal, tax, total };
}
