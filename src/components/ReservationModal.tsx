import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckSquare,
  Clock,
  Edit3,
  MessageCircle,
  Square,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import {
  BookingChannel,
  CABINS,
  CabinId,
  CHANNEL_META,
  CHECKLIST_ITEMS,
  DEFAULT_NIGHTLY_RATE,
  MAX_DOCUMENT_LEN,
  MAX_GUEST_NAME_LEN,
  MAX_NOTES_LEN,
  MAX_WHATSAPP_LEN,
  Reservation,
  ReservationChecklist,
  ReservationInput,
  ReservationStatus,
  STATUS_META,
} from '../types';
import {
  addDaysISO,
  buildWhatsAppUrl,
  diffNights,
  findOverlappingReservation,
  formatCLP,
  formatFullDateES,
} from '../utils/dateUtils';

interface ReservationModalProps {
  isOpen: boolean;
  initialMode: 'detail' | 'form';
  reservation?: Reservation | null;
  prefillCabin?: CabinId;
  prefillCheckIn?: string;
  reservations: Reservation[];
  allowedEmails: string[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (data: ReservationInput, existingId?: string) => Promise<void>;
  onToggleChecklist: (
    reservation: Reservation,
    key: keyof ReservationChecklist
  ) => Promise<void>;
  onDelete: (reservation: Reservation) => Promise<void>;
}

const emptyChecklist: ReservationChecklist = {
  depositReceived: false,
  balancePaid: false,
  idRegistered: false,
  keysHandled: false,
};

export const ReservationModal: React.FC<ReservationModalProps> = ({
  isOpen,
  initialMode,
  reservation,
  prefillCabin = 'colibri',
  prefillCheckIn,
  reservations,
  allowedEmails,
  isSaving,
  onClose,
  onSave,
  onToggleChecklist,
  onDelete,
}) => {
  const [mode, setMode] = useState<'detail' | 'form'>(initialMode);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [cabin, setCabin] = useState<CabinId>(prefillCabin);
  const [status, setStatus] = useState<ReservationStatus>('pending_deposit');
  const [checkIn, setCheckIn] = useState<string>(prefillCheckIn || '');
  const [checkOut, setCheckOut] = useState<string>(
    prefillCheckIn ? addDaysISO(prefillCheckIn, 1) : ''
  );
  const [guestName, setGuestName] = useState<string>('');
  const [guestDocument, setGuestDocument] = useState<string>('');
  const [guestWhatsapp, setGuestWhatsapp] = useState<string>('');
  const [channel, setChannel] = useState<BookingChannel>('whatsapp');
  const [nightlyRateStr, setNightlyRateStr] = useState<string>(
    String(DEFAULT_NIGHTLY_RATE)
  );
  const [checklist, setChecklist] = useState<ReservationChecklist>(emptyChecklist);
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setConfirmDelete(false);
    setFormError(null);

    if (reservation) {
      setCabin(reservation.cabin);
      setStatus(reservation.status);
      setCheckIn(reservation.checkIn);
      setCheckOut(reservation.checkOut);
      setGuestName(reservation.guestName);
      setGuestDocument(reservation.guestDocument || '');
      setGuestWhatsapp(
        (reservation.guestWhatsapp || '')
          .replace(/[^\d+]/g, '')
          .replace(/(?!^)\+/g, '')
      );
      setChannel(reservation.channel);
      setNightlyRateStr(String(reservation.nightlyRate));
      setChecklist(reservation.checklist);
      setNotes(reservation.notes);
    } else {
      const start = prefillCheckIn || new Date().toISOString().slice(0, 10);
      setCabin(prefillCabin);
      setStatus('pending_deposit');
      setCheckIn(start);
      setCheckOut(addDaysISO(start, 1));
      setGuestName('');
      setGuestDocument('');
      setGuestWhatsapp('');
      setChannel('whatsapp');
      setNightlyRateStr(String(DEFAULT_NIGHTLY_RATE));
      setChecklist(emptyChecklist);
      setNotes('');
    }
  }, [isOpen, initialMode, reservation, prefillCabin, prefillCheckIn]);

  const nights = useMemo(() => diffNights(checkIn, checkOut), [checkIn, checkOut]);
  const numericRate = useMemo(() => {
    if (status === 'blocked') return 0;
    const parsed = Number(nightlyRateStr.replace(/\D/g, ''));
    return Number.isFinite(parsed) ? Math.min(5000000, Math.max(0, parsed)) : 0;
  }, [nightlyRateStr, status]);

  const totalAmount = nights * numericRate;
  const depositAmount = Math.round(totalAmount * 0.5);
  const balanceAmount = totalAmount - depositAmount;

  const overlapping = useMemo(() => {
    if (!checkIn || !checkOut || checkOut <= checkIn) return undefined;
    return findOverlappingReservation(
      reservations,
      cabin,
      checkIn,
      checkOut,
      reservation?.id
    );
  }, [reservations, cabin, checkIn, checkOut, reservation?.id]);

  if (!isOpen) return null;

  const handleToggleType = (isBlock: boolean) => {
    if (isBlock) {
      setStatus('blocked');
      setChannel('internal');
      if (!guestName.trim()) setGuestName('Mantención / Bloqueo');
    } else {
      setStatus('pending_deposit');
      if (channel === 'internal') setChannel('whatsapp');
      if (guestName.trim() === 'Mantención / Bloqueo') setGuestName('');
      if (numericRate === 0) setNightlyRateStr(String(DEFAULT_NIGHTLY_RATE));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!checkIn || !checkOut || checkOut <= checkIn || nights < 1) {
      setFormError('La fecha de salida (check-out) debe ser posterior a la fecha de ingreso.');
      return;
    }

    if (overlapping) {
      setFormError(
        `Tope de fechas en ${CABINS[cabin].name}: ya existe "${overlapping.guestName}" (${overlapping.checkIn} al ${overlapping.checkOut}).`
      );
      return;
    }

    const cleanName = guestName.trim().slice(0, MAX_GUEST_NAME_LEN);
    if (!cleanName) {
      setFormError(
        status === 'blocked'
          ? 'Ingresa un motivo breve para el bloqueo o mantención.'
          : 'Ingresa el nombre del huésped.'
      );
      return;
    }

    const cleanDocument =
      status === 'blocked' ? '' : guestDocument.trim().slice(0, MAX_DOCUMENT_LEN);

    const cleanWhatsapp =
      status === 'blocked'
        ? ''
        : guestWhatsapp
            .replace(/[^\d+]/g, '')
            .replace(/(?!^)\+/g, '')
            .slice(0, MAX_WHATSAPP_LEN);

    if (
      status !== 'blocked' &&
      cleanWhatsapp.length > 0 &&
      !/^\+?\d{8,15}$/.test(cleanWhatsapp)
    ) {
      setFormError(
        'Ingresa un número de WhatsApp válido (solo dígitos, ej: +56987654321).'
      );
      return;
    }

    const syncedChecklist: ReservationChecklist = {
      ...checklist,
      depositReceived:
        status === 'confirmed' ? true : status === 'blocked' ? false : checklist.depositReceived,
    };

    const payload: ReservationInput = {
      cabin,
      status,
      checkIn,
      checkOut,
      guestName: cleanName,
      guestDocument: cleanDocument,
      guestWhatsapp: cleanWhatsapp,
      channel: status === 'blocked' ? 'internal' : channel,
      nightlyRate: numericRate,
      nights,
      totalAmount,
      depositAmount,
      balanceAmount,
      checklist: status === 'blocked' ? emptyChecklist : syncedChecklist,
      notes: notes.trim().slice(0, MAX_NOTES_LEN),
      allowedEmails,
    };

    try {
      await onSave(payload, reservation?.id);
      onClose();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'No pudimos guardar la reserva. Intenta nuevamente.'
      );
    }
  };

  const renderDetailView = () => {
    if (!reservation) return null;
    const whatsappUrl = buildWhatsAppUrl(reservation.guestWhatsapp, reservation.guestName);

    return (
      <div className="space-y-5">
        {/* Header Summary */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#2B8A7E]">
              {CABINS[reservation.cabin].name} · {CHANNEL_META[reservation.channel]}
            </p>
            <h3 className="font-display text-2xl font-semibold text-[#3F2E26] mt-0.5">
              {reservation.guestName}
            </h3>
            <p className="text-xs font-medium text-[#3F2E26]/75 mt-1 flex items-center gap-1.5">
              {reservation.status === 'confirmed' && <Check className="w-3.5 h-3.5 text-[#2B8A7E]" />}
              {reservation.status === 'pending_deposit' && (
                <Clock className="w-3.5 h-3.5 text-[#F16E3F]" />
              )}
              {reservation.status === 'blocked' && <Wrench className="w-3.5 h-3.5 text-[#3F2E26]" />}
              <span>{STATUS_META[reservation.status].label}</span>
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar ficha"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-[#3F2E26]/70 hover:bg-[#D9C3A0]/40 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dates */}
        <div className="rounded-2xl bg-[#F5EBDD]/80 border border-[#3F2E26]/12 p-4 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] font-medium text-[#3F2E26]/65">Check-in (15:00 hrs)</p>
            <p className="text-sm font-semibold text-[#3F2E26] tabular-nums mt-0.5">
              {formatFullDateES(reservation.checkIn)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-[#3F2E26]/65">Check-out (12:00 hrs)</p>
            <p className="text-sm font-semibold text-[#3F2E26] tabular-nums mt-0.5">
              {formatFullDateES(reservation.checkOut)}
            </p>
          </div>
          <div className="col-span-2 pt-2 border-t border-[#3F2E26]/10 flex items-center justify-between text-xs text-[#3F2E26]/80">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#2B8A7E]" />
              Estadía total
            </span>
            <span className="font-semibold tabular-nums">
              {reservation.nights} {reservation.nights === 1 ? 'noche' : 'noches'}
            </span>
          </div>
        </div>

        {/* Guest Document & WhatsApp Direct Action */}
        {reservation.status !== 'blocked' && (
          <div className="rounded-2xl border border-[#3F2E26]/12 bg-[#FAF4EC] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[#3F2E26]/65">
                  RUT / DNI / Pasaporte
                </p>
                <p className="text-sm font-semibold text-[#3F2E26] tabular-nums truncate">
                  {reservation.guestDocument || 'Sin registrar'}
                </p>
              </div>
            </div>

            <div className="pt-2.5 border-t border-[#3F2E26]/10 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[#3F2E26]/65">WhatsApp del huésped</p>
                <p className="text-sm font-semibold text-[#3F2E26] tabular-nums truncate">
                  {reservation.guestWhatsapp || 'Sin número registrado'}
                </p>
              </div>
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#4EBBAD] text-[#173E39] text-xs font-bold flex items-center gap-1.5 hover:bg-[#3fa99b] transition-colors shrink-0 whitespace-nowrap"
                >
                  <MessageCircle className="w-4 h-4" />
                  Abrir WhatsApp
                </a>
              )}
            </div>
          </div>
        )}

        {/* Pricing Breakdown */}
        {reservation.status !== 'blocked' && (
          <div className="rounded-2xl bg-[#D9C3A0]/45 border border-[#3F2E26]/15 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-[#3F2E26]/80">
              <span>
                Tarifa ({formatCLP(reservation.nightlyRate)} × {reservation.nights}{' '}
                {reservation.nights === 1 ? 'noche' : 'noches'})
              </span>
              <span className="font-semibold text-[#3F2E26] tabular-nums">
                {formatCLP(reservation.totalAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-[#3F2E26]/80">
              <span>Abono 50%</span>
              <span className="font-semibold text-[#2B8A7E] tabular-nums">
                {formatCLP(reservation.depositAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm font-semibold text-[#3F2E26] pt-2 border-t border-[#3F2E26]/12">
              <span>Saldo 50% al llegar</span>
              <span className="tabular-nums">{formatCLP(reservation.balanceAmount)}</span>
            </div>
          </div>
        )}

        {/* Interactive Checklist */}
        {reservation.status !== 'blocked' && (
          <div>
            <h4 className="text-xs font-semibold text-[#3F2E26]/75 mb-2">
              Lista rápida de seguimiento
            </h4>
            <div className="divide-y divide-[#3F2E26]/10 rounded-2xl border border-[#3F2E26]/15 bg-[#FAF4EC] overflow-hidden">
              {CHECKLIST_ITEMS.map((item) => {
                const checked = reservation.checklist[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onToggleChecklist(reservation, item.key)}
                    className="w-full min-h-[48px] px-4 py-2.5 flex items-center gap-3 text-left hover:bg-[#F5EBDD]/60 transition-colors cursor-pointer"
                  >
                    {checked ? (
                      <CheckSquare className="w-5 h-5 text-[#2B8A7E] shrink-0" />
                    ) : (
                      <Square className="w-5 h-5 text-[#3F2E26]/40 shrink-0" />
                    )}
                    <span
                      className={`text-sm ${
                        checked ? 'text-[#3F2E26] font-semibold line-through opacity-75' : 'text-[#3F2E26] font-medium'
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Notes */}
        {reservation.notes && (
          <div className="rounded-2xl bg-[#F5EBDD]/65 border border-[#3F2E26]/12 p-3.5">
            <p className="text-[11px] font-semibold text-[#3F2E26]/65 mb-1">Notas</p>
            <p className="text-sm text-[#3F2E26] whitespace-pre-wrap">{reservation.notes}</p>
          </div>
        )}

        {/* Actions */}
        {!confirmDelete ? (
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setMode('form')}
              className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-[#F16E3F] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#d95b2e] transition-colors cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              Editar ficha
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="min-h-[48px] px-4 py-2.5 rounded-xl border border-[#3F2E26]/20 text-[#3F2E26] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#D9C3A0]/45 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#F16E3F]/12 border border-[#F16E3F]/35 p-4 space-y-3">
            <p className="text-sm font-semibold text-[#3F2E26]">
              ¿Seguro que quieres eliminar este registro de {CABINS[reservation.cabin].shortName}?
            </p>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  await onDelete(reservation);
                  onClose();
                }}
                className="flex-1 min-h-[44px] rounded-xl bg-[#F16E3F] text-white text-sm font-semibold hover:bg-[#d95b2e] transition-colors disabled:opacity-60 cursor-pointer"
              >
                {isSaving ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="flex-1 min-h-[44px] rounded-xl border border-[#3F2E26]/20 bg-[#FAF4EC] text-[#3F2E26] text-sm font-semibold hover:bg-[#D9C3A0]/40 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFormView = () => {
    const isBlock = status === 'blocked';

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-xl font-semibold text-[#3F2E26]">
            {reservation ? 'Editar registro' : 'Agendar fechas'}
          </h3>
          <button
            type="button"
            aria-label="Cerrar formulario"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-[#3F2E26]/70 hover:bg-[#D9C3A0]/40 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Reservation vs Block Segmented Switch */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#D9C3A0]/55 border border-[#3F2E26]/12">
          <button
            type="button"
            onClick={() => handleToggleType(false)}
            className={`min-h-[44px] rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
              !isBlock
                ? 'bg-[#3F2E26] text-[#F5EBDD]'
                : 'text-[#3F2E26]/80 hover:text-[#3F2E26]'
            }`}
          >
            Reserva huésped
          </button>
          <button
            type="button"
            onClick={() => handleToggleType(true)}
            className={`min-h-[44px] rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
              isBlock
                ? 'bg-[#3F2E26] text-[#F5EBDD]'
                : 'text-[#3F2E26]/80 hover:text-[#3F2E26]'
            }`}
          >
            Bloqueo / Mantención
          </button>
        </div>

        {/* Cabin Selector */}
        <div>
          <label className="block text-xs font-semibold text-[#3F2E26]/80 mb-1.5">
            Cabaña
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['colibri', 'chercan'] as CabinId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setCabin(id)}
                className={`min-h-[44px] px-3 py-2 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${
                  cabin === id
                    ? 'bg-[#4EBBAD]/25 border-[#2B8A7E] text-[#173E39]'
                    : 'bg-[#F5EBDD]/60 border-[#3F2E26]/15 text-[#3F2E26]/80'
                }`}
              >
                {CABINS[id].name}
              </button>
            ))}
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="checkInInput"
              className="block text-xs font-semibold text-[#3F2E26]/80 mb-1"
            >
              Check-in (15:00)
            </label>
            <input
              id="checkInInput"
              type="date"
              required
              value={checkIn}
              onChange={(e) => {
                const nextIn = e.target.value;
                setCheckIn(nextIn);
                if (nextIn && (!checkOut || checkOut <= nextIn)) {
                  setCheckOut(addDaysISO(nextIn, 1));
                }
              }}
              className="w-full min-h-[44px] px-3 rounded-xl border border-[#3F2E26]/20 bg-white text-sm text-[#3F2E26] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#4EBBAD]"
            />
          </div>
          <div>
            <label
              htmlFor="checkOutInput"
              className="block text-xs font-semibold text-[#3F2E26]/80 mb-1"
            >
              Check-out (12:00)
            </label>
            <input
              id="checkOutInput"
              type="date"
              required
              min={checkIn ? addDaysISO(checkIn, 1) : undefined}
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-[#3F2E26]/20 bg-white text-sm text-[#3F2E26] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#4EBBAD]"
            />
          </div>
        </div>

        {/* Live Overlap Alert */}
        {overlapping && (
          <div className="rounded-xl bg-[#F16E3F]/15 border border-[#F16E3F]/45 p-3 flex items-start gap-2.5 text-xs text-[#8A3010]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Ya existe ocupación en {CABINS[cabin].name}: <strong>{overlapping.guestName}</strong>{' '}
              ({overlapping.checkIn} al {overlapping.checkOut}). Cambia las fechas o la cabaña para
              evitar tope.
            </span>
          </div>
        )}

        {/* Status if guest reservation */}
        {!isBlock && (
          <div>
            <label className="block text-xs font-semibold text-[#3F2E26]/80 mb-1.5">
              Estado de la reserva
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('pending_deposit')}
                className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                  status === 'pending_deposit'
                    ? 'bg-[#F16E3F]/20 border-[#F16E3F] text-[#8A3010]'
                    : 'bg-[#F5EBDD]/60 border-[#3F2E26]/15 text-[#3F2E26]/75'
                }`}
              >
                <Clock className="w-4 h-4" />
                Pendiente de abono
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatus('confirmed');
                  setChecklist((prev) => ({ ...prev, depositReceived: true }));
                }}
                className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                  status === 'confirmed'
                    ? 'bg-[#4EBBAD]/30 border-[#2B8A7E] text-[#173E39]'
                    : 'bg-[#F5EBDD]/60 border-[#3F2E26]/15 text-[#3F2E26]/75'
                }`}
              >
                <Check className="w-4 h-4" />
                Confirmada
              </button>
            </div>
          </div>
        )}

        {/* Guest Name / Reason */}
        <div>
          <label
            htmlFor="guestNameInput"
            className="block text-xs font-semibold text-[#3F2E26]/80 mb-1"
          >
            {isBlock ? 'Motivo del bloqueo' : 'Nombre del huésped'}
          </label>
          <input
            id="guestNameInput"
            type="text"
            required
            maxLength={MAX_GUEST_NAME_LEN}
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder={isBlock ? 'Ej: Mantención terraza o uso familiar' : 'Ej: Camila Rojas'}
            className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#3F2E26]/20 bg-white text-sm text-[#3F2E26] focus:outline-none focus:ring-2 focus:ring-[#4EBBAD]"
          />
        </div>

        {/* Guest Document (RUT / DNI / Pasaporte) */}
        {!isBlock && (
          <div>
            <label
              htmlFor="guestDocumentInput"
              className="block text-xs font-semibold text-[#3F2E26]/80 mb-1"
            >
              RUT / DNI / Pasaporte
            </label>
            <input
              id="guestDocumentInput"
              type="text"
              maxLength={MAX_DOCUMENT_LEN}
              value={guestDocument}
              onChange={(e) => setGuestDocument(e.target.value)}
              placeholder="Ej: 12.345.678-9 o Pasaporte"
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#3F2E26]/20 bg-white text-sm text-[#3F2E26] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#4EBBAD]"
            />
          </div>
        )}

        {/* WhatsApp + Channel */}
        {!isBlock && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="whatsappInput"
                className="block text-xs font-semibold text-[#3F2E26]/80 mb-1"
              >
                WhatsApp (solo números)
              </label>
              <input
                id="whatsappInput"
                type="tel"
                inputMode="tel"
                maxLength={16}
                value={guestWhatsapp}
                onChange={(e) => {
                  const sanitized = e.target.value
                    .replace(/[^\d+]/g, '')
                    .replace(/(?!^)\+/g, '');
                  setGuestWhatsapp(sanitized);
                }}
                placeholder="+56987654321"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#3F2E26]/20 bg-white text-sm text-[#3F2E26] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#4EBBAD]"
              />
            </div>

            <div>
              <label
                htmlFor="channelSelect"
                className="block text-xs font-semibold text-[#3F2E26]/80 mb-1"
              >
                Canal
              </label>
              <select
                id="channelSelect"
                value={channel}
                onChange={(e) => setChannel(e.target.value as BookingChannel)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-[#3F2E26]/20 bg-white text-sm text-[#3F2E26] focus:outline-none focus:ring-2 focus:ring-[#4EBBAD]"
              >
                <option value="whatsapp">Directo WhatsApp</option>
                <option value="airbnb">Airbnb</option>
                <option value="other">Otro</option>
              </select>
            </div>
          </div>
        )}

        {/* Nightly Rate & Live CLP Summary */}
        {!isBlock && (
          <div className="rounded-2xl bg-[#D9C3A0]/45 border border-[#3F2E26]/15 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="rateInput"
                className="text-xs font-semibold text-[#3F2E26]"
              >
                Tarifa por noche (CLP)
              </label>
              <div className="relative w-36">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#3F2E26]/65">
                  $
                </span>
                <input
                  id="rateInput"
                  type="number"
                  min={0}
                  max={5000000}
                  step={1000}
                  value={nightlyRateStr}
                  onChange={(e) => setNightlyRateStr(e.target.value)}
                  className="w-full min-h-[44px] pl-7 pr-3 rounded-xl border border-[#3F2E26]/20 bg-white text-sm font-semibold text-right text-[#3F2E26] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#4EBBAD]"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-[#3F2E26]/12 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[11px] text-[#3F2E26]/70">
                  Total ({nights} {nights === 1 ? 'noche' : 'noches'})
                </p>
                <p className="text-sm font-bold text-[#3F2E26] tabular-nums">
                  {formatCLP(totalAmount)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#3F2E26]/70">Abono 50%</p>
                <p className="text-sm font-bold text-[#2B8A7E] tabular-nums">
                  {formatCLP(depositAmount)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#3F2E26]/70">Saldo al llegar</p>
                <p className="text-sm font-bold text-[#3F2E26] tabular-nums">
                  {formatCLP(balanceAmount)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label
            htmlFor="notesInput"
            className="block text-xs font-semibold text-[#3F2E26]/80 mb-1"
          >
            Notas breves
          </label>
          <textarea
            id="notesInput"
            rows={2}
            maxLength={MAX_NOTES_LEN}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: Llega a las 17:00 hrs, pide tinaja o cama matrimonial armada."
            className="w-full p-3 rounded-xl border border-[#3F2E26]/20 bg-white text-sm text-[#3F2E26] focus:outline-none focus:ring-2 focus:ring-[#4EBBAD]"
          />
        </div>

        {formError && (
          <div className="rounded-xl bg-[#F16E3F]/15 border border-[#F16E3F]/40 p-3 text-xs font-medium text-[#8A3010]">
            {formError}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          {reservation && (
            <button
              type="button"
              onClick={() => setMode('detail')}
              className="min-h-[48px] px-4 rounded-xl border border-[#3F2E26]/20 bg-[#FAF4EC] text-sm font-semibold text-[#3F2E26] hover:bg-[#D9C3A0]/40 cursor-pointer"
            >
              Volver
            </button>
          )}
          <button
            type="submit"
            disabled={isSaving || !!overlapping}
            className="flex-1 min-h-[48px] px-5 py-3 rounded-xl bg-[#F16E3F] text-white text-sm font-semibold hover:bg-[#d95b2e] transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSaving
              ? 'Guardando...'
              : reservation
              ? 'Guardar cambios'
              : isBlock
              ? 'Guardar bloqueo'
              : 'Guardar reserva'}
          </button>
        </div>
      </form>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#3F2E26]/55 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-[#FAF4EC] border border-[#3F2E26]/15 p-5 sm:p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-[#3F2E26]/20 rounded-full mx-auto mb-3 sm:hidden" />
        {mode === 'detail' ? renderDetailView() : renderFormView()}
      </div>
    </div>
  );
};
