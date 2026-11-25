import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  BarChart3,
  CalendarDays,
  FolderSync,
  LogOut,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testConnection,
} from './firebase';
import {
  BOOTSTRAP_HOST_EMAIL,
  CABINS,
  CabinFilter,
  CabinId,
  Reservation,
  ReservationChecklist,
  ReservationInput,
} from './types';
import {
  findOverlappingReservation,
  formatCLP,
  formatDateISO,
  formatShortDateES,
  getMonthlyStats,
  MONTHS_ES,
} from './utils/dateUtils';
import { LoginScreen } from './components/LoginScreen';
import { CalendarView } from './components/CalendarView';
import { ReservationModal } from './components/ReservationModal';
import { MonthlySummaryView } from './components/MonthlySummaryView';
import { BackupAndTeamView } from './components/BackupAndTeamView';
import { PublicAvailabilityView } from './components/PublicAvailabilityView';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';

type AppTab = 'calendar' | 'summary' | 'backup';

function generateReservationDocId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `res_${Date.now()}_${rand}`;
}

function buildPublicRanges(list: Reservation[]) {
  const toRanges = (cabin: CabinId) =>
    list
      .filter((r) => r.cabin === cabin && r.checkIn && r.checkOut && r.checkOut > r.checkIn)
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
      .slice(0, 250)
      .map((r) => `${r.checkIn}/${r.checkOut}`);
  return {
    colibri: toRanges('colibri'),
    chercan: toRanges('chercan'),
  };
}

export default function App() {
  const isPublicView = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('vista') === 'disponibilidad';
  }, []);

  if (isPublicView) {
    return <PublicAvailabilityView />;
  }

  return <AdminApp />;
}

function AdminApp() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [accessChecked, setAccessChecked] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [allowedEmails, setAllowedEmails] = useState<string[]>([BOOTSTRAP_HOST_EMAIL]);

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const now = useMemo(() => new Date(), []);
  const [activeTab, setActiveTab] = useState<AppTab>('calendar');
  const [viewYear, setViewYear] = useState<number>(now.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(now.getMonth());
  const [cabinFilter, setCabinFilter] = useState<CabinFilter>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'detail' | 'form'>('form');
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [prefillCabin, setPrefillCabin] = useState<CabinId>('colibri');
  const [prefillCheckIn, setPrefillCheckIn] = useState<string>(formatDateISO(now));
  const [isSaving, setIsSaving] = useState(false);

  const userEmail = (user?.email || '').trim().toLowerCase();
  const isBootstrapHost = Boolean(
    user?.emailVerified && userEmail === BOOTSTRAP_HOST_EMAIL
  );

  // Startup connection check
  useEffect(() => {
    void testConnection();
  }, []);

  // Auth state listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      setAuthError(null);
      if (!nextUser) {
        setAccessChecked(false);
        setIsAuthorized(false);
        setReservations([]);
        setAllowedEmails([BOOTSTRAP_HOST_EMAIL]);
      }
    });
    return () => unsub();
  }, []);

  // Whitelist verification listener (/access/hosts)
  useEffect(() => {
    if (!authReady || !user) return;
    if (!user.emailVerified || !userEmail) {
      setIsAuthorized(false);
      setAccessChecked(true);
      return;
    }

    const hostsRef = doc(db, 'access', 'hosts');
    const unsub = onSnapshot(
      hostsRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const list = Array.isArray(data?.emails)
            ? data.emails
                .filter((e): e is string => typeof e === 'string')
                .map((e) => e.toLowerCase())
            : [BOOTSTRAP_HOST_EMAIL];
          const normalized = Array.from(new Set([BOOTSTRAP_HOST_EMAIL, ...list]));
          setAllowedEmails(normalized);
          setIsAuthorized(normalized.includes(userEmail));
          setAccessChecked(true);
        } else {
          // Initialize /access/hosts if bootstrap host signs in for the first time
          if (userEmail === BOOTSTRAP_HOST_EMAIL) {
            setAllowedEmails([BOOTSTRAP_HOST_EMAIL]);
            setIsAuthorized(true);
            setAccessChecked(true);
            setDoc(hostsRef, {
              emails: [BOOTSTRAP_HOST_EMAIL],
              updatedAt: serverTimestamp(),
              updatedBy: user.uid,
            }).catch((err) => {
              handleFirestoreError(err, OperationType.CREATE, 'access/hosts');
            });
          } else {
            setIsAuthorized(false);
            setAccessChecked(true);
          }
        }
      },
      (err) => {
        // Permission denied means user email is NOT in whitelist
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('Missing or insufficient permissions') ||
          msg.includes('permission-denied')
        ) {
          setIsAuthorized(false);
          setAccessChecked(true);
        } else {
          handleFirestoreError(err, OperationType.GET, 'access/hosts');
        }
      }
    );

    return () => unsub();
  }, [authReady, user, userEmail]);

  // Real-time reservations listener (only when authorized)
  useEffect(() => {
    if (!authReady || !user || !isAuthorized || !userEmail) return;

    setLoadingData(true);
    const q = query(
      collection(db, 'reservations'),
      where('allowedEmails', 'array-contains', userEmail)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items: Reservation[] = snapshot.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            cabin: raw.cabin === 'chercan' ? 'chercan' : 'colibri',
            status:
              raw.status === 'confirmed' ||
              raw.status === 'pending_deposit' ||
              raw.status === 'blocked'
                ? raw.status
                : 'pending_deposit',
            checkIn: String(raw.checkIn || ''),
            checkOut: String(raw.checkOut || ''),
            guestName: String(raw.guestName || ''),
            guestWhatsapp: String(raw.guestWhatsapp || ''),
            channel:
              raw.channel === 'airbnb' ||
              raw.channel === 'other' ||
              raw.channel === 'internal'
                ? raw.channel
                : 'whatsapp',
            nightlyRate: Number(raw.nightlyRate) || 0,
            nights: Number(raw.nights) || 1,
            totalAmount: Number(raw.totalAmount) || 0,
            depositAmount: Number(raw.depositAmount) || 0,
            balanceAmount: Number(raw.balanceAmount) || 0,
            checklist: {
              depositReceived: Boolean(raw.checklist?.depositReceived),
              balancePaid: Boolean(raw.checklist?.balancePaid),
              idRegistered: Boolean(raw.checklist?.idRegistered),
              keysHandled: Boolean(raw.checklist?.keysHandled),
            },
            notes: String(raw.notes || ''),
            allowedEmails: Array.isArray(raw.allowedEmails)
              ? raw.allowedEmails
              : [BOOTSTRAP_HOST_EMAIL],
            createdBy: String(raw.createdBy || ''),
            createdAt: raw.createdAt,
            updatedBy: String(raw.updatedBy || ''),
            updatedAt: raw.updatedAt,
          };
        });
        items.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
        setReservations(items);
        setLoadingData(false);

        // Keep /public/availability synced automatically if missing or out-of-date
        const desired = buildPublicRanges(items);
        const pubRef = doc(db, 'public', 'availability');
        getDoc(pubRef)
          .then((pubSnap) => {
            const cur = pubSnap.exists() ? pubSnap.data() : null;
            const curKey = cur
              ? JSON.stringify({ colibri: cur.colibri || [], chercan: cur.chercan || [] })
              : '';
            const nextKey = JSON.stringify(desired);
            if (!pubSnap.exists() || curKey !== nextKey) {
              setDoc(pubRef, {
                ...desired,
                updatedAt: serverTimestamp(),
                updatedBy: user.uid,
              }).catch((syncErr) => {
                handleFirestoreError(syncErr, OperationType.WRITE, 'public/availability');
              });
            }
          })
          .catch(() => {
            // Ignore read check errors; mutation batches also keep it synced
          });
      },
      (err) => {
        setLoadingData(false);
        handleFirestoreError(err, OperationType.LIST, 'reservations');
      }
    );

    return () => unsub();
  }, [authReady, user, isAuthorized, userEmail]);

  const selectedReservation = useMemo(
    () => reservations.find((r) => r.id === selectedReservationId) || null,
    [reservations, selectedReservationId]
  );

  const monthStats = useMemo(
    () => getMonthlyStats(reservations, viewYear, viewMonth),
    [reservations, viewYear, viewMonth]
  );

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError('No pudimos completar el inicio de sesión con Google. Intenta de nuevo.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleSaveReservation = async (
    data: ReservationInput,
    existingId?: string
  ) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const syncedAllowed = Array.from(
        new Set([BOOTSTRAP_HOST_EMAIL, ...allowedEmails])
      ).slice(0, 5);

      const batch = writeBatch(db);
      let nextList: Reservation[];

      if (existingId) {
        const ref = doc(db, 'reservations', existingId);
        batch.update(ref, {
          ...data,
          allowedEmails: syncedAllowed,
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
        nextList = reservations.map((r) =>
          r.id === existingId ? { ...r, ...data, allowedEmails: syncedAllowed } : r
        );
      } else {
        const newId = generateReservationDocId();
        const ref = doc(db, 'reservations', newId);
        batch.set(ref, {
          ...data,
          allowedEmails: syncedAllowed,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
        nextList = [
          ...reservations,
          {
            ...data,
            id: newId,
            allowedEmails: syncedAllowed,
            createdBy: user.uid,
            updatedBy: user.uid,
          },
        ];
      }

      const publicRanges = buildPublicRanges(nextList);
      batch.set(doc(db, 'public', 'availability'), {
        ...publicRanges,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });

      await batch.commit();
    } catch (err) {
      handleFirestoreError(
        err,
        existingId ? OperationType.UPDATE : OperationType.CREATE,
        existingId ? `reservations/${existingId}` : 'reservations'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleChecklist = async (
    res: Reservation,
    key: keyof ReservationChecklist
  ) => {
    if (!user) return;
    const nextChecklist: ReservationChecklist = {
      ...res.checklist,
      [key]: !res.checklist[key],
    };
    try {
      await updateDoc(doc(db, 'reservations', res.id), {
        checklist: nextChecklist,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reservations/${res.id}`);
    }
  };

  const handleDeleteReservation = async (res: Reservation) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'reservations', res.id));
      const nextList = reservations.filter((r) => r.id !== res.id);
      batch.set(doc(db, 'public', 'availability'), {
        ...buildPublicRanges(nextList),
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `reservations/${res.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const syncAllowedEmailsAcrossDocs = async (nextEmails: string[]) => {
    if (!user) return;
    const cleaned = Array.from(new Set([BOOTSTRAP_HOST_EMAIL, ...nextEmails])).slice(0, 5);
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'access', 'hosts'), {
        emails: cleaned,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });
      for (const res of reservations) {
        batch.update(doc(db, 'reservations', res.id), {
          allowedEmails: cleaned,
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'access/hosts');
    }
  };

  const handleAddHostEmail = async (email: string) => {
    await syncAllowedEmailsAcrossDocs([...allowedEmails, email.toLowerCase()]);
  };

  const handleRemoveHostEmail = async (email: string) => {
    const filtered = allowedEmails.filter((e) => e !== email.toLowerCase());
    await syncAllowedEmailsAcrossDocs(filtered);
  };

  const handleImportReservations = async (
    items: ReservationInput[],
    mode: 'merge' | 'replace'
  ) => {
    if (!user) return { imported: 0, skippedConflicts: 0 };
    const syncedAllowed = Array.from(
      new Set([BOOTSTRAP_HOST_EMAIL, ...allowedEmails])
    ).slice(0, 5);

    try {
      const batch = writeBatch(db);
      const workingList: Reservation[] = mode === 'replace' ? [] : [...reservations];

      if (mode === 'replace') {
        for (const existing of reservations) {
          batch.delete(doc(db, 'reservations', existing.id));
        }
      }

      let imported = 0;
      let skippedConflicts = 0;

      for (const item of items) {
        const conflict = findOverlappingReservation(
          workingList,
          item.cabin,
          item.checkIn,
          item.checkOut
        );
        if (conflict) {
          skippedConflicts++;
          continue;
        }
        const docId = generateReservationDocId();
        const ref = doc(db, 'reservations', docId);
        const docData = {
          ...item,
          allowedEmails: syncedAllowed,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        };
        batch.set(ref, docData);
        workingList.push({
          ...item,
          id: docId,
          allowedEmails: syncedAllowed,
          createdBy: user.uid,
          updatedBy: user.uid,
        });
        imported++;
      }

      batch.set(doc(db, 'public', 'availability'), {
        ...buildPublicRanges(workingList),
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });

      await batch.commit();
      return { imported, skippedConflicts };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'reservations');
    }
  };

  // Loading Splash
  if (!authReady || (user && !accessChecked)) {
    return (
      <div className="min-h-screen bg-[#F5EBDD] text-[#3F2E26] flex flex-col items-center justify-center p-6">
        <img
          src={`${import.meta.env.BASE_URL}assets/aistudio/logo_transp_45a8aadc.png`}
          alt="Refugio Repalet"
          className="w-16 h-16 rounded-2xl p-1 object-contain mb-4"
        />
        <p className="font-display text-xl font-semibold">Refugio Repalet</p>
        <p className="text-xs text-[#3F2E26]/70 mt-1">Sincronizando acceso...</p>
      </div>
    );
  }

  // Unauthenticated or Unauthorized Screen
  if (!user) {
    return (
      <>
        <LoginScreen
          mode="unauthenticated"
          authError={authError}
          isSigningIn={isSigningIn}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
        />
        <OfflineIndicator />
      </>
    );
  }

  if (!isAuthorized) {
    return (
      <>
        <LoginScreen
          mode="unauthorized"
          userEmail={user.email}
          isSigningIn={false}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
        />
        <OfflineIndicator />
      </>
    );
  }

  const openNewReservation = (cabin: CabinId, checkInIso: string) => {
    setSelectedReservationId(null);
    setPrefillCabin(cabin);
    setPrefillCheckIn(checkInIso);
    setModalMode('form');
    setModalOpen(true);
  };

  const openReservationDetail = (res: Reservation) => {
    setSelectedReservationId(res.id);
    setModalMode('detail');
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#F5EBDD] text-[#3F2E26] flex flex-col pb-20 md:pb-8">
      {/* Compact Sticky Top Bar (3-zone contract) */}
      <header className="sticky top-0 z-30 h-14 bg-[#FAF4EC]/90 backdrop-blur-md border-b border-[#3F2E26]/12">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4 md:gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className="font-display text-lg sm:text-xl font-bold text-[#3F2E26] whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2.5"
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/aistudio/logo_transp_45a8aadc.png`}
              alt=""
              className="w-8 h-8 rounded-lg object-contain shrink-0"
            />
            <span>Refugio Repalet</span>
          </button>

          {/* Zone 2: Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {(
              [
                { id: 'calendar', label: 'Calendario' },
                { id: 'summary', label: 'Resumen del mes' },
                { id: 'backup', label: 'Respaldo y equipo' },
              ] as Array<{ id: AppTab; label: string }>
            ).map((nav) => (
              <button
                key={nav.id}
                type="button"
                onClick={() => setActiveTab(nav.id)}
                className={`min-h-[44px] px-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === nav.id
                    ? 'border-[#F16E3F] text-[#3F2E26] font-semibold'
                    : 'border-transparent text-[#3F2E26]/70 hover:text-[#3F2E26]'
                }`}
              >
                {nav.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Quick Sign-out + Install */}
          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton variant="compact" />
            <button
              type="button"
              onClick={handleSignOut}
              title={`Cerrar sesión (${user.email})`}
              className="min-h-[44px] px-3 rounded-xl border border-[#3F2E26]/15 bg-[#F5EBDD]/80 text-xs font-semibold text-[#3F2E26] flex items-center gap-1.5 hover:bg-[#D9C3A0]/50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-[#3F2E26]/80" />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5 sm:pt-7">
        {loadingData && reservations.length === 0 ? (
          <div className="rounded-3xl bg-[#FAF4EC] border border-[#3F2E26]/15 p-10 text-center text-sm text-[#3F2E26]/70">
            Cargando calendario de Refugio Repalet...
          </div>
        ) : (
          <>
            {activeTab === 'calendar' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-8">
                  <CalendarView
                    year={viewYear}
                    monthIndex={viewMonth}
                    cabinFilter={cabinFilter}
                    reservations={reservations}
                    onChangeMonth={(y, m) => {
                      setViewYear(y);
                      setViewMonth(m);
                    }}
                    onChangeCabinFilter={setCabinFilter}
                    onSelectFreeDate={openNewReservation}
                    onSelectReservation={openReservationDetail}
                  />
                </div>

                {/* Desktop Side Panel: Quick Month Snapshot & Upcoming Stays */}
                <aside className="lg:col-span-4 space-y-4">
                  <div className="rounded-3xl bg-[#D9C3A0]/55 border border-[#3F2E26]/15 p-5 space-y-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <h2 className="font-display text-lg font-semibold text-[#3F2E26]">
                        {MONTHS_ES[viewMonth]} en cifras
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveTab('summary')}
                        className="text-xs font-semibold text-[#2B8A7E] hover:underline whitespace-nowrap cursor-pointer"
                      >
                        Ver detalle
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-[#FAF4EC] p-3 border border-[#3F2E26]/10">
                        <p className="text-[11px] text-[#3F2E26]/70">Colibrí</p>
                        <p className="text-lg font-bold text-[#3F2E26] tabular-nums">
                          {monthStats.colibri.occupiedNights}/{monthStats.daysInMonth}
                        </p>
                        <p className="text-[11px] text-[#2B8A7E] font-medium tabular-nums">
                          {monthStats.colibri.freeNights} libres
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[#FAF4EC] p-3 border border-[#3F2E26]/10">
                        <p className="text-[11px] text-[#3F2E26]/70">Chercán</p>
                        <p className="text-lg font-bold text-[#3F2E26] tabular-nums">
                          {monthStats.chercan.occupiedNights}/{monthStats.daysInMonth}
                        </p>
                        <p className="text-[11px] text-[#2B8A7E] font-medium tabular-nums">
                          {monthStats.chercan.freeNights} libres
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#3F2E26]/12 flex items-baseline justify-between">
                      <span className="text-xs font-medium text-[#3F2E26]/75">
                        Estimado del mes
                      </span>
                      <span className="font-display text-xl font-bold text-[#3F2E26] tabular-nums">
                        {formatCLP(monthStats.estimatedMonthRevenue)}
                      </span>
                    </div>
                  </div>

                  {/* Quick Upcoming List */}
                  <div className="rounded-3xl bg-[#FAF4EC] border border-[#3F2E26]/15 overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[#3F2E26]/10">
                      <h3 className="font-display text-base font-semibold text-[#3F2E26]">
                        Estadías del mes
                      </h3>
                    </div>
                    {monthStats.monthReservations.length === 0 ? (
                      <p className="p-5 text-xs text-[#3F2E26]/65">
                        Sin reservas para este mes. Toca cualquier día libre del calendario para
                        agendar.
                      </p>
                    ) : (
                      <div className="divide-y divide-[#3F2E26]/10 max-h-[360px] overflow-y-auto">
                        {monthStats.monthReservations.map((res) => (
                          <button
                            key={res.id}
                            type="button"
                            onClick={() => openReservationDetail(res)}
                            className="w-full min-h-[56px] px-4 py-3 flex items-center justify-between gap-2 text-left hover:bg-[#F5EBDD]/60 transition-colors cursor-pointer"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[#3F2E26] truncate">
                                {res.guestName}
                              </p>
                              <p className="text-xs text-[#3F2E26]/70 tabular-nums">
                                {CABINS[res.cabin].shortName} · {formatShortDateES(res.checkIn)} –{' '}
                                {formatShortDateES(res.checkOut)}
                              </p>
                            </div>
                            <span className="text-xs font-semibold text-[#2B8A7E] shrink-0 tabular-nums">
                              {res.status === 'blocked'
                                ? 'Bloqueo'
                                : formatCLP(res.totalAmount)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </aside>
              </div>
            )}

            {activeTab === 'summary' && (
              <div className="max-w-4xl mx-auto">
                <MonthlySummaryView
                  year={viewYear}
                  monthIndex={viewMonth}
                  reservations={reservations}
                  onChangeMonth={(y, m) => {
                    setViewYear(y);
                    setViewMonth(m);
                  }}
                  onSelectReservation={openReservationDetail}
                />
              </div>
            )}

            {activeTab === 'backup' && (
              <div className="max-w-3xl mx-auto">
                <BackupAndTeamView
                  reservations={reservations}
                  allowedEmails={allowedEmails}
                  currentUserEmail={userEmail}
                  isBootstrapHost={isBootstrapHost}
                  onAddHostEmail={handleAddHostEmail}
                  onRemoveHostEmail={handleRemoveHostEmail}
                  onImportReservations={handleImportReservations}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Thumb Zone) */}
      <nav
        aria-label="Navegación principal"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#FAF4EC]/95 backdrop-blur-md border-t border-[#3F2E26]/12 pb-safe"
      >
        <div className="grid grid-cols-3 h-16 items-center">
          {(
            [
              { id: 'calendar', label: 'Calendario', icon: CalendarDays },
              { id: 'summary', label: 'Resumen', icon: BarChart3 },
              { id: 'backup', label: 'Respaldo', icon: FolderSync },
            ] as Array<{
              id: AppTab;
              label: string;
              icon: React.ComponentType<{ className?: string }>;
            }>
          ).map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                  active ? 'text-[#F16E3F]' : 'text-[#3F2E26]/65 hover:text-[#3F2E26]'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-semibold tracking-tight">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Detail / Form Modal */}
      <ReservationModal
        isOpen={modalOpen}
        initialMode={modalMode}
        reservation={selectedReservation}
        prefillCabin={prefillCabin}
        prefillCheckIn={prefillCheckIn}
        reservations={reservations}
        allowedEmails={allowedEmails}
        isSaving={isSaving}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveReservation}
        onToggleChecklist={handleToggleChecklist}
        onDelete={handleDeleteReservation}
      />

      <OfflineIndicator />
    </div>
  );
}
