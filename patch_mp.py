import re

file_path = r"d:\Antigravity Proyectos\PadelQ\PadelQ.AdminWeb\src\pages\Bookings.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add imports
content = content.replace(
    "import api, { getAuthConfig } from '../api/api';",
    "import api, { getAuthConfig } from '../api/api';\nimport { createMercadoPagoIntent, getPointTerminals, PointTerminal } from '../api/mercadoPagoApi';"
)

# 2. Add states
state_block = """    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
    const [isMixedPayment, setIsMixedPayment] = useState(false);
    const [secondPaymentMethod, setSecondPaymentMethod] = useState<string>('');
    const [mpTerminals, setMpTerminals] = useState<PointTerminal[]>([]);
    const [selectedMpTerminal, setSelectedMpTerminal] = useState<number | null>(null);
    const [isWaitingMp, setIsWaitingMp] = useState(false);"""

content = re.sub(
    r"    const \[paymentMethods, setPaymentMethods\].*?setSecondPaymentMethod.*?;",
    state_block,
    content,
    flags=re.DOTALL | re.MULTILINE
)

# 3. Add useEffect for MP
effect_block = """    useEffect(() => {
        getPointTerminals().then(setMpTerminals).catch(console.error);
    }, []);

    const handleConfirmPayment = async () => {"""

content = content.replace("    const handleConfirmPayment = async () => {", effect_block)

# 4. Modify handleConfirmPayment to trigger MP
mp_logic = """        if (isWaitingMp) return;
        const booking = selectedBooking || selectedSpaceBooking;
        const method = paymentMethods.find(m => m.id.toString() === selectedPaymentMethod);
        if (method?.name?.toLowerCase().includes('mercado pago') || method?.name?.toLowerCase().includes('point')) {
            if (!selectedMpTerminal) {
                alert("Debe seleccionar una terminal Point Smart.");
                return;
            }
            try {
                setIsWaitingMp(true);
                await createMercadoPagoIntent({
                    terminalId: selectedMpTerminal,
                    amount: currentTransactionTotal,
                    description: `Cobro en local - ${booking?.id || 'Venta'}`,
                    referenceId: booking ? `B-${booking.id}` : `C-${Date.now()}`
                });
                alert("Se envió el cobro a la terminal Point Smart. Esperando pago...");
                // Note: The webhook will mark it as paid in the backend. 
                // For now we close the modal.
                setIsConfirmPaymentModalOpen(false);
                setIsWaitingMp(false);
                return;
            } catch (err) {
                console.error(err);
                alert("Error al enviar a la terminal Point Smart.");
                setIsWaitingMp(false);
                return;
            }
        }"""

content = content.replace(
    "        setIsConfirmPaymentModalOpen(false);\n        const booking = selectedBooking || selectedSpaceBooking;",
    mp_logic
)

# 5. Add UI selector for Point Terminal
ui_block = """                                                                    <div className="text-center w-full truncate">{method.name}</div>
                                                                </button>
                                                            );
                                                        })
                                                    }
                                                </div>

                                                {/* Selector de Terminal MP */}
                                                {paymentMethods.find(m => m.id.toString() === selectedPaymentMethod)?.name?.toLowerCase().includes('mercado pago') && (
                                                    <div className="mt-4">
                                                        <label className="text-xs font-bold text-slate-500 mb-2 block">Seleccione Terminal Point Smart:</label>
                                                        <select 
                                                            className="w-full border p-2 rounded"
                                                            value={selectedMpTerminal || ''}
                                                            onChange={(e) => setSelectedMpTerminal(Number(e.target.value))}
                                                        >
                                                            <option value="">-- Seleccionar Terminal --</option>
                                                            {mpTerminals.map(t => (
                                                                <option key={t.id} value={t.id}>{t.name} ({t.externalPosId})</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}"""

content = re.sub(
    r"                                                                    <div className=\"text-center w-full truncate\">\{method\.name\}</div>\s*</button>\s*\);\s*}\)\s*}\s*</div>",
    ui_block,
    content,
    flags=re.DOTALL
)

# 6. Change "Cobrar" text if waiting
content = content.replace(
    "{includePreviousDebt ? 'Quitar de este Pago' : 'Cobrar Saldo Pendiente'}",
    "{isWaitingMp ? 'Enviando a Terminal...' : (includePreviousDebt ? 'Quitar de este Pago' : 'Cobrar Saldo Pendiente')}"
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patch applied.")
