import React, { useMemo } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Wrench,
} from 'lucide-react';
import { CABINS, Reservation, STATUS_META } from '../types';
import {
  formatCLP,
  formatShortDateES,
  getAllowedMonthRange,
  getChecklistProgress,
  getMonthlyStats,
  MONTHS_ES,
} from '../utils/dateUtils';

interface MonthlySummaryViewProps {
  year: number;
  monthIndex: number;
  reservations: Reservation[];
  onChangeMonth: (year: number, monthIndex: number) => void;
  onSelectReservation: (reservation: Reservation) => void;
}

export const MonthlySummaryView: React.FC<MonthlySummaryViewProps> = ({
  year,
  monthIndex,
  reservations,
  onChangeMonth,
  onSelectReservation,
}) => {
  const monthRange = useMemo(() => getAllowedMonthRange(new Date()), []);
  const isAtMinMonth =
    year === monthRange.minYear && monthIndex === monthRange.minMonth;
  const isAtMaxMonth =
    year === monthRange.maxYear && monthIndex === monthRange.maxMonth;

  const stats = useMemo(
    () => getMonthlyStats(reservations, year, monthIndex),
    [reservations, year, monthIndex]
  );

  const handlePrev = () => {
    if (isAtMinMonth) return;
    if (monthIndex === 0) onChangeMonth(year - 1, 11);
    else onChangeMonth(year, monthIndex - 1);
  };

  const handleNext = () => {
    if (isAtMaxMonth) return;
    if (monthIndex === 11) onChangeMonth(year + 1, 0);
    else onChangeMonth(year, monthIndex + 1);
  };

  return (
    <section className="space-y-5">
      {/* Month Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#2B8A7E]">Resumen del mes</p>
          <h2 className="font-display text-2xl font-semibold text-[#3F2E26]">
            {MONTHS_ES[monthIndex]} {year}
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrev}
            disabled={isAtMinMonth}
            aria-label="Mes anterior"
            className="min-h-[44px] min-w-[44px] rounded-xl border border-[#3F2E26]/15 bg-[#FAF4EC] text-[#3F2E26] flex items-center justify-center hover:bg-[#D9C3A0]/40 transition-colors disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={isAtMaxMonth}
            aria-label="Mes siguiente"
            className="min-h-[44px] min-w-[44px] rounded-xl border border-[#3F2E26]/15 bg-[#FAF4EC] text-[#3F2E26] flex items-center justify-center hover:bg-[#D9C3A0]/40 transition-colors disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 7-Month Window Strip (-3 to +3 months) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {monthRange.months.map((m) => {
          const active = m.year === year && m.monthIndex === monthIndex;
          return (
            <button
              key={`${m.year}-${m.monthIndex}`}
              type="button"
              onClick={() => onChangeMonth(m.year, m.monthIndex)}
              className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-[#3F2E26] text-[#F5EBDD]'
                  : m.isCurrent
                  ? 'bg-[#4EBBAD]/20 text-[#2B8A7E] border border-[#2B8A7E]/30 hover:bg-[#4EBBAD]/30'
                  : 'bg-[#FAF4EC] border border-[#3F2E26]/12 text-[#3F2E26]/75 hover:bg-[#D9C3A0]/45'
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Financial Summary Card (Sand) */}
      <div className="rounded-3xl bg-[#D9C3A0]/65 border border-[#3F2E26]/15 p-5 shadow-sm">
        <p className="text-xs font-semibold text-[#3F2E26]/75">
          Total mensual estimado ({stats.daysInMonth} días)
        </p>
        <p className="font-display text-3xl sm:text-4xl font-bold text-[#3F2E26] tabular-nums mt-1">
          {formatCLP(stats.estimatedMonthRevenue)}
        </p>

        <div className="mt-4 pt-4 border-t border-[#3F2E26]/15 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <p className="text-[11px] font-medium text-[#3F2E26]/70">Abonos recibidos</p>
            <p className="text-base font-bold text-[#2B8A7E] tabular-nums mt-0.5">
              {formatCLP(stats.receivedDepositsMonth)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-[#3F2E26]/70">Abonos pendientes</p>
            <p className="text-base font-bold text-[#B3431B] tabular-nums mt-0.5">
              {formatCLP(stats.pendingDepositsMonth)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-[#3F2E26]/70">
              Saldos por cobrar al llegar
            </p>
            <p className="text-base font-bold text-[#3F2E26] tabular-nums mt-0.5">
              {formatCLP(stats.pendingBalancesMonth)}
            </p>
          </div>
        </div>
      </div>

      {/* Cabin Occupancy Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(
          [
            { id: 'colibri' as const, data: stats.colibri },
            { id: 'chercan' as const, data: stats.chercan },
          ]
        ).map(({ id, data }) => (
          <div
            key={id}
            className="rounded-2xl bg-[#FAF4EC] border border-[#3F2E26]/15 p-4 sm:p-5 space-y-3"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-display text-lg font-semibold text-[#3F2E26]">
                {CABINS[id].name}
              </h3>
              <span className="text-sm font-bold text-[#2B8A7E] tabular-nums">
                {data.occupancyPct}% ocupación
              </span>
            </div>

            <div className="w-full h-2.5 rounded-full bg-[#D9C3A0]/50 overflow-hidden">
              <div
                className="h-full bg-[#4EBBAD] rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, data.occupancyPct)}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
              <div>
                <p className="text-[#3F2E26]/65">Ocupadas</p>
                <p className="font-bold text-[#3F2E26] tabular-nums text-sm">
                  {data.occupiedNights} noches
                </p>
              </div>
              <div>
                <p className="text-[#3F2E26]/65">Libres</p>
                <p className="font-bold text-[#2B8A7E] tabular-nums text-sm">
                  {data.freeNights} noches
                </p>
              </div>
              <div>
                <p className="text-[#3F2E26]/65">Bloqueos</p>
                <p className="font-bold text-[#3F2E26]/80 tabular-nums text-sm">
                  {data.blockedNights} noches
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Month Stays List */}
      <div className="rounded-3xl bg-[#FAF4EC] border border-[#3F2E26]/15 overflow-hidden">
        <div className="px-5 py-4 border-b border-[#3F2E26]/12 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-[#3F2E26]">
            Movimientos de {MONTHS_ES[monthIndex].toLowerCase()}
          </h3>
          <span className="text-xs font-semibold text-[#3F2E26]/65 tabular-nums">
            {stats.monthReservations.length}{' '}
            {stats.monthReservations.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {stats.monthReservations.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#3F2E26]/65">
            No hay reservas ni bloqueos registrados para {MONTHS_ES[monthIndex].toLowerCase()}.
          </div>
        ) : (
          <div className="divide-y divide-[#3F2E26]/10">
            {stats.monthReservations.map((res) => {
              const progress = getChecklistProgress(res);
              return (
                <button
                  key={res.id}
                  type="button"
                  onClick={() => onSelectReservation(res)}
                  className="w-full min-h-[64px] px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#F5EBDD]/70 transition-colors cursor-pointer"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[#3F2E26] truncate">
                        {res.guestName}
                      </span>
                      <span className="text-xs text-[#2B8A7E] font-medium shrink-0">
                        {CABINS[res.cabin].shortName}
                      </span>
                    </div>
                    <p className="text-xs text-[#3F2E26]/70 tabular-nums">
                      {formatShortDateES(res.checkIn)} → {formatShortDateES(res.checkOut)} ·{' '}
                      {res.nights} {res.nights === 1 ? 'noche' : 'noches'} ·{' '}
                      {STATUS_META[res.status].label}
                    </p>
                  </div>

                  <div className="text-right shrink-0 space-y-0.5">
                    {res.status !== 'blocked' ? (
                      <>
                        <p className="text-sm font-bold text-[#3F2E26] tabular-nums">
                          {formatCLP(res.totalAmount)}
                        </p>
                        <p className="text-[11px] font-medium text-[#3F2E26]/70 tabular-nums flex items-center justify-end gap-1">
                          {res.status === 'confirmed' ? (
                            <Check className="w-3 h-3 text-[#2B8A7E]" />
                          ) : (
                            <Clock className="w-3 h-3 text-[#F16E3F]" />
                          )}
                          <span>
                            Checklist {progress.done}/{progress.total}
                          </span>
                        </p>
                      </>
                    ) : (
                      <span className="text-xs font-medium text-[#3F2E26]/65 inline-flex items-center gap-1">
                        <Wrench className="w-3.5 h-3.5" />
                        Mantención
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
