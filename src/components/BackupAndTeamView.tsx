import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Globe,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  BOOTSTRAP_HOST_EMAIL,
  CABINS,
  CabinId,
  Reservation,
  ReservationInput,
} from '../types';
import { addDaysISO, formatDateISO } from '../utils/dateUtils';
import { PWAInstallButton } from './PWAInstallButton';

interface BackupAndTeamViewProps {
  reservations: Reservation[];
  allowedEmails: string[];
  currentUserEmail: string;
  isBootstrapHost: boolean;
  onAddHostEmail: (email: string) => Promise<void>;
  onRemoveHostEmail: (email: string) => Promise<void>;
  onImportReservations: (
    items: ReservationInput[],
    mode: 'merge' | 'replace'
  ) => Promise<{ imported: number; skippedConflicts: number }>;
}

interface ParsedBackup {
  items: ReservationInput[];
  fileName: string;
}

export const BackupAndTeamView: React.FC<BackupAndTeamViewProps> = ({
  reservations,
  allowedEmails,
  currentUserEmail,
  isBootstrapHost,
  onAddHostEmail,
  onRemoveHostEmail,
  onImportReservations,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newEmail, setNewEmail] = useState('');
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamMsg, setTeamMsg] = useState<string | null>(null);

  const [pendingImport, setPendingImport] = useState<ParsedBackup | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [copiedPublic, setCopiedPublic] = useState(false);
  const [copiedIframe, setCopiedIframe] = useState(false);
  const [copiedRestUrl, setCopiedRestUrl] = useState(false);

  const publicViewerUrl = useMemo(() => {
    const base = import.meta.env.BASE_URL || '/';
    if (typeof window === 'undefined') return `${base}?vista=disponibilidad`;
    return `${window.location.origin}${base}?vista=disponibilidad`;
  }, []);

  const iframeCode = useMemo(() => {
    const embedUrl = `${publicViewerUrl}&embed=1`;
    return `<iframe src="${embedUrl}" title="Disponibilidad Refugio Repalet" style="width:100%;min-height:620px;border:0;border-radius:20px;" loading="lazy"></iframe>`;
  }, [publicViewerUrl]);

  const liveFirestoreJsonUrl = useMemo(() => {
    return `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/public/availability?key=${firebaseConfig.apiKey}`;
  }, []);

  const publicAvailabilityPayload = useMemo(() => {
    const buildCabinData = (cabinId: CabinId) => {
      const cabinRes = reservations
        .filter((r) => r.cabin === cabinId)
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

      const occupiedDatesSet = new Set<string>();
      const occupiedRanges = cabinRes.map((r) => {
        let cursor = r.checkIn;
        let guard = 0;
        while (cursor < r.checkOut && guard < 400) {
          occupiedDatesSet.add(cursor);
          cursor = addDaysISO(cursor, 1);
          guard++;
        }
        return {
          checkIn: r.checkIn,
          checkOut: r.checkOut,
          status: 'occupied' as const,
        };
      });

      return {
        cabin: cabinId,
        name: CABINS[cabinId].name,
        occupiedDates: Array.from(occupiedDatesSet).sort(),
        occupiedRanges,
      };
    };

    return {
      property: 'Refugio Repalet',
      location: 'Horcón, Valparaíso, Chile',
      generatedAt: new Date().toISOString(),
      cabins: {
        colibri: buildCabinData('colibri'),
        chercan: buildCabinData('chercan'),
      },
    };
  }, [reservations]);

  const downloadJSON = (data: unknown, fileName: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportFull = () => {
    const today = formatDateISO(new Date());
    const cleanReservations = reservations.map((r) => ({
      id: r.id,
      cabin: r.cabin,
      status: r.status,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      guestName: r.guestName,
      guestWhatsapp: r.guestWhatsapp,
      channel: r.channel,
      nightlyRate: r.nightlyRate,
      nights: r.nights,
      totalAmount: r.totalAmount,
      depositAmount: r.depositAmount,
      balanceAmount: r.balanceAmount,
      checklist: r.checklist,
      notes: r.notes,
    }));
    downloadJSON(
      {
        schemaVersion: 1,
        property: 'Refugio Repalet',
        exportedAt: new Date().toISOString(),
        reservations: cleanReservations,
      },
      `refugio-repalet-respaldo-${today}.json`
    );
    setBackupMsg(`Respaldo completo descargado (${cleanReservations.length} registros).`);
  };

  const handleExportPublic = () => {
    const today = formatDateISO(new Date());
    downloadJSON(
      publicAvailabilityPayload,
      `refugio-repalet-disponibilidad-${today}.json`
    );
    setBackupMsg('Disponibilidad pública exportada sin datos personales de huéspedes.');
  };

  const handleCopyPublic = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(publicAvailabilityPayload, null, 2));
      setCopiedPublic(true);
      setTimeout(() => setCopiedPublic(false), 2000);
    } catch {
      setBackupMsg('No se pudo copiar al portapapeles; usa el botón Descargar.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBackupMsg(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const rawList = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.reservations)
        ? parsed.reservations
        : null;

      if (!rawList) {
        setBackupMsg('El archivo JSON no tiene una lista válida de reservas.');
        return;
      }

      const validItems: ReservationInput[] = [];
      for (const item of rawList) {
        if (
          !item ||
          (item.cabin !== 'colibri' && item.cabin !== 'chercan') ||
          typeof item.checkIn !== 'string' ||
          typeof item.checkOut !== 'string' ||
          item.checkOut <= item.checkIn
        ) {
          continue;
        }
        const status =
          item.status === 'confirmed' ||
          item.status === 'pending_deposit' ||
          item.status === 'blocked'
            ? item.status
            : 'pending_deposit';
        const channel =
          item.channel === 'whatsapp' ||
          item.channel === 'airbnb' ||
          item.channel === 'other' ||
          item.channel === 'internal'
            ? item.channel
            : status === 'blocked'
            ? 'internal'
            : 'whatsapp';

        const nightlyRate = Math.max(0, Number(item.nightlyRate) || 0);
        const nights = Math.max(1, Number(item.nights) || 1);
        const totalAmount = Math.max(0, Number(item.totalAmount) || nightlyRate * nights);
        const depositAmount = Math.max(
          0,
          Number(item.depositAmount) ?? Math.round(totalAmount * 0.5)
        );
        const balanceAmount = Math.max(0, Number(item.balanceAmount) ?? totalAmount - depositAmount);

        validItems.push({
          cabin: item.cabin,
          status,
          checkIn: item.checkIn.slice(0, 10),
          checkOut: item.checkOut.slice(0, 10),
          guestName: String(item.guestName || 'Huésped').slice(0, 100),
          guestWhatsapp: String(item.guestWhatsapp || '').slice(0, 30),
          channel,
          nightlyRate,
          nights,
          totalAmount,
          depositAmount,
          balanceAmount,
          checklist: {
            depositReceived: Boolean(item.checklist?.depositReceived),
            balancePaid: Boolean(item.checklist?.balancePaid),
            idRegistered: Boolean(item.checklist?.idRegistered),
            keysHandled: Boolean(item.checklist?.keysHandled),
          },
          notes: String(item.notes || '').slice(0, 1000),
          allowedEmails,
        });
      }

      if (validItems.length === 0) {
        setBackupMsg('No se encontraron registros válidos en el archivo seleccionado.');
        return;
      }

      setPendingImport({ items: validItems, fileName: file.name });
    } catch {
      setBackupMsg('No pudimos leer el archivo JSON. Verifica que no esté dañado.');
    }
  };

  const handleConfirmImport = async (mode: 'merge' | 'replace') => {
    if (!pendingImport) return;
    setImportBusy(true);
    try {
      const result = await onImportReservations(pendingImport.items, mode);
      setBackupMsg(
        `Importación lista: ${result.imported} ${
          result.imported === 1 ? 'registro guardado' : 'registros guardados'
        }${
          result.skippedConflicts > 0
            ? ` (${result.skippedConflicts} omitidos por tope de fechas)`
            : ''
        }.`
      );
      setPendingImport(null);
    } catch (err) {
      setBackupMsg(
        err instanceof Error ? err.message : 'Error al importar el respaldo.'
      );
    } finally {
      setImportBusy(false);
    }
  };

  const handleAddHost = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeamMsg(null);
    const cleaned = newEmail.trim().toLowerCase();
    if (!cleaned || !cleaned.includes('@') || !cleaned.includes('.')) {
      setTeamMsg('Ingresa un correo electrónico válido (ej: georgina@gmail.com).');
      return;
    }
    if (allowedEmails.includes(cleaned)) {
      setTeamMsg('Ese correo ya está autorizado.');
      return;
    }
    setTeamBusy(true);
    try {
      await onAddHostEmail(cleaned);
      setNewEmail('');
      setTeamMsg(`Acceso concedido a ${cleaned}. Ya puede iniciar sesión desde su celular.`);
    } catch (err) {
      setTeamMsg(
        err instanceof Error ? err.message : 'No se pudo agregar el correo.'
      );
    } finally {
      setTeamBusy(false);
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-[#2B8A7E]">Configuración y copias</p>
        <h2 className="font-display text-2xl font-semibold text-[#3F2E26]">
          Respaldo, web y equipo
        </h2>
      </div>

      {/* PWA Install Card */}
      <PWAInstallButton variant="card" />

      {/* Authorized Team Whitelist */}
      <div className="rounded-3xl bg-[#FAF4EC] border border-[#3F2E26]/15 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#4EBBAD]/20 text-[#2B8A7E] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-[#3F2E26]">
              Equipo autorizado (lista blanca)
            </h3>
            <p className="text-xs text-[#3F2E26]/75 mt-0.5">
              Solo los correos de Google en esta lista pueden ver y editar las reservas de Refugio
              Repalet.
            </p>
          </div>
        </div>

        <div className="divide-y divide-[#3F2E26]/10 rounded-2xl border border-[#3F2E26]/12 bg-[#F5EBDD]/60 overflow-hidden">
          {allowedEmails.map((email) => (
            <div
              key={email}
              className="px-4 py-3 flex items-center justify-between gap-3 min-h-[48px]"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#3F2E26] truncate">{email}</p>
                <p className="text-[11px] text-[#3F2E26]/65">
                  {email === BOOTSTRAP_HOST_EMAIL
                    ? 'Administrador principal'
                    : 'Anfitrión autorizado'}
                  {email === currentUserEmail.toLowerCase() ? ' · Tu sesión actual' : ''}
                </p>
              </div>
              {isBootstrapHost && email !== BOOTSTRAP_HOST_EMAIL && (
                <button
                  type="button"
                  disabled={teamBusy}
                  onClick={async () => {
                    setTeamBusy(true);
                    setTeamMsg(null);
                    try {
                      await onRemoveHostEmail(email);
                      setTeamMsg(`Se revocó el acceso de ${email}.`);
                    } finally {
                      setTeamBusy(false);
                    }
                  }}
                  aria-label={`Quitar a ${email}`}
                  className="min-h-[44px] px-3 rounded-xl text-xs font-semibold text-[#8A3010] hover:bg-[#F16E3F]/15 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Quitar
                </button>
              )}
            </div>
          ))}
        </div>

        {isBootstrapHost && (
          <form onSubmit={handleAddHost} className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Correo Google de Georgina (ej: georgina@gmail.com)"
              className="flex-1 min-h-[44px] px-3.5 rounded-xl border border-[#3F2E26]/20 bg-white text-sm text-[#3F2E26] focus:outline-none focus:ring-2 focus:ring-[#4EBBAD]"
            />
            <button
              type="submit"
              disabled={teamBusy}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#3F2E26] text-[#F5EBDD] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#2d201a] transition-colors shrink-0 cursor-pointer whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4" />
              {teamBusy ? 'Guardando...' : 'Autorizar correo'}
            </button>
          </form>
        )}

        {teamMsg && (
          <p className="text-xs font-medium text-[#2B8A7E] bg-[#4EBBAD]/15 rounded-xl px-3.5 py-2.5">
            {teamMsg}
          </p>
        )}
      </div>

      {/* Full Backup Export / Import */}
      <div className="rounded-3xl bg-[#FAF4EC] border border-[#3F2E26]/15 p-5 space-y-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-[#3F2E26]">
            Respaldo completo (.json)
          </h3>
          <p className="text-xs text-[#3F2E26]/75 mt-0.5">
            Guarda una copia completa con huéspedes, WhatsApp, valores y notas, o restaura un
            archivo previo.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleExportFull}
            className="min-h-[48px] px-4 py-3 rounded-xl bg-[#F16E3F] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#d95b2e] transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Exportar respaldo (.json)
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[48px] px-4 py-3 rounded-xl border border-[#3F2E26]/20 bg-[#F5EBDD]/70 text-[#3F2E26] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#D9C3A0]/50 transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Importar respaldo (.json)
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {backupMsg && (
          <p className="text-xs font-medium text-[#3F2E26] bg-[#D9C3A0]/45 rounded-xl px-3.5 py-2.5">
            {backupMsg}
          </p>
        )}
      </div>

      {/* Public Availability JSON (Zero PII) */}
      <div className="rounded-3xl bg-[#D9C3A0]/50 border border-[#3F2E26]/15 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FAF4EC] text-[#2B8A7E] flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-[#3F2E26]">
              Disponibilidad pública para tu web (.json)
            </h3>
            <p className="text-xs text-[#3F2E26]/80 mt-0.5">
              Incluye únicamente cabaña y fechas ocupadas. Sin nombres, teléfonos ni montos.
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-[#FAF4EC] border border-[#3F2E26]/12 p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-[#3F2E26]">
              Conectar con tu web (refugiorepalet-cloud.github.io/web/)
            </p>
            <p className="text-xs text-[#3F2E26]/75 mt-0.5">
              Se actualiza automáticamente cada vez que tú o Georgina guardan o editan una
              reserva. Puedes incrustar el calendario en vivo con un iframe o leer el JSON en vivo.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={publicViewerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#4EBBAD] text-[#173E39] text-xs font-bold flex items-center gap-1.5 hover:bg-[#3fa99b] transition-colors whitespace-nowrap"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir visor público
            </a>

            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(iframeCode);
                setCopiedIframe(true);
                setTimeout(() => setCopiedIframe(false), 2000);
              }}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-[#3F2E26]/20 bg-[#F5EBDD]/70 text-[#3F2E26] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#D9C3A0]/50 transition-colors whitespace-nowrap cursor-pointer"
            >
              {copiedIframe ? (
                <>
                  <Check className="w-4 h-4 text-[#2B8A7E]" />
                  Iframe copiado
                </>
              ) : (
                <>
                  <Code2 className="w-4 h-4" />
                  Copiar código iframe
                </>
              )}
            </button>

            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(liveFirestoreJsonUrl);
                setCopiedRestUrl(true);
                setTimeout(() => setCopiedRestUrl(false), 2000);
              }}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-[#3F2E26]/20 bg-[#F5EBDD]/70 text-[#3F2E26] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#D9C3A0]/50 transition-colors whitespace-nowrap cursor-pointer"
            >
              {copiedRestUrl ? (
                <>
                  <Check className="w-4 h-4 text-[#2B8A7E]" />
                  URL JSON copiada
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copiar URL JSON en vivo
                </>
              )}
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-[#3F2E26] text-[#F5EBDD] p-3.5 text-xs font-mono overflow-x-auto max-h-44">
          <pre className="leading-relaxed">
            {JSON.stringify(publicAvailabilityPayload, null, 2)}
          </pre>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={handleExportPublic}
            className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#3F2E26] text-[#F5EBDD] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#2d201a] transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Descargar disponibilidad (.json)
          </button>
          <button
            type="button"
            onClick={handleCopyPublic}
            className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#3F2E26]/20 bg-[#FAF4EC] text-[#3F2E26] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#F5EBDD] transition-colors cursor-pointer"
          >
            {copiedPublic ? (
              <>
                <Check className="w-4 h-4 text-[#2B8A7E]" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copiar JSON
              </>
            )}
          </button>
        </div>
      </div>

      {/* Confirmation Modal Before Importing */}
      {pendingImport && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#3F2E26]/55 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => !importBusy && setPendingImport(null)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-[#FAF4EC] border border-[#3F2E26]/15 p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#2B8A7E]">Confirmar importación</p>
                <h3 className="font-display text-xl font-semibold text-[#3F2E26]">
                  ¿Cómo deseas importar el respaldo?
                </h3>
              </div>
              <button
                type="button"
                disabled={importBusy}
                onClick={() => setPendingImport(null)}
                aria-label="Cerrar"
                className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-[#3F2E26]/70 hover:bg-[#D9C3A0]/40 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl bg-[#F5EBDD]/80 border border-[#3F2E26]/12 p-4 text-sm text-[#3F2E26]">
              <p className="font-semibold truncate">{pendingImport.fileName}</p>
              <p className="text-xs text-[#3F2E26]/75 mt-1 tabular-nums">
                Se encontraron <strong>{pendingImport.items.length}</strong> registros válidos para
                Cabaña Colibrí y Cabaña Chercán.
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={importBusy}
                onClick={() => handleConfirmImport('merge')}
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#4EBBAD] text-[#173E39] text-sm font-bold hover:bg-[#3fa99b] transition-colors disabled:opacity-60 cursor-pointer"
              >
                {importBusy
                  ? 'Importando...'
                  : 'Agregar sin borrar las reservas actuales (recomendado)'}
              </button>
              <button
                type="button"
                disabled={importBusy}
                onClick={() => handleConfirmImport('replace')}
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#F16E3F] text-white text-sm font-semibold hover:bg-[#d95b2e] transition-colors disabled:opacity-60 cursor-pointer"
              >
                {importBusy ? 'Reemplazando...' : 'Reemplazar todo el calendario actual'}
              </button>
              <button
                type="button"
                disabled={importBusy}
                onClick={() => setPendingImport(null)}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#3F2E26]/20 text-[#3F2E26] text-sm font-semibold hover:bg-[#D9C3A0]/40 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
