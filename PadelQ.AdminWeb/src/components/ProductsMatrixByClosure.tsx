import React, { useState, useEffect } from 'react';
import api, { getAuthConfig } from '../api/api';
import { Package, TrendingUp } from 'lucide-react';

interface ClosureCol {
  id: number;
  label: string;
  isOpen: boolean;
  openedBy: string;
  date: string;
}

interface ProductRow {
  productId: number;
  productName: string;
  category: string;
  totalQuantity: number;
  totalRevenue: number;
  quantitiesByClosure: Record<string, number>;
}

interface MatrixData {
  closures: ClosureCol[];
  products: ProductRow[];
}

interface ProductsMatrixByClosureProps {
  dateRange: { start: string; end: string };
}

const ProductsMatrixByClosure: React.FC<ProductsMatrixByClosureProps> = ({ dateRange }) => {
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMatrix = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/reports/products-matrix-by-closure?startDate=${dateRange.start}&endDate=${dateRange.end}&limit=10`, getAuthConfig());
      setData(res.data);
    } catch (err) {
      console.error("Error fetching matrix", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix();
  }, [dateRange]);

  if (loading) {
    return <div className="p-10 text-center font-black uppercase tracking-widest text-zinc-400">Cargando matriz de productos...</div>;
  }

  if (!data || data.products.length === 0) {
    return (
      <div className="bg-white rounded-[40px] border border-black/5 p-16 text-center shadow-sm">
        <Package className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
        <h3 className="text-xl font-black uppercase italic tracking-tight text-zinc-400">No hay productos vendidos</h3>
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300 mt-2">Abre una caja y registra ventas para ver la matriz</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[40px] border border-black/5 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
         <div>
            <h3 className="text-xl font-black uppercase italic tracking-tight flex items-center gap-2">
               <Package className="w-5 h-5" /> Matriz de Productos
            </h3>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mt-1">Ranking general y desglose por los últimos {data.closures.length} turnos</p>
         </div>
      </div>
      
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-100">
              <th className="p-5 font-black uppercase italic tracking-tight text-sm text-zinc-500 whitespace-nowrap min-w-[200px]">Producto</th>
              <th className="p-5 font-black uppercase tracking-widest text-[10px] text-zinc-400 text-center min-w-[100px] border-r border-zinc-200">Total Unid.</th>
              {data.closures.map(c => (
                <th key={c.id} className="p-5 text-center min-w-[120px]">
                   <p className="font-black uppercase italic text-xs tracking-tight text-black">{c.label}</p>
                   <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mt-1">{c.date} • {c.openedBy}</p>
                   {c.isOpen && <span className="inline-block mt-1 text-[8px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Abierta</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {data.products.map((p, idx) => (
              <tr key={p.productId} className="hover:bg-zinc-50 transition-colors">
                <td className="p-5">
                   <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-md bg-black text-white flex items-center justify-center font-black italic text-[10px]">
                         #{idx + 1}
                      </div>
                      <div>
                         <p className="font-black uppercase italic tracking-tight text-sm">{p.productName}</p>
                         <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{p.category}</p>
                      </div>
                   </div>
                </td>
                <td className="p-5 text-center border-r border-zinc-100 bg-zinc-50/50">
                   <p className="font-black italic text-lg">{p.totalQuantity}</p>
                </td>
                {data.closures.map(c => {
                   const qty = p.quantitiesByClosure[c.id.toString()] || 0;
                   return (
                     <td key={c.id} className="p-5 text-center">
                        {qty > 0 ? (
                           <span className="font-black italic text-black bg-zinc-100 px-3 py-1 rounded-lg">{qty}</span>
                        ) : (
                           <span className="text-zinc-300 font-black italic">-</span>
                        )}
                     </td>
                   );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProductsMatrixByClosure;
