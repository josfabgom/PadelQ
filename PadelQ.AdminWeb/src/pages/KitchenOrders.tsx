import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import * as signalR from '@microsoft/signalr';

interface KitchenOrder {
    id: string;
    orderNumber: number;
    createdAt: string;
    status: string; // 'Pending', 'Preparing', 'Ready', 'Delivered'
    customerName: string;
    items: {
        productId: number;
        productName: string;
        quantity: number;
        notes: string;
    }[];
}

const parseUtcDate = (dateString: string) => {
    if (!dateString) return new Date();
    return new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
};

const KitchenOrders = () => {
    const [orders, setOrders] = useState<KitchenOrder[]>([]);
    const [historyOrders, setHistoryOrders] = useState<KitchenOrder[]>([]);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    
    // Default to today
    const [historyStartDate, setHistoryStartDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [historyEndDate, setHistoryEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    const fetchHistory = async (start = historyStartDate, end = historyEndDate) => {
        try {
            const token = localStorage.getItem('padelq_token');
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const url = new URL(`${apiUrl}/api/kitchen-orders/history`);
            if (start) url.searchParams.append('startDate', start);
            if (end) url.searchParams.append('endDate', end);

            const response = await fetch(url.toString(), {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setHistoryOrders(data);
            }
        } catch (error) {
            console.error('Error fetching history orders', error);
        }
    };


    const fetchOrders = async () => {
        try {
            const token = localStorage.getItem('padelq_token');
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const response = await fetch(`${apiUrl}/api/kitchen-orders/active`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setOrders(data);
            }
        } catch (error) {
            console.error('Error fetching kitchen orders', error);
        }
    };

    const updateStatus = async (id: string, newStatus: string) => {
        try {
            const token = localStorage.getItem('padelq_token');
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            await fetch(`${apiUrl}/api/kitchen-orders/${id}/status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });
            fetchOrders();
        } catch (error) {
            console.error('Error updating status', error);
        }
    };

    const webAudioBeep = () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = 800;
            gain.gain.setValueAtTime(1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) {
            console.error('Web audio beep failed', e);
        }
    };

    useEffect(() => {
        fetchOrders();

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const hubConnection = new signalR.HubConnectionBuilder()
            .withUrl(`${apiUrl}/kitchenHub`)
            .withAutomaticReconnect()
            .build();

        hubConnection.on('NewOrder', () => {
            webAudioBeep();
            fetchOrders();
        });

        hubConnection.on('OrderStatusChanged', () => {
            fetchOrders();
        });

        hubConnection.start().catch(err => console.error('SignalR Connection Error: ', err));

        return () => {
            hubConnection.stop();
        };
    }, []);

    const [auditModalOpen, setAuditModalOpen] = useState(false);
    const [auditHistory, setAuditHistory] = useState<any[]>([]);
    const [selectedOrderNumber, setSelectedOrderNumber] = useState<number | null>(null);

    const openAuditModal = async (orderId: string, orderNumber: number) => {
        try {
            const token = localStorage.getItem('padelq_token');
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const response = await fetch(`${apiUrl}/api/kitchen-orders/${orderId}/audit`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setAuditHistory(data);
                setSelectedOrderNumber(orderNumber);
                setAuditModalOpen(true);
            }
        } catch (error) {
            console.error('Error fetching audit history', error);
        }
    };

    const pendientes = orders.filter(o => o.status === 'Pending');
    const enPreparacion = orders.filter(o => o.status === 'Preparing');
    const listos = orders.filter(o => o.status === 'Ready');

    const renderColumn = (title: string, columnOrders: any[], nextStatus: string | null) => (
        <div className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-black/5 min-h-[500px]">
            <h2 className="text-xl font-black italic uppercase mb-4 text-center border-b pb-2">{title} ({columnOrders.length})</h2>
            <div className="space-y-4">
                {columnOrders.map(order => (
                    <div key={order.id} className="p-4 border rounded-lg bg-zinc-50 shadow-sm flex flex-col gap-2">
                        <div className="flex justify-between items-center font-bold text-sm">
                            <span>Pedido #{order.orderNumber}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-zinc-500 text-xs">{parseUtcDate(order.createdAt).toLocaleTimeString('es-AR')}</span>
                                <button 
                                    onClick={() => openAuditModal(order.id, order.orderNumber)}
                                    className="p-1 bg-slate-200 rounded hover:bg-slate-300 transition-colors"
                                    title="Ver Historial"
                                >
                                    🕒
                                </button>
                            </div>
                        </div>
                        <div className="text-xs font-bold text-emerald-600 uppercase tracking-widest">{order.customerName}</div>
                        <ul className="text-sm space-y-1 mb-2">
                            {order.items?.map((item: any, idx: number) => (
                                <li key={idx} className="flex justify-between">
                                    <span className="flex flex-col">
                                        <span><strong>{item.quantity}x</strong> {item.productName}</span>
                                        {item.notes && <span className="text-[10px] text-zinc-500 italic mt-0.5">* Obs: {item.notes}</span>}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        {nextStatus && (
                            <button
                                onClick={() => updateStatus(order.id, nextStatus)}
                                className="mt-auto bg-black text-white py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-zinc-800 transition-colors"
                            >
                                Pasar a {nextStatus === 'Preparing' ? 'En Preparación' : 'Listo'}
                            </button>
                        )}
                        {!nextStatus && (
                            <button
                                onClick={() => updateStatus(order.id, 'Delivered')}
                                className="mt-auto bg-emerald-600 text-white py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition-colors"
                            >
                                Marcar Entregado
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="p-10 bg-[#fafafa] min-h-screen font-oak space-y-6 relative">
            <Header />
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black text-black tracking-tight uppercase italic">Cocina</h1>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Gestión de Pedidos</p>
                </div>
                <button 
                    onClick={() => { fetchHistory(); setHistoryModalOpen(true); }}
                    className="bg-black text-white px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-zinc-800 transition-colors flex items-center gap-2"
                >
                    <span>🕒 Historial</span>
                </button>
            </div>
            
            <div className="flex gap-6 overflow-x-auto">
                {renderColumn('Pendientes', pendientes, 'Preparing')}
                {renderColumn('En Preparación', enPreparacion, 'Ready')}
                {renderColumn('Listos', listos, null)}
            </div>

            {auditModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-black uppercase italic">Historial Pedido #{selectedOrderNumber}</h2>
                            <button onClick={() => setAuditModalOpen(false)} className="text-xl font-bold p-2">&times;</button>
                        </div>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {auditHistory.map((audit: any, idx: number) => (
                                <div key={idx} className="p-3 bg-slate-50 border rounded-lg text-sm">
                                    <div className="flex justify-between font-bold mb-1">
                                        <span className="uppercase">{audit.toStatus}</span>
                                        <span className="text-slate-500">{parseUtcDate(audit.changedAt).toLocaleTimeString('es-AR')}</span>
                                    </div>
                                    <div className="text-slate-600">
                                        Cambio realizado por: <strong className="text-black">{audit.changedBy}</strong>
                                    </div>
                                </div>
                            ))}
                            {auditHistory.length === 0 && (
                                <div className="text-slate-500 text-center py-4">No hay historial disponible.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {historyModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-end z-50">
                    <div className="bg-white h-full w-full max-w-lg shadow-2xl p-6 overflow-y-auto flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-2xl font-black uppercase italic">Historial de Entregados</h2>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Pedidos completados</p>
                            </div>
                            <button onClick={() => setHistoryModalOpen(false)} className="text-3xl font-black p-2">&times;</button>
                        </div>
                        
                        <div className="flex gap-4 mb-6 bg-zinc-50 p-4 rounded-xl border">
                            <div className="flex-1">
                                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Desde</label>
                                <input 
                                    type="date" 
                                    value={historyStartDate}
                                    onChange={(e) => {
                                        setHistoryStartDate(e.target.value);
                                        fetchHistory(e.target.value, historyEndDate);
                                    }}
                                    className="w-full p-2 border rounded font-bold text-sm bg-white"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Hasta</label>
                                <input 
                                    type="date" 
                                    value={historyEndDate}
                                    onChange={(e) => {
                                        setHistoryEndDate(e.target.value);
                                        fetchHistory(historyStartDate, e.target.value);
                                    }}
                                    className="w-full p-2 border rounded font-bold text-sm bg-white"
                                />
                            </div>
                        </div>

                        <div className="space-y-4 flex-1">
                            {historyOrders.map(order => (
                                <div key={order.id} className="p-4 border rounded-xl bg-zinc-50 shadow-sm flex flex-col gap-2">
                                    <div className="flex justify-between items-center font-bold text-sm">
                                        <span>Pedido #{order.orderNumber}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-zinc-500 text-xs">
                                                {parseUtcDate((order as any).completedAt || order.createdAt).toLocaleTimeString('es-AR')}
                                            </span>
                                            <button 
                                                onClick={() => openAuditModal(order.id, order.orderNumber)}
                                                className="p-1 bg-slate-200 rounded hover:bg-slate-300 transition-colors"
                                                title="Ver Historial"
                                            >
                                                🕒
                                            </button>
                                        </div>
                                    </div>
                                    <div className="text-xs font-bold text-emerald-600 uppercase tracking-widest">{order.customerName}</div>
                                    <ul className="text-sm space-y-1 mt-2 border-t pt-2 border-black/5">
                                        {order.items?.map((item: any, idx: number) => (
                                            <li key={idx} className="flex justify-between text-zinc-600">
                                                <span className="flex flex-col">
                                        <span><strong>{item.quantity}x</strong> {item.productName}</span>
                                        {item.notes && <span className="text-[10px] text-zinc-500 italic mt-0.5">* Obs: {item.notes}</span>}
                                    </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                            {historyOrders.length === 0 && (
                                <div className="text-slate-500 text-center py-10 font-bold uppercase tracking-widest text-sm">No hay pedidos entregados recientes.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KitchenOrders;
