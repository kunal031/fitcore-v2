/**
 * Currency helpers.
 *
 * Every monetary amount in FitCore is an integer number of paise — never a
 * float. 150000 paise = ₹1,500.00. Only this module converts to rupees, and
 * only for display.
 */

/** Format paise as an Indian-grouped currency string: 150000 -> "₹1,500.00". */
export function paiseToInr(paise: number): string {
  const rupees = paise / 100;
  const formatted = rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `₹${formatted}`;
}

/**
 * Percentage discount on a paise amount, truncated toward zero to stay in
 * integer paise, truncating on a positive quotient.
 */
export function percentageDiscount(amountPaise: number, percent: number): number {
  return Math.trunc((amountPaise * percent) / 100);
}

/** Clamp a discount so it never exceeds the amount being discounted. */
export function clampDiscount(discountPaise: number, amountPaise: number): number {
  return Math.min(discountPaise, amountPaise);
}
