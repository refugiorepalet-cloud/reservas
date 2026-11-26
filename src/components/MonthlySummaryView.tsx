import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileDown,
  History,
  Printer,
  Search,
  Wrench,
  X,
} from 'lucide-react';
import {
  CABINS,
  CHANNEL_META,
  Reservation,
  STATUS_META,
} from '../types';
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

function normalizeDocKey(doc: string): string {
  return doc.replace(/[\s.\-]/g, '').trim().toLowerCase();
}

function getGuestIdentityKey(res: Reservation): string {
  const docKey = normalizeDocKey(res.guestDocument || '');
  if (docKey) return `doc:${docKey}`;
  return `name:${res.guestName.trim().toLowerCase()}`;
}

function escapeCsvCell(value: string | number | boolean): string {
  const str = String(value ?? '');
  if (/[",\n\r;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const MonthlySummaryView: React.FC<MonthlySummaryViewProps> = ({
  year,
  monthIndex,
  reservations,
  onChangeMonth,
  onSelectReservation,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [historySource, setHistorySource] = useState<Reservation | null>(null);

  const monthRange = useMemo(() => getAllowedMonthRange(new Date()), []);
  const isAtMinMonth =
    year === monthRange.minYear && monthIndex === monthRange.minMonth;
  const isAtMaxMonth =
    year === monthRange.maxYear && monthIndex === monthRange.maxMonth;

  const stats = useMemo(
    () => getMonthlyStats(reservations, year, monthIndex),
    [reservations, year, monthIndex]
  );

  // Map every guest identity key to all their non-blocked stays across all months
  const guestStaysMap = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const r of reservations) {
      if (r.status === 'blocked') continue;
      const key = getGuestIdentityKey(r);
      const list = map.get(key) || [];
      list.push(r);
      map.set(key, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => b.checkIn.localeCompare(a.checkIn));
    }
    return map;
  }, [reservations]);

  const filteredMonthReservations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return stats.monthReservations;
    const qDoc = normalizeDocKey(q);
    return stats.monthReservations.filter((r) => {
      const nameMatch = r.guestName.toLowerCase().includes(q);
      const docMatch =
        (r.guestDocument || '').toLowerCase().includes(q) ||
        (qDoc.length > 0 && normalizeDocKey(r.guestDocument || '').includes(qDoc));
      const phoneMatch = (r.guestWhatsapp || '').toLowerCase().includes(q);
      return nameMatch || docMatch || phoneMatch;
    });
  }, [stats.monthReservations, searchQuery]);

  const historyStays = useMemo(() => {
    if (!historySource) return [];
    const key = getGuestIdentityKey(historySource);
    return guestStaysMap.get(key) || [historySource];
  }, [historySource, guestStaysMap]);

  const historyTotals = useMemo(() => {
    return historyStays.reduce(
      (acc, stay) => {
        acc.nights += stay.nights;
        acc.amount += stay.totalAmount;
        return acc;
      },
      { nights: 0, amount: 0 }
    );
  }, [historyStays]);

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

  const handleDownloadMonthlyCsv = () => {
    const headers = [
      'Check-in',
      'Check-out',
      'Noches',
      'Cabaña',
      'Estado',
      'Huésped',
      'RUT / DNI / Pasaporte',
      'WhatsApp',
      'Canal',
      'Visitas totales registradas',
      'Tarifa noche CLP',
      'Total CLP',
      'Abono 50% CLP',
      'Saldo 50% CLP',
      'Abono recibido',
      'Saldo pagado',
      'Cédula registrada',
      'Llaves entregadas',
      'Notas',
    ];

    const rows = stats.monthReservations.map((r) => {
      const visitsCount =
        r.status === 'blocked'
          ? 0
          : (guestStaysMap.get(getGuestIdentityKey(r))?.length ?? 1);
      return [
        r.checkIn,
        r.checkOut,
        r.nights,
        CABINS[r.cabin].name,
        STATUS_META[r.status].label,
        r.guestName,
        r.guestDocument || '',
        r.guestWhatsapp || '',
        CHANNEL_META[r.channel],
        visitsCount,
        r.nightlyRate,
        r.totalAmount,
        r.depositAmount,
        r.balanceAmount,
        r.checklist.depositReceived ? 'Sí' : 'No',
        r.checklist.balancePaid ? 'Sí' : 'No',
        r.checklist.idRegistered ? 'Sí' : 'No',
        r.checklist.keysHandled ? 'Sí' : 'No',
        r.notes || '',
      ]
        .map(escapeCsvCell)
        .join(',');
    });

    const csvContent = '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const monthStr = String(monthIndex + 1).padStart(2, '0');
    const a = document.createElement('a');
    a.href = url;
    a.download = `Informe_Refugio_Repalet_${year}-${monthStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <section className="space-y-5">
      {/* Print-only Header */}
      <div className="hidden print:block border-b border-[#3F2E26]/25 pb-3 mb-4">
        <h1 className="font-display text-2xl font-bold text-[#3F2E26]">
          Refugio Repalet · Informe Mensual
        </h1>
        <p className="text-sm text-[#3F2E26]/80 mt-0.5">
          {MONTHS_ES[monthIndex]} {year} · Cabaña Colibrí y Cabaña Chercán
        </p>
      </div>

      {/* Month Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <p className="text-xs font-semibold text-[#2B8A7E]">Resumen e informe mensual</p>
          <h2 className="font-display text-2xl font-semibold text-[#3F2E26]">
            {MONTHS_ES[monthIndex]} {year}
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleDownloadMonthlyCsv}
            disabled={stats.monthReservations.length === 0}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#3F2E26]/15 bg-[#FAF4EC] text-[#3F2E26] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#D9C3A0]/45 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <FileDown className="w-4 h-4 text-[#2B8A7E]" />
            <span>Excel (.csv)</span>
          </button>

          <button
            type="button"
            onClick={handlePrintReport}
            disabled={stats.monthReservations.length === 0}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#3F2E26]/15 bg-[#FAF4EC] text-[#3F2E26] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#D9C3A0]/45 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[#3F2E26]" />
            <span className="hidden sm:inline">Imprimir / PDF</span>
          </button>

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
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 print:hidden">
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
      <div className="rounded-3xl bg-[#D9C3A0]/65 border border-[#3F2E26]/15 p-5 shadow-sm print:bg-white print:shadow-none">
        <p className="text-xs font-semibold text-[#3F2E26]/75">
          Total mensual estimado ({stats.daysInMonth} días)
        </p>
        <p className="font-display text-3xl sm:text-4xl font-bold text-[#3F2E26] tabular-nums mt-1">
          {formatCLP(stats.estimatedMonthRevenue)}
        </p>

        <div className="mt-4 pt-4 border-t border-[#3F2E26]/15 grid grid-cols-1 sm:grid-cols-3 gap-3 print:grid-cols-3">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-2">
        {(
          [
            { id: 'colibri' as const, data: stats.colibri },
            { id: 'chercan' as const, data: stats.chercan },
          ]
        ).map(({ id, data }) => (
          <div
            key={id}
            className="rounded-2xl bg-[#FAF4EC] border border-[#3F2E26]/15 p-4 sm:p-5 space-y-3 print:bg-white"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-display text-lg font-semibold text-[#3F2E26]">
                {CABINS[id].name}
              </h3>
              <span className="text-sm font-bold text-[#2B8A7E] tabular-nums">
                {data.occupancyPct}% ocupación
              </span>
            </div>

            <div className="w-full h-2.5 rounded-full bg-[#D9C3A0]/50 overflow-hidden print:hidden">
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

      {/* Screen List: Month Stays & Guest Report */}
      <div className="rounded-3xl bg-[#FAF4EC] border border-[#3F2E26]/15 overflow-hidden print:hidden">
        <div className="px-5 py-4 border-b border-[#3F2E26]/12 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold text-[#3F2E26]">
              Huéspedes y movimientos de {MONTHS_ES[monthIndex].toLowerCase()}
            </h3>
            <span className="text-xs font-semibold text-[#3F2E26]/65 tabular-nums shrink-0">
              {filteredMonthReservations.length}{' '}
              {filteredMonthReservations.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>

          {stats.monthReservations.length > 0 && (
            <div className="relative">
              <Search className="w-4 h-4 text-[#3F2E26]/45 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, RUT/DNI o WhatsApp..."
                aria-label="Buscar huésped en el informe mensual"
                className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl border border-[#3F2E26]/15 bg-white text-sm text-[#3F2E26] focus:outline-none focus:ring-2 focus:ring-[#4EBBAD]"
              />
            </div>
          )}
        </div>

        {filteredMonthReservations.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#3F2E26]/65">
            {stats.monthReservations.length === 0
              ? `No hay reservas ni bloqueos registrados para ${MONTHS_ES[monthIndex].toLowerCase()}.`
              : 'No encontramos registros que coincidan con tu búsqueda.'}
          </div>
        ) : (
          <div className="divide-y divide-[#3F2E26]/10">
            {filteredMonthReservations.map((res) => {
              const progress = getChecklistProgress(res);
              const guestVisits =
                res.status === 'blocked'
                  ? 0
                  : (guestStaysMap.get(getGuestIdentityKey(res))?.length ?? 1);

              return (
                <div
                  key={res.id}
                  className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[#F5EBDD]/70 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onSelectReservation(res)}
                    className="flex-1 min-w-0 text-left space-y-0.5 cursor-pointer"
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-semibold text-sm text-[#3F2E26] truncate">
                        {res.guestName}
                      </span>
                      <span className="text-xs text-[#2B8A7E] font-medium shrink-0">
                        {CABINS[res.cabin].shortName}
                      </span>
                      {res.status !== 'blocked' && (
                        <span className="text-xs text-[#3F2E26]/55 shrink-0">
                          · {CHANNEL_META[res.channel]}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[#3F2E26]/70 tabular-nums">
                      {formatShortDateES(res.checkIn)} → {formatShortDateES(res.checkOut)} ·{' '}
                      {res.nights} {res.nights === 1 ? 'noche' : 'noches'} ·{' '}
                      {STATUS_META[res.status].label}
                    </p>

                    {res.status !== 'blocked' && (
                      <p className="text-xs text-[#3F2E26]/65 tabular-nums truncate">
                        RUT/DNI: {res.guestDocument || 'Sin registrar'} · WhatsApp:{' '}
                        {res.guestWhatsapp || 'Sin registrar'}
                      </p>
                    )}
                  </button>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {res.status !== 'blocked' && (
                      <button
                        type="button"
                        onClick={() => setHistorySource(res)}
                        title="Ver historial del cliente"
                        className="min-h-[44px] px-2.5 py-1.5 rounded-xl border border-[#3F2E26]/15 bg-white text-xs font-semibold text-[#3F2E26] inline-flex items-center gap-1.5 hover:bg-[#D9C3A0]/35 transition-colors cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5 text-[#2B8A7E]" />
                        <span className="tabular-nums">
                          {guestVisits} {guestVisits === 1 ? 'visita' : 'visitas'}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onSelectReservation(res)}
                      className="text-right space-y-0.5 cursor-pointer min-h-[44px] flex flex-col justify-center"
                    >
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
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Print-only Table for clean PDF / Paper Monthly Report */}
      <div className="hidden print:block rounded-2xl border border-[#3F2E26]/20 overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#F5EBDD] border-b border-[#3F2E26]/20 text-[#3F2E26]">
              <th className="py-2 px-2.5 font-semibold">Fechas</th>
              <th className="py-2 px-2.5 font-semibold">Cabaña</th>
              <th className="py-2 px-2.5 font-semibold">Huésped</th>
              <th className="py-2 px-2.5 font-semibold">RUT / DNI</th>
              <th className="py-2 px-2.5 font-semibold">WhatsApp</th>
              <th className="py-2 px-2.5 font-semibold">Canal</th>
              <th className="py-2 px-2.5 font-semibold text-right">Total</th>
              <th className="py-2 px-2.5 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3F2E26]/12">
            {stats.monthReservations.map((res) => (
              <tr key={res.id}>
                <td className="py-2 px-2.5 tabular-nums whitespace-nowrap">
                  {formatShortDateES(res.checkIn)} – {formatShortDateES(res.checkOut)} ({res.nights}n)
                </td>
                <td className="py-2 px-2.5">{CABINS[res.cabin].shortName}</td>
                <td className="py-2 px-2.5 font-semibold">{res.guestName}</td>
                <td className="py-2 px-2.5 tabular-nums">
                  {res.status === 'blocked' ? '—' : res.guestDocument || 'Sin registrar'}
                </td>
                <td className="py-2 px-2.5 tabular-nums">
                  {res.status === 'blocked' ? '—' : res.guestWhatsapp || '—'}
                </td>
                <td className="py-2 px-2.5">{CHANNEL_META[res.channel]}</td>
                <td className="py-2 px-2.5 text-right tabular-nums font-semibold">
                  {res.status === 'blocked' ? '—' : formatCLP(res.totalAmount)}
                </td>
                <td className="py-2 px-2.5">{STATUS_META[res.status].shortLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Guest History Modal */}
      {historySource && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#3F2E26]/55 backdrop-blur-sm p-0 sm:p-4 print:hidden"
          onClick={() => setHistorySource(null)}
        >
          <div
            className="w-full sm:max-w-lg max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-[#FAF4EC] border border-[#3F2E26]/15 p-5 sm:p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#2B8A7E]">
                  Historial del huésped
                </p>
                <h3 className="font-display text-xl font-semibold text-[#3F2E26] truncate mt-0.5">
                  {historySource.guestName}
                </h3>
                <p className="text-xs text-[#3F2E26]/70 tabular-nums mt-0.5">
                  RUT/DNI: {historySource.guestDocument || 'Sin registrar'} · WhatsApp:{' '}
                  {historySource.guestWhatsapp || 'Sin registrar'}
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar historial"
                onClick={() => setHistorySource(null)}
                className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-[#3F2E26]/70 hover:bg-[#D9C3A0]/40 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl bg-[#D9C3A0]/45 border border-[#3F2E26]/15 p-3.5 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[11px] text-[#3F2E26]/70">Estadías</p>
                <p className="text-base font-bold text-[#3F2E26] tabular-nums">
                  {historyStays.length}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#3F2E26]/70">Noches totales</p>
                <p className="text-base font-bold text-[#2B8A7E] tabular-nums">
                  {historyTotals.nights}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#3F2E26]/70">Total histórico</p>
                <p className="text-base font-bold text-[#3F2E26] tabular-nums">
                  {formatCLP(historyTotals.amount)}
                </p>
              </div>
            </div>

            <div className="divide-y divide-[#3F2E26]/10 rounded-2xl border border-[#3F2E26]/15 bg-white overflow-hidden">
              {historyStays.map((stay) => (
                <button
                  key={stay.id}
                  type="button"
                  onClick={() => {
                    setHistorySource(null);
                    onSelectReservation(stay);
                  }}
                  className="w-full min-h-[56px] px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[#F5EBDD]/70 transition-colors cursor-pointer"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-semibold text-[#3F2E26] tabular-nums">
                      {formatShortDateES(stay.checkIn)} → {formatShortDateES(stay.checkOut)}
                    </p>
                    <p className="text-xs text-[#3F2E26]/70">
                      {CABINS[stay.cabin].name} · {stay.nights}{' '}
                      {stay.nights === 1 ? 'noche' : 'noches'} · {CHANNEL_META[stay.channel]}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-[#3F2E26] tabular-nums">
                      {formatCLP(stay.totalAmount)}
                    </p>
                    <p className="text-[11px] text-[#2B8A7E] font-medium">
                      {STATUS_META[stay.status].shortLabel}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
