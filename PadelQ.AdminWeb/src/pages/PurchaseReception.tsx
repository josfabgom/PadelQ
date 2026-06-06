import React, { useState, useEffect } from 'react';
import api, { getAuthConfig } from '../api/api';
import { 
    ShoppingCart, ArrowLeft, Plus, Trash2, Save, Calendar, Tag, FileText, 
    User, Search, X, Package, DollarSign, ChevronRight, AlertCircle, RefreshCcw, History, Eye
} from 'lucide-react';
import Header from '../components/Header';
import { format } from 'date-fns';

interface Product {
    id: number;
    name: string;
    stock: number;
    costPrice: number;
    category: string;
    internalCode?: string;
}

interface Supplier {
    id: number;
    name: string;
}

interface PurchaseItem {
    productId: number;
    productName: string;
    quantity: number;
    unitCost: number;
    lineTotal: number;
}

const PurchaseReceptionPage = () => {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [selectedSupplierId, setSelectedSupplierId] = useState<number | ''>('');
    const [purchaseDate, setPurchaseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState<PurchaseItem[]>([]);

    // Search and Selection
    const [searchQuery, setSearchQuery] = useState('');
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [newSupplierName, setNewSupplierName] = useState('');

    // History Modal
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [pastPurchases, setPastPurchases] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [selectedPurchaseDetails, setSelectedPurchaseDetails] = useState<any>(null);

    const config = getAuthConfig();

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [suppliersRes, productsRes] = await Promise.all([
                api.get('/api/supplier-purchases/suppliers', config),
                api.get('/api/products', config)
            ]);
            setSuppliers(suppliersRes.data);
            setProducts(productsRes.data);
        } catch (err) {
            console.error("Error loading data", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const res = await api.get('/api/supplier-purchases', config);
            setPastPurchases(res.data);
        } catch (err) {
            console.error("Error loading history", err);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleAddProduct = (product: Product) => {
        const existingItem = items.find(i => i.productId === product.id);
        if (existingItem) {
            setItems(items.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1, lineTotal: (i.quantity + 1) * i.unitCost } : i));
        } else {
            setItems([...items, {
                productId: product.id,
                productName: product.name,
                quantity: 1,
                unitCost: product.costPrice || 0,
                lineTotal: product.costPrice || 0
            }]);
        }
        setSearchQuery('');
    };

    const handleUpdateItem = (index: number, field: keyof PurchaseItem, value: any) => {
        const newItems = [...items];
        const item = { ...newItems[index], [field]: value };
        
        if (field === 'quantity' || field === 'unitCost') {
            item.lineTotal = item.quantity * item.unitCost;
        }
        
        newItems[index] = item as PurchaseItem;
        setItems(newItems);
    };

    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleCreateSupplier = async () => {
        if (!newSupplierName.trim()) return;
        try {
            const res = await api.post('/api/supplier-purchases/suppliers', { name: newSupplierName }, config);
            setSuppliers([...suppliers, res.data]);
            setSelectedSupplierId(res.data.id);
            setNewSupplierName('');
            setIsSupplierModalOpen(false);
        } catch (err) {
            alert("Error al crear proveedor");
        }
    };

    const handleSubmit = async () => {
        if (!selectedSupplierId || items.length === 0) {
            alert("Completa los datos y agrega al menos un producto.");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                supplierId: selectedSupplierId,
                purchaseDate: new Date(purchaseDate),
                invoiceNumber,
                notes,
                totalAmount: items.reduce((sum, i) => sum + i.lineTotal, 0),
                items: items.map(i => ({
                    productId: i.productId,
                    quantity: i.quantity,
                    unitCost: i.unitCost,
                    lineTotal: i.lineTotal
                }))
            };

            await api.post('/api/supplier-purchases', payload, config);
            alert("Compra registrada correctamente. El stock ha sido actualizado.");
            
            // Reset form
            setItems([]);
            setInvoiceNumber('');
            setNotes('');
            setSelectedSupplierId('');
        } catch (err: any) {
            console.error(err);
            alert(err.response?.data || "Error al registrar la compra");
        } finally {
            setSaving(false);
        }
    };

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.internalCode?.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5);

    const totalOrder = items.reduce((sum, i) => sum + i.lineTotal, 0);

    const formatARS = (amount: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0
        }).format(amount);
    };

    return (
        <div className="p-8 space-y-8 bg-[#FAFAFA] min-h-screen font-outfit">
            <Header />

            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                <div className="flex items-center gap-6">
                    <a href="/products" className="p-4 bg-white rounded-3xl border border-black/5 shadow-sm hover:scale-105 active:scale-95 transition-all duration-300 group">
                        <ArrowLeft className="w-5 h-5 text-black group-hover:-translate-x-1 transition-transform" />
                    </a>
                    <div>
                        <h1 className="text-3xl font-black text-black tracking-tight uppercase italic">Recepción de Compras</h1>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">CARGA DE STOCK POR PROVEEDOR</p>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => {
                            fetchHistory();
                            setIsHistoryModalOpen(true);
                        }}
                        className="flex items-center gap-3 px-6 py-5 bg-white text-black border border-black/10 rounded-[24px] text-xs font-black uppercase tracking-widest hover:bg-zinc-50 transition-all active:scale-95 shadow-sm"
                    >
                        <History className="w-5 h-5" />
                        Historial
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={saving || items.length === 0}
                        className="flex items-center gap-3 px-10 py-5 bg-black text-white rounded-[24px] text-xs font-black uppercase tracking-widest shadow-2xl shadow-black/30 hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {saving ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Confirmar e Ingresar Stock
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Information Sidebar */}
                <div className="space-y-6">
                    <div className="bg-white rounded-[40px] p-8 border border-black/5 shadow-sm space-y-6">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Proveedor</label>
                                <button 
                                    onClick={() => setIsSupplierModalOpen(true)}
                                    className="text-[9px] font-black text-black uppercase tracking-widest border-b border-black"
                                >
                                    + Nuevo
                                </button>
                            </div>
                            <select 
                                value={selectedSupplierId}
                                onChange={(e) => setSelectedSupplierId(Number(e.target.value))}
                                className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none font-bold text-sm"
                            >
                                <option value="">Seleccionar Proveedor...</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Fecha de Compra</label>
                            <input 
                                type="date" 
                                value={purchaseDate}
                                onChange={(e) => setPurchaseDate(e.target.value)}
                                className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none font-bold text-sm"
                            />
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nº de Factura / Remito</label>
                            <input 
                                type="text" 
                                value={invoiceNumber}
                                onChange={(e) => setInvoiceNumber(e.target.value)}
                                placeholder="0001-00004512"
                                className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none font-bold text-sm"
                            />
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Observaciones</label>
                            <textarea 
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Notas internas..."
                                className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none font-bold text-sm h-24 resize-none"
                            />
                        </div>
                    </div>

                    <div className="bg-black rounded-[40px] p-8 border border-black shadow-xl text-white">
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-4">Resumen de la Compra</p>
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[10px] font-bold text-white/40 uppercase">Artículos</p>
                                <h4 className="text-2xl font-black italic">{items.reduce((s, i) => s + i.quantity, 0)} uds</h4>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-bold text-white/40 uppercase">Total Estimado</p>
                                <h4 className="text-4xl font-black italic text-emerald-400">{formatARS(totalOrder)}</h4>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Items Main Area */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-[40px] p-8 border border-black/5 shadow-sm">
                        <div className="relative mb-8">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                            <input 
                                type="text" 
                                placeholder="Buscar productos para agregar..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-16 pr-8 py-6 bg-zinc-50 border border-zinc-100 rounded-[32px] outline-none focus:ring-4 focus:ring-black/5 font-bold text-lg italic"
                            />
                            
                            {searchQuery.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-4 bg-white rounded-[32px] shadow-2xl border border-black/5 z-20 overflow-hidden p-2">
                                    {filteredProducts.map(p => (
                                        <button 
                                            key={p.id}
                                            onClick={() => handleAddProduct(p)}
                                            className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 rounded-2xl transition-all group"
                                        >
                                            <div className="flex items-center gap-4 text-left">
                                                <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center">
                                                    <Package className="w-5 h-5 text-zinc-400" />
                                                </div>
                                                <div>
                                                    <p className="font-black italic text-black">{p.name}</p>
                                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{p.category} • Stock: {p.stock}</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-black transition-colors" />
                                        </button>
                                    ))}
                                    {filteredProducts.length === 0 && (
                                        <div className="p-8 text-center text-zinc-400 font-black uppercase text-[10px] tracking-widest italic">
                                            No se encontraron productos
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-12 px-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">
                                <div className="col-span-5">Producto</div>
                                <div className="col-span-2 text-center">Cantidad</div>
                                <div className="col-span-2 text-right">Costo Unit.</div>
                                <div className="col-span-2 text-right">Subtotal</div>
                                <div className="col-span-1"></div>
                            </div>
                            
                            <div className="space-y-3">
                                {items.map((item, idx) => (
                                    <div key={item.productId} className="grid grid-cols-12 items-center bg-zinc-50/50 border border-zinc-100 rounded-[28px] p-4 group hover:bg-white hover:border-black/10 transition-all">
                                        <div className="col-span-5 px-2">
                                            <p className="font-black italic text-black text-sm">{item.productName}</p>
                                        </div>
                                        <div className="col-span-2 px-2 flex justify-center">
                                            <input 
                                                type="number" 
                                                value={item.quantity}
                                                onChange={(e) => handleUpdateItem(idx, 'quantity', Number(e.target.value))}
                                                className="w-20 bg-white border border-zinc-200 rounded-xl py-2 text-center font-black text-sm outline-none focus:ring-2 focus:ring-black/10"
                                            />
                                        </div>
                                        <div className="col-span-2 px-2 flex justify-end">
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400" />
                                                <input 
                                                    type="number" 
                                                    value={item.unitCost}
                                                    onChange={(e) => handleUpdateItem(idx, 'unitCost', Number(e.target.value))}
                                                    className="w-28 pl-8 pr-4 bg-white border border-zinc-200 rounded-xl py-2 text-right font-black text-sm outline-none focus:ring-2 focus:ring-black/10"
                                                />
                                            </div>
                                        </div>
                                        <div className="col-span-2 px-2 text-right">
                                            <p className="font-black italic text-zinc-500">{formatARS(item.lineTotal)}</p>
                                        </div>
                                        <div className="col-span-1 flex justify-end">
                                            <button 
                                                onClick={() => handleRemoveItem(idx)}
                                                className="p-2 text-zinc-300 hover:text-rose-500 transition-colors"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {items.length === 0 && (
                                    <div className="py-20 text-center space-y-4">
                                        <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto text-zinc-200">
                                            <ShoppingCart className="w-8 h-8" />
                                        </div>
                                        <p className="text-[11px] font-black text-zinc-300 uppercase tracking-widest italic">La lista de compra está vacía</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Supplier Modal */}
            {isSupplierModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[70] p-6">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-300 border border-black/5">
                        <div className="p-8 bg-zinc-900 text-white relative">
                            <button onClick={() => setIsSupplierModalOpen(false)} className="absolute right-8 top-8 p-2 hover:bg-white/10 rounded-xl transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                            <h2 className="text-xl font-black italic uppercase tracking-tight">Nuevo Proveedor</h2>
                            <p className="text-white/40 text-[9px] font-bold uppercase tracking-[0.2em] mt-1">Registrar entidad proveedora</p>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nombre / Razón Social</label>
                                <input 
                                    type="text" 
                                    value={newSupplierName}
                                    onChange={(e) => setNewSupplierName(e.target.value)}
                                    className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none font-bold text-sm"
                                    placeholder="Ej: Distribuidora Coca Cola"
                                />
                            </div>
                            <button 
                                onClick={handleCreateSupplier}
                                className="w-full py-5 bg-emerald-500 text-white rounded-[24px] font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 transition-all"
                            >
                                Guardar Proveedor
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {isHistoryModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[70] p-6">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-300 border border-black/5 flex flex-col max-h-[90vh]">
                        <div className="p-8 bg-zinc-900 text-white relative flex-shrink-0">
                            <button onClick={() => { setIsHistoryModalOpen(false); setSelectedPurchaseDetails(null); }} className="absolute right-8 top-8 p-2 hover:bg-white/10 rounded-xl transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                                    <History className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black italic uppercase tracking-tight">Historial de Compras</h2>
                                    <p className="text-white/40 text-[9px] font-bold uppercase tracking-[0.2em] mt-1">Registro de stock ingresado</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-8 overflow-y-auto flex-1 bg-zinc-50/50">
                            {selectedPurchaseDetails ? (
                                <div className="space-y-6">
                                    <button 
                                        onClick={() => setSelectedPurchaseDetails(null)}
                                        className="text-[10px] font-black uppercase text-zinc-500 hover:text-black flex items-center gap-2"
                                    >
                                        <ArrowLeft className="w-4 h-4" /> Volver al listado
                                    </button>
                                    <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Proveedor</p>
                                            <p className="text-xl font-black uppercase">{selectedPurchaseDetails.supplier?.name || 'Desconocido'}</p>
                                            <p className="text-xs font-bold text-zinc-500 mt-1">Factura: {selectedPurchaseDetails.invoiceNumber || 'N/A'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total</p>
                                            <p className="text-2xl font-black italic text-emerald-600">{formatARS(selectedPurchaseDetails.totalAmount)}</p>
                                            <p className="text-xs font-bold text-zinc-500 mt-1">{new Date(selectedPurchaseDetails.purchaseDate).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
                                        <div className="grid grid-cols-12 p-4 text-[9px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-50 border-b border-zinc-100">
                                            <div className="col-span-6">Producto</div>
                                            <div className="col-span-2 text-center">Cantidad</div>
                                            <div className="col-span-2 text-right">Costo Unit.</div>
                                            <div className="col-span-2 text-right">Subtotal</div>
                                        </div>
                                        <div className="divide-y divide-zinc-100">
                                            {selectedPurchaseDetails.items?.map((item: any) => (
                                                <div key={item.id} className="grid grid-cols-12 p-4 items-center hover:bg-zinc-50 transition-colors">
                                                    <div className="col-span-6 font-bold text-sm">{item.product?.name || 'Producto Eliminado'}</div>
                                                    <div className="col-span-2 text-center font-black text-zinc-600">{item.quantity}</div>
                                                    <div className="col-span-2 text-right font-bold text-zinc-500">{formatARS(item.unitCost)}</div>
                                                    <div className="col-span-2 text-right font-black italic">{formatARS(item.lineTotal)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {selectedPurchaseDetails.notes && (
                                        <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
                                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Observaciones</p>
                                            <p className="text-sm font-bold text-zinc-600 italic">"{selectedPurchaseDetails.notes}"</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {loadingHistory ? (
                                        <div className="flex justify-center py-20">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
                                        </div>
                                    ) : pastPurchases.length > 0 ? (
                                        pastPurchases.map((purchase) => (
                                            <div key={purchase.id} className="bg-white p-5 rounded-[24px] border border-zinc-100 shadow-sm flex items-center justify-between hover:border-black/20 transition-all group">
                                                <div className="flex items-center gap-6">
                                                    <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center">
                                                        <Calendar className="w-6 h-6 text-zinc-400" />
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-lg uppercase">{purchase.supplier?.name || 'Proveedor Desconocido'}</p>
                                                        <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">
                                                            <span>{new Date(purchase.purchaseDate).toLocaleDateString()}</span>
                                                            <span className="text-zinc-300">•</span>
                                                            <span>Factura: {purchase.invoiceNumber || 'S/N'}</span>
                                                            <span className="text-zinc-300">•</span>
                                                            <span>{purchase.items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0} UDS</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <div className="text-right">
                                                        <p className="text-xl font-black italic text-emerald-600">{formatARS(purchase.totalAmount)}</p>
                                                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-1">{purchase.createdBy}</p>
                                                    </div>
                                                    <button 
                                                        onClick={() => setSelectedPurchaseDetails(purchase)}
                                                        className="p-3 bg-zinc-50 text-black rounded-xl hover:bg-black hover:text-white transition-all"
                                                        title="Ver Detalle"
                                                    >
                                                        <Eye className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-20">
                                            <Package className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                                            <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest italic">No hay compras registradas</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PurchaseReceptionPage;
