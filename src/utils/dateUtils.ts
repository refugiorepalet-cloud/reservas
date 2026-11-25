import { CabinId, Reservation } from '../types';

export const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const WEEKDAYS_SHORT_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDateISO(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseDateISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDaysISO(iso: string, days: number): string {
  const d = parseDateISO(iso);
  d.setDate(d.getDate() + days);
  return formatDateISO(d);
}

export function diffNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const start = parseDateISO(checkIn);
  const end = parseDateISO(checkOut);
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function formatShortDateES(iso: string): string {
  if (!iso || iso.length !== 10) return iso;
  const [, m, d] = iso.split('-').map(Number);
  const monthShort = MONTHS_ES[(m || 1) - 1]?.slice(0, 3) || '';
  return `${d} ${monthShort}`;
}

export function formatFullDateES(iso: string): string {
  if (!iso || iso.length !== 10) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  const monthName = MONTHS_ES[(m || 1) - 1]?.toLowerCase() || '';
  return `${d} de ${monthName} de ${y}`;
}

export function formatCLP(amount: number): string {
  const rounded = Math.round(amount || 0);
  return '$' + rounded.toLocaleString('es-CL');
}

export function getMonthDaysGrid(year: number, monthIndex: number): Array<{
  iso: string;
  dayNumber: number;
  inCurrentMonth: boolean;
}> {
  const firstDay = new Date(year, monthIndex, 1);
  // Monday = 0 ... Sunday = 6
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<{ iso: string; dayNumber: number; inCurrentMonth: boolean }> = [];

  for (let i = 0; i < startOffset; i++) {
    const d = new Date(year, monthIndex, 1 - (startOffset - i));
    cells.push({
      iso: formatDateISO(d),
      dayNumber: d.getDate(),
      inCurrentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, monthIndex, day);
    cells.push({
      iso: formatDateISO(d),
      dayNumber: day,
      inCurrentMonth: true,
    });
  }

  const remainder = cells.length % 7;
  if (remainder !== 0) {
    const trailing = 7 - remainder;
    for (let i = 1; i <= trailing; i++) {
      const d = new Date(year, monthIndex + 1, i);
      cells.push({
        iso: formatDateISO(d),
        dayNumber: d.getDate(),
        inCurrentMonth: false,
      });
    }
  }

  return cells;
}

/**
 * A reservation covers nights [checkIn, checkOut).
 * Check-out day is available for a new 15:00 check-in.
 */
export function reservationCoversNight(res: Reservation, dayIso: string): boolean {
  return res.checkIn <= dayIso && dayIso < res.checkOut;
}

export function reservationChecksOutOn(res: Reservation, dayIso: string): boolean {
  return res.checkOut === dayIso;
}

export function findReservationForNight(
  reservations: Reservation[],
  cabin: CabinId,
  dayIso: string
): Reservation | undefined {
  return reservations.find(
    (r) => r.cabin === cabin && reservationCoversNight(r, dayIso)
  );
}

export function findOverlappingReservation(
  reservations: Reservation[],
  cabin: CabinId,
  checkIn: string,
  checkOut: string,
  excludeId?: string
): Reservation | undefined {
  return reservations.find(
    (r) =>
      r.id !== excludeId &&
      r.cabin === cabin &&
      r.checkIn < checkOut &&
      checkIn < r.checkOut
  );
}

export function getMonthlyStats(
  reservations: Reservation[],
  year: number,
  monthIndex: number
) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const monthStart = `${year}-${pad2(monthIndex + 1)}-01`;
  const nextMonthDate = new Date(year, monthIndex + 1, 1);
  const monthEndExclusive = formatDateISO(nextMonthDate);

  const countForCabin = (cabin: CabinId) => {
    let confirmedNights = 0;
    let pendingNights = 0;
    let blockedNights = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
      const res = findReservationForNight(reservations, cabin, iso);
      if (res) {
        if (res.status === 'confirmed') confirmedNights++;
        else if (res.status === 'pending_deposit') pendingNights++;
        else if (res.status === 'blocked') blockedNights++;
      }
    }

    const occupiedNights = confirmedNights + pendingNights;
    const freeNights = Math.max(0, daysInMonth - occupiedNights - blockedNights);
    const occupancyPct = Math.round((occupiedNights / daysInMonth) * 100);

    return {
      confirmedNights,
      pendingNights,
      blockedNights,
      occupiedNights,
      freeNights,
      occupancyPct,
    };
  };

  // Prorated revenue & pending amounts for stays intersecting this month
  let estimatedMonthRevenue = 0;
  let pendingDepositsMonth = 0;
  let pendingBalancesMonth = 0;
  let receivedDepositsMonth = 0;

  const monthReservations = reservations
    .filter((r) => r.checkIn < monthEndExclusive && monthStart < r.checkOut)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

  for (const res of monthReservations) {
    if (res.status === 'blocked') continue;
    const overlapStart = res.checkIn > monthStart ? res.checkIn : monthStart;
    const overlapEnd = res.checkOut < monthEndExclusive ? res.checkOut : monthEndExclusive;
    const nightsInMonth = diffNights(overlapStart, overlapEnd);
    const ratio = res.nights > 0 ? nightsInMonth / res.nights : 0;

    const proratedTotal = Math.round(res.totalAmount * ratio);
    estimatedMonthRevenue += proratedTotal;

    const proratedDeposit = Math.round(res.depositAmount * ratio);
    const proratedBalance = Math.round(res.balanceAmount * ratio);

    if (res.checklist.depositReceived) {
      receivedDepositsMonth += proratedDeposit;
    } else {
      pendingDepositsMonth += proratedDeposit;
    }

    if (!res.checklist.balancePaid) {
      pendingBalancesMonth += proratedBalance;
    }
  }

  return {
    daysInMonth,
    colibri: countForCabin('colibri'),
    chercan: countForCabin('chercan'),
    estimatedMonthRevenue,
    receivedDepositsMonth,
    pendingDepositsMonth,
    pendingBalancesMonth,
    monthReservations,
  };
}

export function buildWhatsAppUrl(phone: string, guestName?: string): string | null {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 8) return null;
  const normalized = digits.startsWith('56') ? digits : digits.length === 9 && digits.startsWith('9') ? `56${digits}` : digits;
  const text = guestName
    ? encodeURIComponent(`Hola ${guestName}, te escribimos desde Refugio Repalet en Horcón.`)
    : '';
  return text ? `https://wa.me/${normalized}?text=${text}` : `https://wa.me/${normalized}`;
}

export function getChecklistProgress(res: Reservation): { done: number; total: number } {
  const vals = Object.values(res.checklist);
  return {
    done: vals.filter(Boolean).length,
    total: vals.length,
  };
}

export function getAllowedMonthRange(
  baseDate: Date = new Date(),
  backMonths = 3,
  forwardMonths = 3
) {
  const minDate = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth() - backMonths,
    1
  );
  const maxDate = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth() + forwardMonths,
    1
  );
  const months: Array<{
    year: number;
    monthIndex: number;
    label: string;
    isCurrent: boolean;
  }> = [];

  for (let offset = -backMonths; offset <= forwardMonths; offset++) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1);
    months.push({
      year: d.getFullYear(),
      monthIndex: d.getMonth(),
      label: `${MONTHS_ES[d.getMonth()].slice(0, 3)} ${String(d.getFullYear()).slice(2)}`,
      isCurrent: offset === 0,
    });
  }

  return {
    minYear: minDate.getFullYear(),
    minMonth: minDate.getMonth(),
    maxYear: maxDate.getFullYear(),
    maxMonth: maxDate.getMonth(),
    months,
  };
}
