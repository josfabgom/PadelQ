import React, { useState, useEffect } from 'react';
import api, { getAuthConfig } from '../api/api';
import { 
  DollarSign, Clock, User, Package, ChevronDown, ChevronUp, Box
} from 'lucide-react';

interface CashClosureReport {
  id: number;
  openingDate: string;
  closingDate: string | null;
  openedBy: string;
  isOpen: boolean;
  rentalsTotal: number;
  consumptionsTotal: number;
  totalRevenue: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  totalCashSales: number;
  totalCardSales: number;
  totalTransferSales: number;
  totalOtherSales: number;
}

interface ProductSale {
  productId: number;
  productName: string;
  category: string;
  totalQuantity: number;
  totalRevenue: number;
}

interface ReportsByCashRegisterProps {
  dateRange: { start: string; end: string };
}

const ReportsByCashRegister: React.FC<ReportsByCashRegisterProps> = ({ dateRange }) => {
  const [closures, setClosures] = useState<CashClosureReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [productsCache, setProductsCache] = useState<Record<number, ProductSale[]>>({});
  const [loadingProducts, setLoadingProducts] = useState(false);

  const fetchClosures = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/reports/sales-by-closure?startDate=${dateRange.start}&endDate=${dateRange.end}&limit=50`, getAuthConfig());
      setClosures(res.data);
    } catch (err) {
      console.error("Error fetching closures", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClosures();
  }, [dateRange]);

  const handleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    
    if (!productsCache[id]) {
      try {
        setLoadingProducts(true);
        const res = await api.get(`/api/reports/closure-products/${id}`, getAuthConfig());
        setProductsCache(prev => ({ ...prev, [id]: res.data }));
      } catch (err) {
        console.error("Error fetching products", err);
      } finally {
        setLoadingProducts(false);
      }
    }
  };

  if (loading) {
    return <div className="p-10 text-center font-black uppercase tracking-widest text-zinc-400">Cargando cajas...</div>;
  }

  if (closures.length === 0) {
    return (
      <div className="bg-white rounded-[40px] border border-black/5 p-16 text-center shadow-sm">
        <DollarSign className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
        <h3 className="text-xl font-black uppercase italic tracking-tight text-zinc-400">No hay cajas registradas</h3>
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300 mt-2">Abre una caja para empezar a registrar ventas</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {closures.map(closure => (
        <div key={closure.id} className="bg-white rounded-[40px] border border-black/5 shadow-sm overflow-hidden transition-all">
          <div 
            className="p-8 cursor-pointer hover:bg-zinc-50 flex flex-col md:flex-row md:items-center justify-between gap-6"
            onClick={() => handleExpand(closure.id)}
          >
            <div className="flex items-center gap-6">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${closure.isOpen ? 'bg-emerald-50 text-emerald-500' : 'bg-black text-white'}`}>
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tight">Caja #{closure.id}</h3>
                <div className="flex items-center gap-4 mt-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  <span className="flex items-center gap-1"><User className="w-3 h-3" /> {closure.openedBy}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(closure.openingDate).toLocaleString()} - {closure.closingDate ? new Date(closure.closingDate).toLocaleString() : 'ACTUAL'}</span>
                  {closure.isOpen && <span className="text-emerald-500 ml-2">ABIERTA</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-8 md:gap-12 flex-wrap">
               <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Alquileres</p>
                  <p className="text-lg font-black italic">${closure.rentalsTotal.toLocaleString()}</p>
               </div>
               <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Consumiciones</p>
                  <p className="text-lg font-black italic">${closure.consumptionsTotal.toLocaleString()}</p>
               </div>
               <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Total Recaudado</p>
                  <p className="text-2xl font-black italic">${closure.totalRevenue.toLocaleString()}</p>
               </div>
               <div>
                  {expandedId === closure.id ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
               </div>
            </div>
          </div>

          {expandedId === closure.id && (
            <div className="border-t border-zinc-100 bg-[#fafafa] p-8">
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Detalles Monetarios */}
                  <div>
                    <h4 className="text-sm font-black uppercase italic tracking-tight mb-4 flex items-center gap-2">
                       <DollarSign className="w-4 h-4" /> Desglose de Medios de Pago
                    </h4>
                    <div className="space-y-3">
                       <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-black/5">
                          <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Efectivo</span>
                          <span className="font-black italic">${closure.totalCashSales.toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-black/5">
                          <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Tarjetas</span>
                          <span className="font-black italic">${closure.totalCardSales.toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-black/5">
                          <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Transferencias</span>
                          <span className="font-black italic">${closure.totalTransferSales.toLocaleString()}</span>
                       </div>
                    </div>
                  </div>

                  {/* Detalle de Productos */}
                  <div>
                    <h4 className="text-sm font-black uppercase italic tracking-tight mb-4 flex items-center gap-2">
                       <Package className="w-4 h-4" /> Productos Vendidos en Turno
                    </h4>
                    
                    {loadingProducts ? (
                       <div className="p-6 text-center text-[10px] font-black uppercase tracking-widest text-zinc-400">Cargando...</div>
                    ) : (
                       <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                          {productsCache[closure.id] && productsCache[closure.id].length > 0 ? (
                             productsCache[closure.id].map(p => (
                                <div key={p.productId} className="flex justify-between items-center p-3 bg-white rounded-xl border border-black/5">
                                   <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center">
                                         <Box className="w-4 h-4 text-zinc-400" />
                                      </div>
                                      <div>
                                         <p className="text-xs font-black uppercase italic tracking-tight">{p.productName}</p>
                                         <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{p.category}</p>
                                      </div>
                                   </div>
                                   <div className="text-right">
                                      <p className="font-black italic">${p.totalRevenue.toLocaleString()}</p>
                                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{p.totalQuantity} unid.</p>
                                   </div>
                                </div>
                             ))
                          ) : (
                             <div className="p-6 text-center bg-white rounded-xl border border-black/5 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                No hay ventas de productos
                             </div>
                          )}
                       </div>
                    )}
                  </div>
               </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ReportsByCashRegister;
