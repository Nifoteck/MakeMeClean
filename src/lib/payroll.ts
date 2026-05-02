// UK 2024/25 payroll rates

const ANNUAL_PERSONAL_ALLOWANCE = 12570;   // 1257L tax code
const BASIC_RATE_BAND            = 37700;   // 20% on income above allowance, up to this
const UPPER_EARNINGS_LIMIT       = 50270;   // annual
const PRIMARY_THRESHOLD          = 12570;   // employee NI starts here (annual)
const SECONDARY_THRESHOLD        =  9100;   // employer NI starts here (annual)

const BASIC_RATE         = 0.20;
const HIGHER_RATE        = 0.40;
const NI_EMPLOYEE_MAIN   = 0.08;   // 8%  PT–UEL
const NI_EMPLOYEE_UPPER  = 0.02;   // 2%  above UEL
const NI_EMPLOYER_RATE   = 0.138;  // 13.8% above secondary threshold

export interface PayslipCalc {
  grossPay:         number;
  taxablePay:       number;
  payeTax:          number;
  niEmployee:       number;
  niEmployer:       number;
  totalDeductions:  number;
  netPay:           number;
}

export function calculatePayslip(
  grossPay: number,
  period: "weekly" | "monthly",
  taxCode = "1257L"
): PayslipCalc {
  const divisor = period === "weekly" ? 52 : 12;

  // Period-level thresholds
  const personalAllowancePeriod = ANNUAL_PERSONAL_ALLOWANCE / divisor;
  const basicRateBandPeriod     = BASIC_RATE_BAND           / divisor;
  const uelPeriod               = UPPER_EARNINGS_LIMIT      / divisor;
  const ptPeriod                = PRIMARY_THRESHOLD         / divisor;
  const stPeriod                = SECONDARY_THRESHOLD       / divisor;

  // PAYE — using 1257L (personalAllowancePeriod) regardless of supplied code for now
  const taxFreeAmount = personalAllowancePeriod;
  const taxablePay    = Math.max(0, grossPay - taxFreeAmount);

  let payeTax = 0;
  if (taxablePay > 0) {
    const basic  = Math.min(taxablePay, basicRateBandPeriod);
    const higher = Math.max(0, taxablePay - basicRateBandPeriod);
    payeTax = basic * BASIC_RATE + higher * HIGHER_RATE;
  }

  // Employee NI
  let niEmployee = 0;
  if (grossPay > ptPeriod) {
    const mainBand  = Math.min(grossPay, uelPeriod) - ptPeriod;
    const upperBand = Math.max(0, grossPay - uelPeriod);
    niEmployee = mainBand * NI_EMPLOYEE_MAIN + upperBand * NI_EMPLOYEE_UPPER;
  }

  // Employer NI
  const niEmployer = Math.max(0, grossPay - stPeriod) * NI_EMPLOYER_RATE;

  const totalDeductions = payeTax + niEmployee;
  const netPay          = grossPay - totalDeductions;

  const r = (n: number) => Math.round(n * 100) / 100;

  return {
    grossPay:        r(grossPay),
    taxablePay:      r(taxablePay),
    payeTax:         r(payeTax),
    niEmployee:      r(niEmployee),
    niEmployer:      r(niEmployer),
    totalDeductions: r(totalDeductions),
    netPay:          r(netPay),
  };
}

/** Parse hours from a time slot string like "09:00 – 11:00" */
export function parseShiftHours(timeSlot: string, fallback = 3): number {
  const m = timeSlot.match(/(\d{1,2})(?::(\d{2}))?\s*[–\-]\s*(\d{1,2})(?::(\d{2}))?/);
  if (!m) return fallback;
  const startMins = parseInt(m[1]) * 60 + parseInt(m[2] ?? "0");
  const endMins   = parseInt(m[3]) * 60 + parseInt(m[4] ?? "0");
  const hours = (endMins - startMins) / 60;
  return hours > 0 ? hours : fallback;
}

/** ISO string for the Monday of the week containing a given date */
export function getWeekMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Get next N monday dates as ISO strings starting from today's week */
export function getUpcomingWeeks(n: number): string[] {
  const mondays: string[] = [];
  const base = new Date(getWeekMonday(new Date()));
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i * 7);
    mondays.push(d.toISOString().slice(0, 10));
  }
  return mondays;
}

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Format a week_start ISO date as "Mon 3 Jun – Sun 9 Jun" */
export function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end   = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const startStr = start.toLocaleDateString("en-GB", opts);
  const endStr   = end.toLocaleDateString("en-GB", { ...opts, year: "numeric" });
  return `${startStr} – ${endStr}`;
}
