import api, { getAuthConfig } from '../api/api';

export interface CloverPaymentRequestOptions {
  amount: number;
  orderId: string;
  sourceModule: 'Venta Directa' | 'Reserva / Turno' | 'Cuenta Corriente';
  clientName?: string;
  description?: string;
}

export interface CloverPaymentResult {
  approved: boolean;
  cancelled?: boolean;
  auditId?: number;
  cloverPaymentId?: string;
  externalPaymentId?: string;
  cardBrand?: string;
  cardLast4?: string;
  authCode?: string;
  message?: string;
}

export async function linkCloverAuditTransaction(
  auditId: number | undefined,
  data: { paymentGroupId?: string; clientName?: string; description?: string }
): Promise<void> {
  if (!auditId) return;
  try {
    await api.post(`/api/clover/audit/${auditId}/link`, data, getAuthConfig());
  } catch (err) {
    console.warn('No se pudo vincular el grupo de pago al registro de auditoría Clover:', err);
  }
}

export async function executeCloverTerminalPayment(
  options: CloverPaymentRequestOptions
): Promise<CloverPaymentResult> {
  // Crear overlay visual de espera en el DOM
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit;';

  const formattedAmount = Number(options.amount).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  overlay.innerHTML = `
    <div style="background:#fff;border-radius:28px;max-width:420px;width:100%;padding:32px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.35);text-align:center;border:1px solid #f4f4f5;">
      <div id="clover-modal-icon" style="width:68px;height:68px;border-radius:22px;background:#ecfdf5;color:#059669;display:flex;align-items:center;justify-content:center;margin:0 auto 20px auto;">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="animation:clover-pulse 1.5s infinite ease-in-out;">
          <rect x="2" y="5" width="20" height="14" rx="2"></rect>
          <line x1="2" y1="10" x2="22" y2="10"></line>
        </svg>
      </div>
      <style>
        @keyframes clover-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.12); opacity: 0.75; }
        }
      </style>
      <div style="font-size:11px;font-weight:900;letter-spacing:0.18em;text-transform:uppercase;color:#10b981;margin-bottom:6px;">
        TERMINAL CLOVER FLEX
      </div>
      <h3 id="clover-modal-title" style="font-size:22px;font-weight:900;color:#18181b;margin:0 0 8px 0;">
        Conectando con la terminal...
      </h3>
      <div style="font-size:28px;font-weight:900;color:#059669;margin:12px 0;">
        $${formattedAmount}
      </div>
      <p id="clover-modal-desc" style="font-size:13px;font-weight:600;color:#71717a;line-height:1.5;margin:0 0 24px 0;">
        Enviando importe a la terminal física Clover. Aguarde un instante...
      </p>
      <div id="clover-modal-actions">
        <button id="clover-cancel-btn" disabled style="width:100%;padding:13px 20px;border-radius:14px;border:1px solid #e4e4e7;background:#fafafa;color:#71717a;font-size:13px;font-weight:800;cursor:not-allowed;transition:all 0.2s;">
          Iniciando sesión en terminal...
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const titleEl = overlay.querySelector('#clover-modal-title') as HTMLElement;
  const descEl = overlay.querySelector('#clover-modal-desc') as HTMLElement;
  const cancelBtn = overlay.querySelector('#clover-cancel-btn') as HTMLButtonElement;

  const removeOverlay = () => {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  };

  let auditId: number | undefined;
  let cancelledByOperator = false;

  try {
    const chargeRes = await api.post(
      '/api/clover/charge',
      {
        amount: options.amount,
        orderId: options.orderId,
        sourceModule: options.sourceModule,
        clientName: options.clientName,
        description: options.description
      },
      getAuthConfig()
    );

    auditId = chargeRes.data?.auditId;
    if (!auditId) {
      removeOverlay();
      return {
        approved: false,
        message: 'No se recibió identificador de seguimiento de la terminal Clover.'
      };
    }

    titleEl.textContent = 'Esperando pago en Terminal';
    descEl.textContent =
      'El monto ya está en pantalla en la terminal Clover. Solicite al cliente que acerque, inserte o deslice su tarjeta.';
    cancelBtn.disabled = false;
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.background = '#fff1f2';
    cancelBtn.style.borderColor = '#fecdd3';
    cancelBtn.style.color = '#e11d48';
    cancelBtn.textContent = 'Cancelar Cobro en Terminal';

    cancelBtn.onclick = async () => {
      if (!auditId || cancelledByOperator) return;
      cancelledByOperator = true;
      cancelBtn.disabled = true;
      cancelBtn.textContent = 'Cancelando en terminal...';
      try {
        await api.post(`/api/clover/audit/${auditId}/cancel`, {}, getAuthConfig());
      } catch {
        // Ignorar error si ya se había cerrado
      }
    };

    // Polling cada 1.5 segundos hasta recibir respuesta de la terminal (máximo 125 segundos)
    const maxAttempts = 84;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const statusRes = await api.get(`/api/clover/audit/${auditId}/status`, getAuthConfig());
      const data = statusRes.data;
      const status: string = data?.status || 'PENDING';

      if (status === 'APPROVED') {
        titleEl.textContent = '¡Pago Aprobado!';
        descEl.textContent = data?.cardBrand
          ? `Tarjeta ${data.cardBrand} ${data.cardLast4 ? '•••• ' + data.cardLast4 : ''} autorizada.`
          : 'El cobro fue aprobado exitosamente en la terminal Clover.';
        cancelBtn.style.display = 'none';
        await new Promise((resolve) => setTimeout(resolve, 700));
        removeOverlay();

        return {
          approved: true,
          auditId: auditId,
          cloverPaymentId: data.cloverPaymentId,
          externalPaymentId: data.externalPaymentId,
          cardBrand: data.cardBrand,
          cardLast4: data.cardLast4,
          authCode: data.authCode
        };
      }

      if (status === 'CANCELLED') {
        removeOverlay();
        return {
          approved: false,
          cancelled: true,
          auditId: auditId,
          message:
            data?.statusDetail || 'El pago fue cancelado desde la terminal física Clover.'
        };
      }

      if (status === 'ERROR' || status === 'TIMEOUT') {
        removeOverlay();
        return {
          approved: false,
          cancelled: false,
          auditId: auditId,
          message:
            data?.statusDetail || 'Tiempo de espera agotado o error en la terminal Clover.'
        };
      }
    }

    // Si superó el tiempo máximo en el navegador, cancelar en la terminal
    try {
      await api.post(`/api/clover/audit/${auditId}/cancel`, {}, getAuthConfig());
    } catch {
      // Ignorar
    }
    removeOverlay();
    return {
      approved: false,
      cancelled: false,
      auditId: auditId,
      message: 'Se agotó el tiempo de espera aguardando el pago en la terminal Clover.'
    };
  } catch (error: any) {
    removeOverlay();
    const errMsg =
      error.response?.data?.message ||
      error.response?.data ||
      error.message ||
      'Error al conectar con la terminal Clover.';
    return {
      approved: false,
      auditId: auditId,
      message: typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg)
    };
  }
}
