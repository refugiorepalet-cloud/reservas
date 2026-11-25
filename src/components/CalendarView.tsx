import React, { useMemo, useState } from 'react';
import {
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Wrench,
  X,
} from 'lucide-react';
import {
  CABINS,
  CabinFilter,
  CabinId,
  Reservation,
  STATUS_META,
} from '../types';
import {
  addDaysISO,
  findReservationForNight,
  formatCLP,
  formatDateISO,
  formatFullDateES,
  formatShortDateES,
  getAllowedMonthRange,
  getChecklistProgress,
  getMonthDaysGrid,
  MONTHS_ES,
  reservationChecksOutOn,
  WEEKDAYS_SHORT_ES,
} from '../utils/dateUtils';

interface CalendarViewProps {
  year: number;
  monthIndex: number;
  cabinFilter: CabinFilter;
  reservations: Reservation[];
  onChangeMonth: (year: number, monthIndex: number) => void;
  onChangeCabinFilter: (filter: CabinFilter) => void;
  onSelectFreeDate: (cabin: CabinId, checkInIso: string) => void;
  onSelectReservation: (reservation: Reservation) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  year,
  monthIndex,
  cabinFilter,
  reservations,
  onChangeMonth,
  onChangeCabinFilter,
  onSelectFreeDate,
  onSelectReservation,
}) => {
  const [selectedDaySheetIso, setSelectedDaySheetIso] = useState<string | null>(null);
  const todayIso = useMemo(() => formatDateISO(new Date()), []);
  const monthRange = useMemo(() => getAllowedMonthRange(new Date()), []);

  const isAtMinMonth =
    year === monthRange.minYear && monthIndex === monthRange.minMonth;
  const isAtMaxMonth =
    year === monthRange.maxYear && monthIndex === monthRange.maxMonth;

  const gridCells = useMemo(
    () => getMonthDaysGrid(year, monthIndex),
    [year, monthIndex]
  );

  const handlePrevMonth = () => {
    if (isAtMinMonth) return;
    if (monthIndex === 0) onChangeMonth(year - 1, 11);
    else onChangeMonth(year, monthIndex - 1);
  };

  const handleNextMonth = () => {
    if (isAtMaxMonth) return;
    if (monthIndex === 11) onChangeMonth(year + 1, 0);
    else onChangeMonth(year, monthIndex + 1);
  };

  const handleToday = () => {
    const now = new Date();
    onChangeMonth(now.getFullYear(), now.getMonth());
  };

  const renderStatusIcon = (status: Reservation['status'], size = 'w-3 h-3') => {
    if (status === 'confirmed') return <Check className={size} />;
    if (status === 'pending_deposit') return <Clock className={size} />;
    return <Wrench className={size} />;
  };

  const getMiniBarStyle = (res?: Reservation) => {
    if (!res) {
      return 'bg-[#F5EBDD]/70 text-[#3F2E26]/45 border border-[#3F2E26]/10';
    }
    if (res.status === 'confirmed') {
      return 'bg-[#4EBBAD] text-[#173E39] font-semibold';
    }
    if (res.status === 'pending_deposit') {
      return 'bg-[#F16E3F]/25 text-[#9B3B18] border border-[#F16E3F]/45 font-semibold';
    }
    return 'bg-[#D9C3A0] text-[#3F2E26] border border-[#3F2E26]/25 font-medium';
  };

  const getSingleCellStyle = (res?: Reservation, inCurrentMonth = true) => {
    const dim = inCurrentMonth ? '' : 'opacity-45';
    if (!res) {
      return `bg-[#FAF4EC] hover:bg-[#EFE1CD]/70 border-[#3F2E26]/12 text-[#3F2E26] ${dim}`;
    }
    if (res.status === 'confirmed') {
      return `bg-[#4EBBAD]/28 hover:bg-[#4EBBAD]/38 border-[#2B8A7E]/45 text-[#1A4B44] ${dim}`;
    }
    if (res.status === 'pending_deposit') {
      return `bg-[#F16E3F]/18 hover:bg-[#F16E3F]/28 border-[#F16E3F]/45 text-[#8A3010] ${dim}`;
    }
    return `bg-[#D9C3A0]/85 hover:bg-[#D9C3A0] border-[#3F2E26]/30 text-[#3F2E26] ${dim}`;
  };

  const handleDayClick = (iso: string) => {
    if (cabinFilter === 'all') {
      setSelectedDaySheetIso(iso);
      return;
    }
    const existing = findReservationForNight(reservations, cabinFilter, iso);
    if (existing) {
      onSelectReservation(existing);
    } else {
      onSelectFreeDate(cabinFilter, iso);
    }
  };

  const daySheetColibri = selectedDaySheetIso
    ? findReservationForNight(reservations, 'colibri', selectedDaySheetIso)
    : undefined;
  const daySheetChercan = selectedDaySheetIso
    ? findReservationForNight(reservations, 'chercan', selectedDaySheetIso)
    : undefined;

  return (
    <section className="space-y-4">
      {/* Cabin Filter Tabs + New Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Filtrar por cabaña"
          className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-[#D9C3A0]/55 border border-[#3F2E26]/12"
        >
          {(
            [
              { id: 'all', label: 'Ambas cabañas' },
              { id: 'colibri', label: 'Cabaña Colibrí' },
              { id: 'chercan', label: 'Cabaña Chercán' },
            ] as Array<{ id: CabinFilter; label: string }>
          ).map((tab) => {
            const active = cabinFilter === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => onChangeCabinFilter(tab.id)}
                className={`min-h-[44px] px-2.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap truncate cursor-pointer ${
                  active
                    ? 'bg-[#3F2E26] text-[#F5EBDD] shadow-sm'
                    : 'text-[#3F2E26]/80 hover:text-[#3F2E26] hover:bg-[#FAF4EC]/60'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() =>
            onSelectFreeDate(cabinFilter === 'chercan' ? 'chercan' : 'colibri', todayIso)
          }
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#F16E3F] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#d95b2e] active:scale-[0.99] transition-all whitespace-nowrap shrink-0 cursor-pointer"
        >
          <CalendarPlus className="w-4 h-4 shrink-0" />
          Nueva reserva
        </button>
      </div>

      {/* Calendar Card */}
      <div className="rounded-3xl bg-[#FAF4EC] border border-[#3F2E26]/15 p-3 sm:p-5 shadow-sm">
        {/* Month Header */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#3F2E26]">
              {MONTHS_ES[monthIndex]} {year}
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToday}
              className="min-h-[44px] px-3 rounded-xl border border-[#3F2E26]/15 bg-[#F5EBDD]/70 text-xs font-semibold text-[#3F2E26] hover:bg-[#D9C3A0]/50 transition-colors whitespace-nowrap cursor-pointer"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={handlePrevMonth}
              disabled={isAtMinMonth}
              aria-label="Mes anterior"
              className="min-h-[44px] min-w-[44px] rounded-xl border border-[#3F2E26]/15 bg-[#FAF4EC] text-[#3F2E26] flex items-center justify-center hover:bg-[#D9C3A0]/40 transition-colors disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              disabled={isAtMaxMonth}
              aria-label="Mes siguiente"
              className="min-h-[44px] min-w-[44px] rounded-xl border border-[#3F2E26]/15 bg-[#FAF4EC] text-[#3F2E26] flex items-center justify-center hover:bg-[#D9C3A0]/40 transition-colors disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 7-Month Window Strip (-3 to +3 months) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3">
          {monthRange.months.map((m) => {
            const active = m.year === year && m.monthIndex === monthIndex;
            return (
              <button
                key={`${m.year}-${m.monthIndex}`}
                type="button"
                onClick={() => onChangeMonth(m.year, m.monthIndex)}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#3F2E26] text-[#F5EBDD]'
                    : m.isCurrent
                    ? 'bg-[#4EBBAD]/20 text-[#2B8A7E] border border-[#2B8A7E]/30 hover:bg-[#4EBBAD]/30'
                    : 'bg-[#F5EBDD]/70 text-[#3F2E26]/75 hover:bg-[#D9C3A0]/50'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-1.5">
          {WEEKDAYS_SHORT_ES.map((day) => (
            <div
              key={day}
              className="text-center text-[11px] sm:text-xs font-semibold text-[#3F2E26]/65 py-1"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {gridCells.map(({ iso, dayNumber, inCurrentMonth }) => {
            const isToday = iso === todayIso;
            const colibriRes = findReservationForNight(reservations, 'colibri', iso);
            const chercanRes = findReservationForNight(reservations, 'chercan', iso);

            if (cabinFilter === 'all') {
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => handleDayClick(iso)}
                  className={`min-h-[62px] sm:min-h-[78px] p-1 sm:p-1.5 rounded-xl border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                    isToday
                      ? 'border-[#3F2E26] ring-1 ring-[#3F2E26] bg-[#FAF4EC]'
                      : 'border-[#3F2E26]/12 bg-[#FAF4EC] hover:bg-[#EFE1CD]/60'
                  } ${inCurrentMonth ? '' : 'opacity-45'}`}
                >
                  <div className="flex items-center justify-between w-full px-0.5">
                    <span
                      className={`text-xs sm:text-sm tabular-nums ${
                        isToday ? 'font-bold text-[#F16E3F]' : 'font-semibold text-[#3F2E26]'
                      }`}
                    >
                      {dayNumber}
                    </span>
                  </div>

                  <div className="space-y-1 w-full">
                    <div
                      className={`rounded-md px-1 py-0.5 text-[10px] leading-tight flex items-center gap-1 truncate ${getMiniBarStyle(
                        colibriRes
                      )}`}
                      title={`Colibrí: ${colibriRes ? colibriRes.guestName : 'Libre'}`}
                    >
                      <span className="shrink-0 font-bold">C</span>
                      <span className="truncate hidden sm:inline">
                        {colibriRes ? colibriRes.guestName.split(' ')[0] : 'Libre'}
                      </span>
                      {colibriRes && (
                        <span className="ml-auto shrink-0">
                          {renderStatusIcon(colibriRes.status, 'w-2.5 h-2.5')}
                        </span>
                      )}
                    </div>
                    <div
                      className={`rounded-md px-1 py-0.5 text-[10px] leading-tight flex items-center gap-1 truncate ${getMiniBarStyle(
                        chercanRes
                      )}`}
                      title={`Chercán: ${chercanRes ? chercanRes.guestName : 'Libre'}`}
                    >
                      <span className="shrink-0 font-bold">Ch</span>
                      <span className="truncate hidden sm:inline">
                        {chercanRes ? chercanRes.guestName.split(' ')[0] : 'Libre'}
                      </span>
                      {chercanRes && (
                        <span className="ml-auto shrink-0">
                          {renderStatusIcon(chercanRes.status, 'w-2.5 h-2.5')}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            }

            // Single Cabin Mode
            const activeRes = cabinFilter === 'colibri' ? colibriRes : chercanRes;
            const checkOutMorning = reservations.find(
              (r) => r.cabin === cabinFilter && reservationChecksOutOn(r, iso)
            );

            return (
              <button
                key={iso}
                type="button"
                onClick={() => handleDayClick(iso)}
                className={`min-h-[56px] sm:min-h-[76px] p-1.5 rounded-xl border text-left flex flex-col justify-between transition-colors cursor-pointer ${getSingleCellStyle(
                  activeRes,
                  inCurrentMonth
                )} ${isToday ? 'ring-2 ring-[#3F2E26]' : ''}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-xs sm:text-sm tabular-nums ${
                      isToday ? 'font-bold text-[#F16E3F]' : 'font-semibold'
                    }`}
                  >
                    {dayNumber}
                  </span>
                  {activeRes && renderStatusIcon(activeRes.status, 'w-3.5 h-3.5 shrink-0')}
                </div>

                {activeRes ? (
                  <div className="w-full">
                    <p className="text-[10px] sm:text-xs font-semibold truncate leading-tight">
                      {activeRes.status === 'blocked'
                        ? 'Bloqueo'
                        : activeRes.guestName.split(' ')[0]}
                    </p>
                    <p className="text-[9px] opacity-75 truncate hidden sm:block">
                      {STATUS_META[activeRes.status].shortLabel}
                    </p>
                  </div>
                ) : (
                  <div className="w-full">
                    {checkOutMorning ? (
                      <p className="text-[9px] sm:text-[10px] text-[#2B8A7E] font-medium truncate">
                        Sale 12h
                      </p>
                    ) : (
                      <p className="text-[9px] sm:text-[10px] text-[#3F2E26]/45 hidden sm:block">
                        Libre
                      </p>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Clear Legend (never color-only) */}
        <div className="mt-4 pt-3 border-t border-[#3F2E26]/10 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#3F2E26]/80">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[#FAF4EC] border border-[#3F2E26]/25 inline-block" />
            <span>Libre (toca para agendar)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[#4EBBAD] text-[#173E39] inline-flex items-center justify-center">
              <Check className="w-2.5 h-2.5" />
            </span>
            <span>Confirmada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[#F16E3F]/25 border border-[#F16E3F]/50 text-[#9B3B18] inline-flex items-center justify-center">
              <Clock className="w-2.5 h-2.5" />
            </span>
            <span>Pendiente de abono</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[#D9C3A0] border border-[#3F2E26]/30 text-[#3F2E26] inline-flex items-center justify-center">
              <Wrench className="w-2.5 h-2.5" />
            </span>
            <span>Bloqueo / Mantención</span>
          </div>
        </div>
      </div>

      {/* Day Sheet Modal when tapping a date in "Ambas cabañas" view */}
      {selectedDaySheetIso && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#3F2E26]/50 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setSelectedDaySheetIso(null)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-[#FAF4EC] border border-[#3F2E26]/15 p-5 sm:p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-[#3F2E26]/20 rounded-full mx-auto mb-4 sm:hidden" />
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-medium text-[#2B8A7E]">
                  Disponibilidad del día
                </p>
                <h3 className="font-display text-xl font-semibold text-[#3F2E26]">
                  {formatFullDateES(selectedDaySheetIso)}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setSelectedDaySheetIso(null)}
                className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-[#3F2E26]/70 hover:bg-[#D9C3A0]/40 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {(['colibri', 'chercan'] as CabinId[]).map((cabinId) => {
                const res = cabinId === 'colibri' ? daySheetColibri : daySheetChercan;
                const checkOutToday = reservations.find(
                  (r) => r.cabin === cabinId && reservationChecksOutOn(r, selectedDaySheetIso)
                );

                return (
                  <div
                    key={cabinId}
                    className="rounded-2xl border border-[#3F2E26]/15 bg-[#F5EBDD]/65 p-4"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-display font-semibold text-base text-[#3F2E26]">
                        {CABINS[cabinId].name}
                      </span>
                      {res ? (
                        <span className="text-xs font-semibold text-[#2B8A7E] flex items-center gap-1">
                          {renderStatusIcon(res.status, 'w-3.5 h-3.5')}
                          {STATUS_META[res.status].label}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-[#2B8A7E]">
                          Disponible desde 15:00
                        </span>
                      )}
                    </div>

                    {res ? (
                      <div className="space-y-3">
                        <div className="text-sm text-[#3F2E26]/85">
                          <p className="font-semibold text-[#3F2E26]">{res.guestName}</p>
                          <p className="text-xs text-[#3F2E26]/70 tabular-nums mt-0.5">
                            {formatShortDateES(res.checkIn)} → {formatShortDateES(res.checkOut)} ·{' '}
                            {res.nights} {res.nights === 1 ? 'noche' : 'noches'}
                            {res.status !== 'blocked' && (
                              <>
                                {' '}
                                · {formatCLP(res.totalAmount)} · Seguimiento{' '}
                                {getChecklistProgress(res).done}/{getChecklistProgress(res).total}
                              </>
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDaySheetIso(null);
                            onSelectReservation(res);
                          }}
                          className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#3F2E26] text-[#F5EBDD] text-sm font-semibold hover:bg-[#2d201a] transition-colors cursor-pointer"
                        >
                          Ver ficha rápida
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {checkOutToday && (
                          <p className="text-xs text-[#3F2E26]/75">
                            Check-out a las 12:00 hrs ({checkOutToday.guestName}). Libre para
                            ingreso a las 15:00 hrs.
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const targetIso = selectedDaySheetIso;
                            setSelectedDaySheetIso(null);
                            onSelectFreeDate(cabinId, targetIso);
                          }}
                          className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#F16E3F] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#d95b2e] transition-colors cursor-pointer"
                        >
                          <CalendarPlus className="w-4 h-4" />
                          Agendar {CABINS[cabinId].shortName} ({formatShortDateES(selectedDaySheetIso)} –{' '}
                          {formatShortDateES(addDaysISO(selectedDaySheetIso, 1))})
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
