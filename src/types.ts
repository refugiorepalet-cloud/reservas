export type CabinId = 'colibri' | 'chercan';
export type CabinFilter = 'all' | CabinId;
export type ReservationStatus = 'confirmed' | 'pending_deposit' | 'blocked';
export type BookingChannel = 'whatsapp' | 'airbnb' | 'other' | 'internal';

export interface ReservationChecklist {
  depositReceived: boolean;
  balancePaid: boolean;
  idRegistered: boolean;
  keysHandled: boolean;
}

export interface Reservation {
  id: string;
  cabin: CabinId;
  status: ReservationStatus;
  checkIn: string; // YYYY-MM-DD (15:00 hrs)
  checkOut: string; // YYYY-MM-DD (12:00 hrs)
  guestName: string;
  guestDocument: string;
  guestWhatsapp: string;
  channel: BookingChannel;
  nightlyRate: number;
  nights: number;
  totalAmount: number;
  depositAmount: number;
  balanceAmount: number;
  checklist: ReservationChecklist;
  notes: string;
  allowedEmails: string[];
  createdBy: string;
  createdAt?: unknown;
  updatedBy: string;
  updatedAt?: unknown;
}

export type ReservationInput = Omit<
  Reservation,
  'id' | 'createdBy' | 'createdAt' | 'updatedBy' | 'updatedAt'
>;

export const BOOTSTRAP_HOST_EMAIL = 'claudiocrog@gmail.com';
export const DEFAULT_NIGHTLY_RATE = 65000;
export const MAX_GUEST_NAME_LEN = 100;
export const MAX_DOCUMENT_LEN = 30;
export const MAX_WHATSAPP_LEN = 30;
export const MAX_NOTES_LEN = 1000;

export const CABINS: Record<
  CabinId,
  { id: CabinId; name: string; shortName: string; subtitle: string }
> = {
  colibri: {
    id: 'colibri',
    name: 'Cabaña Colibrí',
    shortName: 'Colibrí',
    subtitle: 'Parejas · Vista bosque costero',
  },
  chercan: {
    id: 'chercan',
    name: 'Cabaña Chercán',
    shortName: 'Chercán',
    subtitle: 'Parejas · Brisa de Horcón',
  },
};

export const STATUS_META: Record<
  ReservationStatus,
  { label: string; shortLabel: string }
> = {
  confirmed: {
    label: 'Confirmada',
    shortLabel: 'Confirmada',
  },
  pending_deposit: {
    label: 'Pendiente de abono',
    shortLabel: 'Pendiente',
  },
  blocked: {
    label: 'Bloqueo / Mantención',
    shortLabel: 'Bloqueo',
  },
};

export const CHANNEL_META: Record<BookingChannel, string> = {
  whatsapp: 'Directo WhatsApp',
  airbnb: 'Airbnb',
  other: 'Otro',
  internal: 'Uso interno',
};

export const CHECKLIST_ITEMS: Array<{
  key: keyof ReservationChecklist;
  label: string;
}> = [
  { key: 'depositReceived', label: 'Abono 50% recibido' },
  { key: 'balancePaid', label: 'Saldo 50% pagado' },
  { key: 'idRegistered', label: 'Cédula/pasaporte registrado' },
  { key: 'keysHandled', label: 'Llaves entregadas/devueltas' },
];
