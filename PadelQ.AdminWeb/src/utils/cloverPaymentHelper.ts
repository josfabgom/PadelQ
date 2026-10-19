import api, { getAuthConfig } from '../api/api';

export interface CloverPaymentRequestOptions {
  amount: number;
  orderId: string;
  sourceModule: 'Venta Directa' | 'Reserva / Turno' | 'Cuenta Corriente' | 'Cobro POS';
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
    <div style="background:#fff;border-radius:28px;max-width:440px;width:100%;padding:32px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.35);text-align:center;border:1px solid #f4f4f5;">
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
      <p id="clover-modal-desc" style="font-size:13px;font-weight:600;color:#71717a;line-height:1.5;margin:0 0 20px 0;">
        Enviando importe a la terminal física Clover. Aguarde un instante...
      </p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:12px;margin-bottom:20px;text-align:left;">
        <div style="font-size:11px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">
          En espera de la terminal:
        </div>
        <div style="font-size:12px;color:#64748b;line-height:1.4;">
          Acerque/inserte la tarjeta o escanee con QR en la pantalla de Clover. Para anular el cobro, presione <b>Cancelar (X)</b> en la propia terminal Clover.
        </div>
      </div>

      <div id="clover-modal-actions" style="display:flex;flex-direction:column;gap:8px;">
        <button id="clover-verify-btn" disabled style="width:100%;padding:13px 20px;border-radius:14px;border:none;background:#10b981;color:#fff;font-size:13px;font-weight:800;cursor:not-allowed;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:8px;">
          <span id="clover-verify-text">Iniciando cobro en terminal...</span>
        </button>
        <button id="clover-cancel-btn" disabled style="width:100%;padding:11px 20px;border-radius:14px;border:1px solid #e4e4e7;background:#fafafa;color:#71717a;font-size:12px;font-weight:700;cursor:not-allowed;transition:all 0.2s;">
          Cancelar / Destrabar sesión
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const titleEl = overlay.querySelector('#clover-modal-title') as HTMLElement;
  const descEl = overlay.querySelector('#clover-modal-desc') as HTMLElement;
  const verifyBtn = overlay.querySelector('#clover-verify-btn') as HTMLButtonElement;
  const verifyText = overlay.querySelector('#clover-verify-text') as HTMLElement;
  const cancelBtn = overlay.querySelector('#clover-cancel-btn') as HTMLButtonElement;

  const removeOverlay = () => {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  };

  let auditId: number | undefined;
  let isResolving = false;

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
      'El importe está listo en la pantalla de la terminal Clover. Esperando que el cliente complete el pago o presione Cancelar en la terminal.';

    // Botón de verificación manual
    verifyBtn.disabled = false;
    verifyBtn.style.cursor = 'pointer';
    verifyText.textContent = 'Verificar estado en Clover ahora';

    // Botón de cancelación / destrabe seguro
    cancelBtn.disabled = false;
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.background = '#fff';
    cancelBtn.style.borderColor = '#fecdd3';
    cancelBtn.style.color = '#e11d48';

    verifyBtn.onclick = async () => {
      if (!auditId || isResolving) return;
      verifyBtn.disabled = true;
      verifyText.textContent = 'Consultando servidores Clover...';
      try {
        const res = await api.get(`/api/clover/audit/${auditId}/status?forceVerify=true`, getAuthConfig());
        if (res.data?.status === 'APPROVED') {
          // El polling principal lo procesará inmediatamente
          return;
        }
      } catch (err) {
        console.warn('Error en verificación manual:', err);
      } finally {
        setTimeout(() => {
          if (!isResolving) {
            verifyBtn.disabled = false;
            verifyText.textContent = 'Verificar estado en Clover ahora';
          }
        }, 1500);
      }
    };

    cancelBtn.onclick = async () => {
      if (!auditId || isResolving) return;
      if (!window.confirm('¿Desea destrabar esta sesión? El sistema verificará primero en los servidores de Clover si el cobro ya fue aprobado antes de cancelar.')) {
        return;
      }
      isResolving = true;
      cancelBtn.disabled = true;
      verifyBtn.disabled = true;
      cancelBtn.textContent = 'Verificando y cancelando en Clover...';
      try {
        const cancelRes = await api.post(`/api/clover/audit/${auditId}/cancel`, {}, getAuthConfig());
        if (cancelRes.data?.approved && cancelRes.data?.status === 'APPROVED') {
          titleEl.textContent = '¡Pago Aprobado!';
          descEl.textContent = 'El pago ya había sido aprobado exitosamente en la terminal Clover.';
          await new Promise((resolve) => setTimeout(resolve, 800));
          removeOverlay();
          return {
            approved: true,
            auditId: auditId,
            cloverPaymentId: cancelRes.data.cloverPaymentId,
            externalPaymentId: cancelRes.data.externalPaymentId,
            cardBrand: cancelRes.data.cardBrand,
            cardLast4: cancelRes.data.cardLast4,
            authCode: cancelRes.data.authCode
          };
        }
      } catch {
        // Ignorar error si ya se había cerrado
      }
    };

    // Polling cada 1.5 segundos hasta recibir respuesta de la terminal (máximo 5 minutos / 200 intentos)
    const maxAttempts = 200;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      let data: any = null;
      try {
        const statusRes = await api.get(`/api/clover/audit/${auditId}/status`, getAuthConfig());
        data = statusRes.data;
      } catch (pollErr) {
        // Resiliencia ante micro-cortes de red en la PC
        console.warn('Micro-corte o reintento de conexión con Clover status...', pollErr);
        continue;
      }

      const status: string = data?.status || 'PENDING';

      if (status === 'APPROVED') {
        isResolving = true;
        titleEl.textContent = '¡Pago Aprobado!';
        descEl.textContent = data?.cardBrand
          ? `${data.cardBrand} ${data.cardLast4 ? '•••• ' + data.cardLast4 : ''} autorizada.`
          : 'El cobro fue aprobado exitosamente en la terminal Clover.';
        verifyBtn.style.display = 'none';
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
        isResolving = true;
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
        isResolving = true;
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

    // Si superó los 5 minutos en el navegador, verificar y cancelar
    try {
      const timeoutRes = await api.post(`/api/clover/audit/${auditId}/cancel`, {}, getAuthConfig());
      if (timeoutRes.data?.approved && timeoutRes.data?.status === 'APPROVED') {
        removeOverlay();
        return {
          approved: true,
          auditId: auditId,
          cloverPaymentId: timeoutRes.data.cloverPaymentId,
          externalPaymentId: timeoutRes.data.externalPaymentId,
          cardBrand: timeoutRes.data.cardBrand,
          cardLast4: timeoutRes.data.cardLast4,
          authCode: timeoutRes.data.authCode
        };
      }
    } catch {
      // Ignorar
    }

    removeOverlay();
    return {
      approved: false,
      cancelled: false,
      auditId: auditId,
      message: 'Se agotó el tiempo de espera (5 min) aguardando la respuesta de la terminal Clover.'
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
