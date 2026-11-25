/**
 * Dirty Dozen Security Test Matrix for Refugio Repalet Firestore Rules.
 * Documents adversarial payloads expected to return PERMISSION_DENIED.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated List on reservations',
    operation: 'list',
    path: 'reservations',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Stranger Verified User List on reservations',
    operation: 'list',
    path: 'reservations',
    auth: { uid: 'stranger-1', email: 'stranger@gmail.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Email Spoofing with email_verified=false',
    operation: 'create',
    path: 'reservations/res_spoof_1',
    auth: { uid: 'spoof-1', email: 'claudiocrog@gmail.com', email_verified: false },
    payload: { cabin: 'colibri', status: 'confirmed' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Path ID Poisoning',
    operation: 'create',
    path: 'reservations/invalid.id.with.dots',
    auth: { uid: 'claudio-1', email: 'claudiocrog@gmail.com', email_verified: true },
    payload: { cabin: 'colibri' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow Ghost Field Injection',
    operation: 'create',
    path: 'reservations/res_ghost_1',
    auth: { uid: 'claudio-1', email: 'claudiocrog@gmail.com', email_verified: true },
    payload: {
      cabin: 'colibri',
      status: 'confirmed',
      checkIn: '2026-12-01',
      checkOut: '2026-12-03',
      guestName: 'Test',
      guestWhatsapp: '+56912345678',
      channel: 'whatsapp',
      nightlyRate: 65000,
      nights: 2,
      totalAmount: 130000,
      depositAmount: 65000,
      balanceAmount: 65000,
      checklist: { depositReceived: false, balancePaid: false, idRegistered: false, keysHandled: false },
      notes: '',
      allowedEmails: ['claudiocrog@gmail.com'],
      createdBy: 'claudio-1',
      updatedBy: 'claudio-1',
      isAdmin: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Missing Required Checklist Field',
    operation: 'create',
    path: 'reservations/res_missing_1',
    auth: { uid: 'claudio-1', email: 'claudiocrog@gmail.com', email_verified: true },
    payload: {
      cabin: 'colibri',
      status: 'confirmed',
      checkIn: '2026-12-01',
      checkOut: '2026-12-03',
      guestName: 'Test',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Invalid CheckOut <= CheckIn',
    operation: 'create',
    path: 'reservations/res_dates_1',
    auth: { uid: 'claudio-1', email: 'claudiocrog@gmail.com', email_verified: true },
    payload: {
      cabin: 'colibri',
      status: 'confirmed',
      checkIn: '2026-12-05',
      checkOut: '2026-12-03',
      guestName: 'Test',
      guestWhatsapp: '',
      channel: 'whatsapp',
      nightlyRate: 65000,
      nights: 2,
      totalAmount: 130000,
      depositAmount: 65000,
      balanceAmount: 65000,
      checklist: { depositReceived: false, balancePaid: false, idRegistered: false, keysHandled: false },
      notes: '',
      allowedEmails: ['claudiocrog@gmail.com'],
      createdBy: 'claudio-1',
      updatedBy: 'claudio-1',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Oversized Notes > 1000 chars',
    operation: 'create',
    path: 'reservations/res_big_notes',
    auth: { uid: 'claudio-1', email: 'claudiocrog@gmail.com', email_verified: true },
    payload: {
      notes: 'x'.repeat(1200),
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Client Timestamp Tampering on Create',
    operation: 'create',
    path: 'reservations/res_time_tamper',
    auth: { uid: 'claudio-1', email: 'claudiocrog@gmail.com', email_verified: true },
    payload: {
      createdAt: '2020-01-01T00:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Immutable createdBy Mutation on Update',
    operation: 'update',
    path: 'reservations/res_1',
    auth: { uid: 'claudio-1', email: 'claudiocrog@gmail.com', email_verified: true },
    payload: {
      createdBy: 'attacker-uid',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Removing Bootstrap Owner from /access/hosts',
    operation: 'update',
    path: 'access/hosts',
    auth: { uid: 'georgina-1', email: 'georgina@gmail.com', email_verified: true },
    payload: {
      emails: ['georgina@gmail.com'],
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Blanket List on /access collection',
    operation: 'list',
    path: 'access',
    auth: { uid: 'claudio-1', email: 'claudiocrog@gmail.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
];
