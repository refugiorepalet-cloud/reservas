import React, { useState } from 'react';
import { LogOut, ShieldAlert } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface LoginScreenProps {
  mode: 'unauthenticated' | 'unauthorized';
  userEmail?: string | null;
  authError?: string | null;
  isSigningIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

const BASE = import.meta.env.BASE_URL || '/';
const HERO_IMG_PATH = `${BASE}src/assets/images/refugio_repalet_cabins_1795647753855.jpg`;
const LOGO_IMG_PATH = `${BASE}assets/aistudio/logo_transp_45a8aadc.png`;

export const LoginScreen: React.FC<LoginScreenProps> = ({
  mode,
  userEmail,
  authError,
  isSigningIn,
  onSignIn,
  onSignOut,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="min-h-screen bg-[#F5EBDD] text-[#3F2E26] flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-4xl rounded-3xl bg-[#FAF4EC] border border-[#3F2E26]/15 shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-2 items-stretch">
        {/* Left: Editorial Horcon cabin photo */}
        <div className="relative min-h-[220px] lg:min-h-[480px] bg-[#3F2E26]">
          {!imgFailed ? (
            <img
              src={HERO_IMG_PATH}
              alt="Cabañas de madera en la costa de Horcón al atardecer"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover lg:h-full"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-[#F5EBDD]/80">
              <img
                src={LOGO_IMG_PATH}
                alt="Refugio Repalet"
                className="w-16 h-16 mb-3 rounded-xl bg-[#F5EBDD] p-1.5 object-contain"
              />
              <p className="font-display text-lg">Refugio Repalet</p>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#3F2E26]/85 via-[#3F2E26]/25 to-transparent flex flex-col justify-end p-6">
            <p className="text-xs font-medium text-[#D9C3A0] tracking-wide">
              Horcón · Costa de Valparaíso
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#F5EBDD] mt-1">
              Cabaña Colibrí &amp; Cabaña Chercán
            </h2>
          </div>
        </div>

        {/* Right: Clean private sign-in panel */}
        <div className="p-6 sm:p-10 flex flex-col justify-between gap-8">
          <div>
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <img
                  src={LOGO_IMG_PATH}
                  alt="Logo Refugio Repalet"
                  className="w-11 h-11 rounded-xl bg-[#F5EBDD]/70 p-1 object-contain shrink-0"
                />
                <div>
                  <h1 className="font-display text-xl font-bold text-[#3F2E26] leading-tight">
                    Refugio Repalet
                  </h1>
                  <p className="text-xs text-[#2B8A7E] font-medium">
                    Acceso privado · Georgina y Claudio
                  </p>
                </div>
              </div>
              <PWAInstallButton variant="compact" />
            </div>

            {mode === 'unauthenticated' ? (
              <div className="space-y-4">
                <h2 className="font-display text-2xl font-semibold text-[#3F2E26]">
                  Bitácora y reservas en tiempo real
                </h2>
                <p className="text-sm leading-relaxed text-[#3F2E26]/75">
                  Inicia sesión con tu cuenta de Google autorizada para consultar el calendario,
                  coordinar ingresos y mantener sincronizados ambos celulares.
                </p>

                {authError && (
                  <div className="rounded-xl bg-[#F16E3F]/12 border border-[#F16E3F]/30 p-3.5 text-sm text-[#3F2E26]">
                    {authError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={onSignIn}
                  disabled={isSigningIn}
                  className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#F16E3F] text-white font-semibold text-sm flex items-center justify-center gap-3 hover:bg-[#d95b2e] active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"
                    />
                  </svg>
                  {isSigningIn ? 'Conectando con Google...' : 'Entrar con Google'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-2xl bg-[#D9C3A0]/45 border border-[#3F2E26]/15 p-4">
                  <ShieldAlert className="w-5 h-5 text-[#F16E3F] shrink-0 mt-0.5" />
                  <div className="space-y-1.5">
                    <h2 className="font-display text-lg font-semibold text-[#3F2E26]">
                      Correo no autorizado
                    </h2>
                    <p className="text-sm text-[#3F2E26]/80">
                      La cuenta{' '}
                      <strong className="text-[#3F2E26] break-all">
                        {userEmail || 'actual'}
                      </strong>{' '}
                      no está en la lista blanca de Refugio Repalet.
                    </p>
                    <p className="text-xs text-[#3F2E26]/70">
                      Si eres Georgina, pídele a Claudio que agregue este correo en{' '}
                      <strong>Respaldo → Equipo autorizado</strong>, o cierra sesión e ingresa con
                      tu cuenta permitida.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onSignOut}
                  className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#3F2E26] text-[#F5EBDD] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#2d201a] transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión e intentar con otro correo
                </button>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#3F2E26]/10 text-xs text-[#3F2E26]/60 flex items-center justify-between gap-2">
            <span>Datos protegidos para uso interno</span>
            <span>Check-in 15:00 · Check-out 12:00</span>
          </div>
        </div>
      </div>
    </div>
  );
};
