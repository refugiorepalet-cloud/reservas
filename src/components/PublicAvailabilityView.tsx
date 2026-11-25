import React, { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Lock,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { CABINS, CabinFilter, CabinId } from '../types';
import {
  formatDateISO,
  getAllowedMonthRange,
  getMonthDaysGrid,
  MONTHS_ES,
  WEEKDAYS_SHORT_ES,
} from '../utils/dateUtils';

interface RangeItem {
  checkIn: string;
  checkOut: string;
}

function parseRanges(raw: unknown): RangeItem[] {
  if (!Array.isArray(raw)) return [];
  const result: RangeItem[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string' && entry.length === 21 && entry[10] === '/') {
      result.push({
        checkIn: entry.slice(0, 10),
        checkOut: entry.slice(11, 21),
      });
    }
  }
  return result;
}

function isNightOccupied(ranges: RangeItem[], dayIso: string): boolean {
  return ranges.some((r) => r.checkIn <= dayIso && dayIso < r.checkOut);
}

export const PublicAvailabilityView: React.FC = () => {
  const now = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => formatDateISO(now), [now]);
  const [viewYear, setViewYear] = useState<number>(now.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(now.getMonth());
  const [cabinFilter, setCabinFilter] = useState<CabinFilter>('all');

  const [colibriRanges, setColibriRanges] = useState<RangeItem[]>([]);
  const [chercanRanges, setChercanRanges] = useState<RangeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const isEmbed = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('embed') === '1';
  }, []);

  useEffect(() => {
    const ref = doc(db, 'public', 'availability');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setColibriRanges(parseRanges(data?.colibri));
          setChercanRanges(parseRanges(data?.chercan));
        } else {
          setColibriRanges([]);
          setChercanRanges([]);
        }
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.GET, 'public/availability');
      }
    );
    return () => unsub();
  }, []);

  const monthRange = useMemo(() => getAllowedMonthRange(now, 0, 3), [now]);
  const isAtMinMonth =
    viewYear === monthRange.minYear && viewMonth === monthRange.minMonth;
  const isAtMaxMonth =
    viewYear === monthRange.maxYear && viewMonth === monthRange.maxMonth;

  const gridCells = useMemo(
    () => getMonthDaysGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const handlePrevMonth = () => {
    if (isAtMinMonth) return;
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (isAtMaxMonth) return;
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const checkCabinOccupied = (cabin: CabinId, iso: string) => {
    return cabin === 'colibri'
      ? isNightOccupied(colibriRanges, iso)
      : isNightOccupied(chercanRanges, iso);
  };

  return (
    <div className="min-h-screen bg-[#F5EBDD] text-[#3F2E26] p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        {!isEmbed && (
          <header className="flex items-center justify-between gap-4 pb-2 border-b border-[#3F2E26]/12">
            <div className="flex items-center gap-3">
              <img
                src={`${import.meta.env.BASE_URL}assets/aistudio/logo_transp_45a8aadc.png`}
                alt="Refugio Repalet"
                className="w-10 h-10 rounded-xl object-contain shrink-0"
              />
              <div>
                <h1 className="font-display text-lg sm:text-xl font-bold text-[#3F2E26] leading-tight">
                  Refugio Repalet
                </h1>
                <p className="text-xs text-[#2B8A7E] font-medium">
                  Disponibilidad en vivo · Horcón
                </p>
              </div>
            </div>
            <a
              href={import.meta.env.BASE_URL}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#3F2E26]/15 bg-[#FAF4EC] text-xs font-semibold text-[#3F2E26] flex items-center gap-1.5 hover:bg-[#D9C3A0]/45 transition-colors whitespace-nowrap shrink-0"
            >
              <Lock className="w-3.5 h-3.5 text-[#3F2E26]/70" />
              Acceso anfitriones
            </a>
          </header>
        )}

        {/* Cabin Filter Tabs */}
        <div
          role="tablist"
          aria-label="Seleccionar cabaña"
          className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-[#D9C3A0]/55 border border-[#3F2E26]/12"
        >
          {(
            [
              { id: 'all', label: 'Ambas cabañas' },
              { id: 'colibri', label: CABINS.colibri.name },
              { id: 'chercan', label: CABINS.chercan.name },
            ] as Array<{ id: CabinFilter; label: string }>
          ).map((tab) => {
            const active = cabinFilter === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setCabinFilter(tab.id)}
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

        {/* Public Calendar */}
        <div className="rounded-3xl bg-[#FAF4EC] border border-[#3F2E26]/15 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#3F2E26]">
              {MONTHS_ES[viewMonth]} {viewYear}
            </h2>
            <div className="flex items-center gap-1.5">
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

          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3">
            {monthRange.months.map((m) => {
              const active = m.year === viewYear && m.monthIndex === viewMonth;
              return (
                <button
                  key={`${m.year}-${m.monthIndex}`}
                  type="button"
                  onClick={() => {
                    setViewYear(m.year);
                    setViewMonth(m.monthIndex);
                  }}
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

          {loading ? (
            <div className="py-14 text-center text-sm text-[#3F2E26]/65">
              Consultando fechas disponibles...
            </div>
          ) : (
            <>
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

              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {gridCells.map(({ iso, dayNumber, inCurrentMonth }) => {
                  const isPast = iso < todayIso;
                  const isToday = iso === todayIso;
                  const colBusy = checkCabinOccupied('colibri', iso);
                  const cheBusy = checkCabinOccupied('chercan', iso);

                  if (cabinFilter === 'all') {
                    return (
                      <div
                        key={iso}
                        className={`min-h-[58px] sm:min-h-[70px] p-1 sm:p-1.5 rounded-xl border flex flex-col justify-between ${
                          isToday
                            ? 'border-[#3F2E26] ring-1 ring-[#3F2E26] bg-[#FAF4EC]'
                            : 'border-[#3F2E26]/12 bg-[#FAF4EC]'
                        } ${!inCurrentMonth || isPast ? 'opacity-45' : ''}`}
                      >
                        <span
                          className={`text-xs sm:text-sm tabular-nums px-0.5 ${
                            isToday ? 'font-bold text-[#F16E3F]' : 'font-semibold text-[#3F2E26]'
                          }`}
                        >
                          {dayNumber}
                        </span>
                        <div className="space-y-1">
                          <div
                            className={`rounded-md px-1 py-0.5 text-[10px] leading-tight flex items-center justify-between ${
                              colBusy
                                ? 'bg-[#D9C3A0] text-[#3F2E26]/75'
                                : 'bg-[#4EBBAD]/30 text-[#173E39] font-semibold'
                            }`}
                          >
                            <span>Col</span>
                            <span className="hidden sm:inline">
                              {colBusy ? 'Ocup.' : 'Libre'}
                            </span>
                          </div>
                          <div
                            className={`rounded-md px-1 py-0.5 text-[10px] leading-tight flex items-center justify-between ${
                              cheBusy
                                ? 'bg-[#D9C3A0] text-[#3F2E26]/75'
                                : 'bg-[#4EBBAD]/30 text-[#173E39] font-semibold'
                            }`}
                          >
                            <span>Che</span>
                            <span className="hidden sm:inline">
                              {cheBusy ? 'Ocup.' : 'Libre'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const busy = cabinFilter === 'colibri' ? colBusy : cheBusy;
                  return (
                    <div
                      key={iso}
                      className={`min-h-[54px] sm:min-h-[68px] p-1.5 rounded-xl border flex flex-col justify-between ${
                        busy
                          ? 'bg-[#D9C3A0]/70 border-[#3F2E26]/20 text-[#3F2E26]/70'
                          : 'bg-[#4EBBAD]/22 border-[#2B8A7E]/35 text-[#173E39]'
                      } ${isToday ? 'ring-2 ring-[#3F2E26]' : ''} ${
                        !inCurrentMonth || isPast ? 'opacity-45' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm font-semibold tabular-nums">
                          {dayNumber}
                        </span>
                        {!busy && <Check className="w-3.5 h-3.5 text-[#2B8A7E]" />}
                      </div>
                      <p className="text-[10px] sm:text-xs font-semibold truncate">
                        {busy ? 'Ocupado' : 'Disponible'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Public Legend */}
          <div className="mt-4 pt-3 border-t border-[#3F2E26]/10 flex flex-wrap items-center justify-between gap-3 text-xs text-[#3F2E26]/80">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-[#4EBBAD]/35 border border-[#2B8A7E]/45 inline-block" />
                <span>Disponible (check-in 15:00 hrs)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-[#D9C3A0] border border-[#3F2E26]/25 inline-block" />
                <span>Ocupado</span>
              </div>
            </div>
            <span className="text-[11px] text-[#3F2E26]/65">
              Check-in 15:00 · Check-out 12:00
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
