import re

file_path = r"d:\Antigravity Proyectos\PadelQ\PadelQ.AdminWeb\src\pages\Bookings.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add imports
content = content.replace(
    "import api, { getAuthConfig } from '../api/api';",
    "import api, { getAuthConfig } from '../api/api';\nimport { createMercadoPagoIntent, getPointTerminals, PointTerminal } from '../api/mercadoPagoApi';"
)

# 2. Add states after paymentMethods
content = content.replace(
    "const [secondPaymentMethod, setSecondPaymentMethod] = useState<string>('');",
    "const [secondPaymentMethod, setSecondPaymentMethod] = useState<string>('');\n    const [mpTerminals, setMpTerminals] = useState<PointTerminal[]>([]);\n    const [selectedMpTerminal, setSelectedMpTerminal] = useState<number | null>(null);\n    const [isWaitingMp, setIsWaitingMp] = useState(false);"
)

# 3. Add useEffect for MP
effect_block = """    useEffect(() => {
        getPointTerminals().then(setMpTerminals).catch(console.error);
    }, []);

    const handleConfirmPayment = async () => {"""

content = content.replace("    const handleConfirmPayment = async () => {", effect_block)

# 4. Modify handleConfirmPayment to trigger MP, AFTER currentTransactionTotal
# In Bookings.tsx, we have:
# const currentTransactionTotal = isSpace
#   ? totalRentPayment + totalConsumptionsPayment
#   : totalRentPayment + totalConsumptionsPayment;
# I'll inject the MP check right before the if (currentTransactionTotal === 0 && !booking.recurrenceGroupId) {

mp_logic = """        if (isWaitingMp) return;
        const mpMethod = paymentMethods.find(m => m.id.toString() === selectedPaymentMethod);
        if (mpMethod?.name?.toLowerCase().includes('mercado pago') || mpMethod?.name?.toLowerCase().includes('point')) {
            if (!selectedMpTerminal) {
                alert("Debe seleccionar una terminal Point Smart.");
                return;
            }
            try {
                setIsWaitingMp(true);
                await createMercadoPagoIntent({
                    terminalId: selectedMpTerminal,
                    amount: currentTransactionTotal,
                    description: `Cobro local - ${booking?.id || 'Venta'}`,
                    referenceId: booking ? `B-${booking.id}` : `C-${Date.now()}`
                });
                alert("Se envió el cobro a la terminal Point Smart. Esperando pago...");
                setIsConfirmPaymentModalOpen(false);
                setIsWaitingMp(false);
                return;
            } catch (err) {
                console.error(err);
                alert("Error al enviar a la terminal Point Smart.");
                setIsWaitingMp(false);
                return;
            }
        }
        """

content = content.replace(
    "        if (currentTransactionTotal === 0 && !booking.recurrenceGroupId) {",
    mp_logic + "\n        if (currentTransactionTotal === 0 && !booking.recurrenceGroupId) {"
)

# 5. Add UI selector for Point Terminal
# I will find the payment method rendering inside the modal.
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
