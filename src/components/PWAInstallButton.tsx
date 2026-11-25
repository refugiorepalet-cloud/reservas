import React, { useState } from 'react';
import { Download, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ variant?: 'compact' | 'card' }> = ({
  variant = 'compact',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    if (variant === 'card') {
      return (
        <div className="rounded-2xl bg-[#FAF4EC] border border-[#3F2E26]/15 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#4EBBAD]/20 text-[#2B8A7E] flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#3F2E26]">App instalada en tu celular</p>
            <p className="text-xs text-[#3F2E26]/70">
              Estás usando Refugio Repalet en modo pantalla completa.
            </p>
          </div>
        </div>
      );
    }
    return null;
  }

  if (isInstallable) {
    if (variant === 'card') {
      return (
        <div className="rounded-2xl bg-[#D9C3A0]/50 border border-[#3F2E26]/15 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#3F2E26]">
              Instalar en la pantalla de inicio
            </p>
            <p className="text-xs text-[#3F2E26]/75 mt-0.5">
              Úsala como aplicación directa sin abrir el navegador.
            </p>
          </div>
          <button
            type="button"
            onClick={install}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#F16E3F] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#d95b2e] transition-colors shrink-0 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Instalar app
          </button>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={install}
        className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#4EBBAD]/20 text-[#2B8A7E] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#4EBBAD]/30 transition-colors shrink-0 cursor-pointer whitespace-nowrap"
      >
        <Download className="w-4 h-4" />
        Instalar
      </button>
    );
  }

  if (isIOS || variant === 'card') {
    return (
      <>
        {variant === 'card' ? (
          <div className="rounded-2xl bg-[#D9C3A0]/45 border border-[#3F2E26]/15 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#3F2E26]">
                Agregar a pantalla de inicio (iPhone / Android)
              </p>
              <p className="text-xs text-[#3F2E26]/75 mt-0.5">
                {isIOS
                  ? 'En Safari toca Compartir y luego "Agregar a inicio".'
                  : 'Desde el menú de tu navegador elige "Instalar aplicación" o "Agregar a pantalla principal".'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowIOSGuide(true)}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-[#3F2E26]/25 bg-[#FAF4EC] text-[#3F2E26] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#D9C3A0]/40 transition-colors shrink-0 cursor-pointer whitespace-nowrap"
            >
              <Share className="w-4 h-4" />
              Ver pasos
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            className="min-h-[44px] px-3 py-2 rounded-xl border border-[#3F2E26]/20 bg-[#FAF4EC] text-[#3F2E26] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#D9C3A0]/40 transition-colors shrink-0 cursor-pointer whitespace-nowrap"
          >
            <Smartphone className="w-4 h-4 text-[#2B8A7E]" />
            Instalar
          </button>
        )}

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#3F2E26]/50 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl bg-[#FAF4EC] border border-[#3F2E26]/15 p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-lg font-semibold text-[#3F2E26]">
                  Instalar en tu celular
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Cerrar"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#3F2E26]/70 hover:bg-[#D9C3A0]/40 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3 text-sm text-[#3F2E26]/85">
                <p>
                  <strong className="text-[#3F2E26]">En iPhone / iPad (Safari):</strong>
                  <br />
                  1. Toca el botón <strong>Compartir</strong> (cuadrado con flecha hacia arriba).
                  <br />
                  2. Baja y elige <strong>Agregar a inicio</strong>.
                </p>
                <p>
                  <strong className="text-[#3F2E26]">En Android (Chrome):</strong>
                  <br />
                  1. Toca el menú <strong>⋮</strong> arriba a la derecha.
                  <br />
                  2. Elige <strong>Instalar aplicación</strong> o <strong>Agregar a la pantalla principal</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-xl bg-[#F16E3F] text-white text-sm font-semibold hover:bg-[#d95b2e] transition-colors cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-40 flex items-center gap-2 rounded-xl bg-[#3F2E26] px-4 py-2.5 text-xs font-medium text-[#F5EBDD] shadow-lg">
      <WifiOff className="w-4 h-4 text-[#F16E3F] shrink-0" />
      <span>Sin conexión a internet — mostrando datos guardados</span>
    </div>
  );
};
