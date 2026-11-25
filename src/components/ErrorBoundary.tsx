import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Ocurrió un error inesperado.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendlyMessage =
        'No pudimos completar la operación. Recarga la página o intenta nuevamente.';
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed?.error?.includes('Missing or insufficient permissions')) {
          friendlyMessage =
            'Tu cuenta no tiene permisos para acceder a estos datos. Verifica que tu correo esté autorizado por Claudio.';
        }
      } catch {
        // Keep friendly fallback
      }

      return (
        <div className="min-h-screen bg-[#F5EBDD] text-[#3F2E26] flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl bg-[#FAF4EC] border border-[#3F2E26]/15 p-6 shadow-sm">
            <div className="flex items-center gap-3 text-[#F16E3F] mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="font-display text-xl font-semibold text-[#3F2E26]">
                Algo salió mal
              </h1>
            </div>
            <p className="text-sm leading-relaxed text-[#3F2E26]/80 mb-5">
              {friendlyMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[44px] rounded-xl bg-[#F16E3F] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#d95b2e] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Recargar aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
