import React, { useState, useEffect } from 'react';
import api, { getAuthConfig } from '../api/api';
import { 
    Package, Plus, Edit2, Trash2, DollarSign, ArrowLeft, Tag, Search, X, 
    TrendingUp, TrendingDown, RefreshCcw, Camera, AlertCircle, ShoppingCart, Info,
    ChevronRight, ChevronDown, Filter, History, CheckCircle, BarChart2
} from 'lucide-react';
import Header from '../components/Header';
import { format, subDays } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { es } from 'date-fns/locale';

interface Product {
  id: number;
  internalCode?: string;
  barcode?: string;
  name: string;
  description?: string;
  finalPrice: number;
  costPrice: number;
  marginPercentage: number;
  ivaPercentage: number;
  internalTaxAmount: number;
  stock: number;
  imageUrl?: string;
  category: string;
  isActive: boolean;
  minimumStock: number;
  isDoubleUnitCombo?: boolean;
}

const formatARS = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0
    }).format(amount);
};

const calculateSuggestedPrice = (cost: number, margin: number, iva: number, tax: number) => {
    const costWithIva = cost * (1 + iva / 100);
    const baseForMargin = costWithIva + tax;
    return Math.round((baseForMargin * (1 + margin / 100)) * 100) / 100;
};

const ProductsPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  
  const roles = JSON.parse(localStorage.getItem('padelq_user_roles') || '[]');
  const isAdmin = roles.includes('Admin');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isSalesReportOpen, setIsSalesReportOpen] = useState(false);
  const [isStockAlertsOpen, setIsStockAlertsOpen] = useState(false);
  const [salesReport, setSalesReport] = useState<any[]>([]);
  const [stockAlerts, setStockAlerts] = useState<any[]>([]);
  const [reportStartDate, setReportStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportEndDate, setReportEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [companyInfo, setCompanyInfo] = useState({
    name: 'Tu Club', address: '', phone: '', email: '', website: ''
  });

  // Ranking states
  const [isRankingModalOpen, setIsRankingModalOpen] = useState(false);
  const [rankingData, setRankingData] = useState<any[]>([]);
  const [rankingStartDate, setRankingStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [rankingEndDate, setRankingEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [rankingSortColumn, setRankingSortColumn] = useState<string>('totalQuantity');
  const [rankingSortDirection, setRankingSortDirection] = useState<'asc' | 'desc'>('desc');
  const [loadingRanking, setLoadingRanking] = useState(false);
  
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [customAlert, setCustomAlert] = useState<{ title: string, message: string, type: 'success' | 'error' | 'warning' } | null>(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [stockMovements, setStockMovements] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const showAlert = (message: string, type: 'success' | 'error' | 'warning' = 'success', title?: string) => {
      setCustomAlert({
          title: title || (type === 'success' ? 'ÉXITO' : type === 'error' ? 'ERROR' : 'ATENCIÓN'),
          message,
          type
      });
  };

  const [formData, setFormData] = useState<Partial<Product>>({
    internalCode: '',
    barcode: '',
    name: '',
    description: '',
    finalPrice: 0,
    costPrice: 0,
    marginPercentage: 0,
    ivaPercentage: 21,
    internalTaxAmount: 0,
    stock: 0,
    imageUrl: '',
    category: 'Bebidas',
    isActive: true,
    minimumStock: 0,
    isDoubleUnitCombo: false
  });

  const [stockFormData, setStockFormData] = useState({
    type: 0, // 0: Purchase, 1: Adjustment
    quantity: 1,
    note: ''
  });

  const config = getAuthConfig();

  useEffect(() => {
    fetchProducts();
    fetchSystemSettings();
  }, []);

  const fetchSystemSettings = async () => {
    try {
      const res = await api.get('/api/SystemSettings', config);
      const settings = res.data;
      const info = { ...companyInfo };
      settings.forEach((s: any) => {
        if (s.key === 'CompanyName') info.name = s.value;
        if (s.key === 'CompanyAddress') info.address = s.value;
        if (s.key === 'CompanyPhone') info.phone = s.value;
        if (s.key === 'CompanyEmail') info.email = s.value;
        if (s.key === 'CompanyWebsite') info.website = s.value;
      });
      setCompanyInfo(info);
    } catch (err) {
      console.error("Error al cargar configuración de empresa", err);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/products', config);
      setProducts(response.data);
    } catch (err) {
      console.error("Error al cargar productos", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData(product);
    } else {
      setEditingProduct(null);
      setFormData({ 
        internalCode: '', 
        barcode: '', 
        name: '', 
        description: '', 
        finalPrice: 0, 
        costPrice: 0,
        marginPercentage: 0,
        ivaPercentage: 21,
        internalTaxAmount: 0,
        stock: 0,
        imageUrl: '',
        category: 'Bebidas', 
        isActive: true,
        minimumStock: 0,
        isDoubleUnitCombo: false
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenStockModal = (product: Product) => {
    setStockProduct(product);
    setStockFormData({ type: 0, quantity: 1, note: '' });
    setIsStockModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await api.put(`/api/products/${editingProduct.id}`, formData, config);
      } else {
        await api.post('/api/products', formData, config);
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (err) {
      console.error("Error al guardar producto", err);
    }
  };

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockProduct) return;

    try {
      await api.post('/api/products/movement', {
        productId: stockProduct.id,
        type: stockFormData.type,
        quantity: stockFormData.quantity,
        note: stockFormData.note
      }, config);
      
      setIsStockModalOpen(false);
      fetchProducts();
    } catch (err) {
      console.error("Error al registrar movimiento", err);
    }
  };

  const fetchSalesReport = async () => {
    try {
      const response = await api.get(`/api/reports/product-sales-daily?startDate=${reportStartDate}&endDate=${reportEndDate}`, config);
      setSalesReport(response.data);
      setIsSalesReportOpen(true);
    } catch (err) {
      console.error("Error al cargar reporte de ventas", err);
    }
  };

  const fetchRankingData = async () => {
    try {
      setLoadingRanking(true);
      const response = await api.get(`/api/reports/products-ranking-by-day?startDate=${rankingStartDate}&endDate=${rankingEndDate}`, config);
      setRankingData(response.data);
      if (!isRankingModalOpen) setIsRankingModalOpen(true);
    } catch (err) {
      console.error("Error al cargar ranking", err);
      showAlert("Error al cargar el ranking de ventas.", "error");
    } finally {
      setLoadingRanking(false);
    }
  };

  const handleSortRanking = (column: string) => {
    if (rankingSortColumn === column) {
      setRankingSortDirection(rankingSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setRankingSortColumn(column);
      setRankingSortDirection('desc');
    }
  };

  const getSortedRankingData = () => {
    return [...rankingData].sort((a, b) => {
      const valA = a[rankingSortColumn] || 0;
      const valB = b[rankingSortColumn] || 0;
      if (valA < valB) return rankingSortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return rankingSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const fetchStockAlerts = async () => {
    try {
      const response = await api.get('/api/reports/stock-alerts', config);
      setStockAlerts(response.data);
      setIsStockAlertsOpen(true);
    } catch (err) {
      console.error("Error al cargar alertas de stock", err);
    }
  };

  const generateSalesReportPDF = () => {
    try {
      const doc = new jsPDF();
      const isRecent = salesReport.length > 0 && salesReport[0].isRecentOnly;
      
      // Header
      doc.setFillColor(30, 30, 30);
      doc.rect(0, 0, 210, 45, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text(companyInfo.name.toUpperCase(), 15, 20);
      
      doc.setFontSize(14);
      doc.text('REPORTE DE VENTAS', 15, 30);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(200, 200, 200);
      const headerInfo = [
        companyInfo.address,
        companyInfo.phone ? `Tel: ${companyInfo.phone}` : '',
        companyInfo.email
      ].filter(Boolean).join(' | ');
      doc.text(headerInfo, 15, 38);
      
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      const dateText = isRecent 
        ? 'MOSTRANDO ÚLTIMOS 7 DÍAS (ACUMULADO)' 
        : `FECHA: ${format(new Date(reportStartDate + 'T00:00:00'), 'dd/MM/yyyy')} al ${format(new Date(reportEndDate + 'T00:00:00'), 'dd/MM/yyyy')}`;
      doc.text(dateText, 195, 38, { align: 'right' });
      
      const tableData = salesReport.map(sale => [
        sale.productName,
        sale.category,
        sale.totalQuantity.toString(),
        formatARS(sale.totalRevenue),
        formatARS(sale.totalRevenue - sale.totalCost)
      ]);
      
      autoTable(doc, {
        startY: 50,
        head: [['Producto', 'Categoría', 'Cant.', 'Recaudado', 'Utilidad']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        styles: { fontSize: 9, cellPadding: 5 },
        columnStyles: {
          2: { halign: 'center' },
          3: { halign: 'right' },
          4: { halign: 'right', fontStyle: 'bold' }
        }
      });
      
      const finalY = (doc as any).lastAutoTable.finalY;
      const totalRevenue = salesReport.reduce((acc, s) => acc + s.totalRevenue, 0);
      const totalUtility = salesReport.reduce((acc, s) => acc + (s.totalRevenue - s.totalCost), 0);
      
      doc.setFontSize(12);
      doc.setTextColor(30, 30, 30);
      doc.text(`TOTAL RECAUDADO: ${formatARS(totalRevenue)}`, 140, finalY + 15, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(`UTILIDAD ESTIMADA: ${formatARS(totalUtility)}`, 140, finalY + 22, { align: 'right' });
      
      doc.save(`Reporte_Ventas_${reportStartDate}_al_${reportEndDate}.pdf`);
    } catch (error) {
      console.error("Error al generar PDF de ventas:", error);
      alert("Hubo un error al generar el PDF. Revisa la consola.");
    }
  };

  const generateStockAlertsPDF = () => {
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFillColor(225, 29, 72); // Rose 600
      doc.rect(0, 0, 210, 45, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text(companyInfo.name.toUpperCase(), 15, 20);
      
      doc.setFontSize(14);
      doc.text('SUGERENCIA DE COMPRA', 15, 30);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(255, 200, 200);
      const headerInfo = [
        companyInfo.address,
        companyInfo.phone ? `Tel: ${companyInfo.phone}` : '',
        companyInfo.email
      ].filter(Boolean).join(' | ');
      doc.text(headerInfo, 15, 38);
      
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text(`GENERADO EL: ${format(new Date(), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}`, 195, 38, { align: 'right' });
      
      const tableData = stockAlerts.map(alert => [
        alert.name,
        alert.category,
        alert.stock.toString(),
        alert.weeklySales.toString(),
        alert.minimumStock.toString(),
        `+${alert.needed}`
      ]);
      
      autoTable(doc, {
        startY: 50,
        head: [['Producto', 'Categoría', 'Stock', 'Vtas(7d)', 'Mín.', 'Sugerido']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 6 },
        columnStyles: {
          2: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'center', fontStyle: 'bold', textColor: [22, 163, 74] } // Emerald 600
        }
      });
      
      doc.save(`Sugerencia_Compra_${format(new Date(), 'yyyyMMdd')}.pdf`);
    } catch (error) {
      console.error("Error al generar PDF de stock:", error);
      alert("Hubo un error al generar el PDF. Revisa la consola.");
    }
  };

  const generateKardexPDF = () => {
    if (!historyProduct || stockMovements.length === 0) return;
    try {
      const doc = new jsPDF();
      doc.text(`Ficha de Stock (Kardex) - ${historyProduct.name}`, 14, 20);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generado: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 28);
      
      const tableData = stockMovements.map(mov => {
        const typeLabel = mov.type === 0 ? 'COMPRA' : mov.type === 1 ? 'AJUSTE' : 'VENTA';
        const date = format(new Date(mov.createdAt), "dd/MM/yyyy HH:mm");
        const inQ = mov.inQuantity > 0 ? `+${mov.inQuantity}` : '-';
        const outQ = mov.outQuantity > 0 ? `-${mov.outQuantity}` : '-';
        const concept = `${typeLabel}: ${mov.note || 'Sin obs'}`;
        return [date, concept, inQ, outQ, mov.balance.toString()];
      });

      autoTable(doc, {
        startY: 35,
        head: [['Fecha', 'Concepto', 'Entrada', 'Salida', 'Saldo']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: {
          2: { halign: 'center', textColor: [22, 163, 74] }, // Emerald
          3: { halign: 'center', textColor: [225, 29, 72] }, // Rose
          4: { halign: 'center', fontStyle: 'bold' }
        }
      });
      
      doc.save(`Kardex_${historyProduct.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    } catch (error) {
      console.error("Error al generar PDF de Kardex:", error);
      alert("Hubo un error al generar el PDF. Revisa la consola.");
    }
  };

  const executeDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      setIsDeleting(true);
      await api.delete(`/api/products/${productToDelete.id}`, config);
      showAlert("Producto eliminado con éxito.");
      setProductToDelete(null);
      fetchProducts();
    } catch (err: any) {
      console.error("Error al eliminar producto", err);
      const errorMsg = err.response?.data?.message || err.response?.data || "No se pudo eliminar el producto";
      showAlert(typeof errorMsg === 'string' ? errorMsg : "Error al eliminar producto", 'error');
      setProductToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenHistory = async (product: Product) => {
    setHistoryProduct(product);
    setStockMovements([]);
    setIsHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const response = await api.get(`/api/products/${product.id}/movements`, config);
      setStockMovements(response.data);
    } catch (error) {
      console.error('Error fetching stock history:', error);
      alert('No se pudo cargar el historial.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const categories = ['Todas', ...Array.from(new Set(products.map(p => p.category)))];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.barcode?.includes(searchQuery) ||
                         p.internalCode?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'Todas' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-8 space-y-8 bg-[#FAFAFA] min-h-screen font-outfit">
      <Header />
      
      {/* Page Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div className="flex items-center gap-6">
          <a href="/dashboard" className="p-4 bg-white rounded-3xl border border-black/5 shadow-sm hover:scale-105 active:scale-95 transition-all duration-300 group">
            <ArrowLeft className="w-5 h-5 text-black group-hover:-translate-x-1 transition-transform" />
          </a>
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight uppercase italic">Catálogo y Stock</h1>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">CONTROL INTEGRAL DE PRODUCTOS E INVENTARIO</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 w-full xl:w-auto">
          <div className="relative flex-1 md:min-w-[400px]">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
             <input 
                type="text" 
                placeholder="Buscar por nombre, código o código de barras..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-4 bg-white border border-black/5 rounded-2xl outline-none focus:ring-2 focus:ring-black/10 font-medium text-sm shadow-sm"
             />
          </div>
          <a 
            href="/purchase-reception"
            className="flex items-center gap-3 px-6 py-4 bg-white border border-black/5 text-black rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-zinc-50 transition-all active:scale-95"
          >
            <ShoppingCart className="w-5 h-5 text-emerald-500" />
            Cargar Compra
          </a>
          <button 
            onClick={() => fetchProducts()}

            disabled={loading}
            className="p-4 bg-white border border-black/5 rounded-2xl shadow-sm hover:bg-zinc-50 transition-all active:scale-95 disabled:opacity-50"
            title="Refrescar listado"
          >
            <RefreshCcw className={`w-5 h-5 text-black ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button 
            onClick={fetchSalesReport}
            className="flex items-center gap-3 px-6 py-4 bg-white border border-black/5 text-black rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-zinc-50 transition-all active:scale-95"
          >
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Ventas Diarias
          </button>

          <button 
            onClick={fetchRankingData}
            className="flex items-center gap-3 px-6 py-4 bg-white border border-black/5 text-black rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-zinc-50 transition-all active:scale-95"
          >
            <BarChart2 className="w-5 h-5 text-purple-500" />
            Ranking Semanal
          </button>

          <button 
            onClick={fetchStockAlerts}
            className="flex items-center gap-3 px-6 py-4 bg-white border border-black/5 text-black rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-zinc-50 transition-all active:scale-95"
          >
            <AlertCircle className="w-5 h-5 text-rose-500" />
            Quiebre de Stock
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-3 px-8 py-4 bg-black text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-black/20 hover:bg-zinc-800 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
              selectedCategory === cat 
              ? 'bg-black text-white border-black shadow-md' 
              : 'bg-white text-zinc-400 border-zinc-100 hover:border-black/20'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-96 gap-4 bg-white rounded-[40px] border border-black/5">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-100 border-t-black"></div>
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Sincronizando inventario...</p>
        </div>
      ) : (
        <div className="bg-white rounded-[40px] border border-black/5 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 border-b border-zinc-100">
                  <th className="px-8 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Producto</th>
                  <th className="px-6 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Códigos</th>
                  <th className="px-6 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Stock</th>
                  <th className="px-6 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Precio Costo</th>
                  <th className="px-6 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Precio Venta</th>
                  <th className="px-6 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Rentabilidad</th>
                  <th className="px-8 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredProducts.map((product) => {
                  const profit = product.finalPrice - product.costPrice;
                  const profitMargin = product.costPrice > 0 ? (profit / product.costPrice) * 100 : 0;
                  
                  return (
                    <tr key={product.id} className="hover:bg-zinc-50/50 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-zinc-100 border border-zinc-200 overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform">
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-6 h-6 text-zinc-300" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-black text-black italic leading-tight">{product.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest leading-none">{product.category}</p>
                              {product.isDoubleUnitCombo && (
                                <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 rounded-md text-[7px] font-black uppercase tracking-tighter">COMBO X2</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500">
                            <Tag className="w-3 h-3" /> {product.internalCode || 'S/C'}
                          </div>
                          <div className="text-[9px] font-medium text-zinc-400 font-mono">
                            {product.barcode || 'Sin CB'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className={`px-4 py-1.5 rounded-xl text-xs font-black italic flex items-center gap-2 ${
                            product.stock <= product.minimumStock ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          }`}>
                            {product.stock} <span className="text-[9px] opacity-60">uds</span>
                          </div>
                          {product.stock <= product.minimumStock && (
                            <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1">
                              <AlertCircle className="w-2.5 h-2.5" /> Stock Bajo
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm font-bold text-zinc-500">{formatARS(product.costPrice)}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-base font-black italic text-black tracking-tight">{formatARS(product.finalPrice)}</span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                           <span className={`text-[10px] font-black ${profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                             {profit >= 0 ? '+' : ''}{formatARS(profit)}
                           </span>
                           <span className="text-[9px] font-bold text-zinc-400">
                             {profitMargin.toFixed(0)}% margen
                           </span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleOpenHistory(product)}
                            className="p-3 bg-indigo-50 hover:bg-indigo-600 hover:text-white rounded-xl transition-all text-indigo-400"
                            title="Historial de Movimientos"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleOpenStockModal(product)}
                            className="p-3 bg-zinc-100 hover:bg-black hover:text-white rounded-xl transition-all text-zinc-500"
                            title="Gestionar Stock"
                          >
                            <RefreshCcw className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleOpenModal(product)}
                            className="p-3 bg-zinc-100 hover:bg-black hover:text-white rounded-xl transition-all text-zinc-500"
                            title="Editar Datos"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <button 
                              onClick={() => setProductToDelete(product)}
                              className="p-3 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-xl transition-all text-rose-400"
                              title="Dar de Baja"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {filteredProducts.length === 0 && (
            <div className="py-24 text-center">
                <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Package className="w-10 h-10 text-zinc-200" />
                </div>
                <p className="text-zinc-400 font-black uppercase tracking-[0.3em] text-xs italic">No se encontraron productos en el inventario</p>
                <button onClick={() => setSearchQuery('')} className="mt-4 text-black font-black uppercase text-[10px] tracking-widest border-b-2 border-black">Limpiar búsqueda</button>
            </div>
          )}
        </div>
      )}

      {/* Main Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-50 p-6 overflow-y-auto">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl my-auto animate-in fade-in zoom-in duration-300 border border-black/5">
            <div className="p-8 bg-gradient-to-br from-zinc-800 to-black text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32"></div>
              <button onClick={() => setIsModalOpen(false)} className="absolute right-6 top-6 p-3 hover:bg-white/10 rounded-2xl transition-colors z-10">
                <X className="w-5 h-5" />
              </button>
              <div className="relative z-10 flex items-center gap-6">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black italic uppercase tracking-tight leading-none mb-1">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>
                  <p className="text-white/40 text-[9px] font-black uppercase tracking-[0.3em]">FICHA TÉCNICA Y PRECIOS</p>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2 col-span-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nombre del Producto</label>
                        <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-5 py-3 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-4 focus:ring-black/5 outline-none font-bold text-sm" placeholder="Ej: Coca Cola" required />
                     </div>
                     <div className="space-y-2 col-span-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Descripción</label>
                        <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-5 py-3 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-4 focus:ring-black/5 outline-none font-bold text-sm min-h-[60px] resize-none" placeholder="Descripción detallada..." />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Cód. Interno</label>
                        <input type="text" value={formData.internalCode} onChange={(e) => setFormData({...formData, internalCode: e.target.value})} className="w-full px-5 py-3 bg-zinc-50 border border-zinc-100 rounded-xl outline-none font-bold text-sm" placeholder="BEB-01" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Barras</label>
                        <input type="text" value={formData.barcode} onChange={(e) => setFormData({...formData, barcode: e.target.value})} className="w-full px-5 py-3 bg-zinc-50 border border-zinc-100 rounded-xl outline-none font-bold text-sm" placeholder="779..." />
                     </div>
                     <div className="space-y-2 col-span-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Categoría</label>
                        <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full px-5 py-3 bg-zinc-50 border border-zinc-100 rounded-xl outline-none font-black text-sm italic appearance-none">
                            <option value="Bebidas">Bebidas</option>
                            <option value="Comida">Comida</option>
                            <option value="Snacks">Snacks</option>
                            <option value="Indumentaria">Indumentaria</option>
                            <option value="Pelotas/Padel">Pelotas/Padel</option>
                            <option value="Otros">Otros</option>
                        </select>
                     </div>
                     <div className="space-y-2 col-span-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Imagen (URL)</label>
                        <div className="flex gap-4">
                            <input type="text" value={formData.imageUrl} onChange={(e) => setFormData({...formData, imageUrl: e.target.value})} className="w-full px-5 py-3 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-4 focus:ring-black/5 outline-none font-bold text-sm" placeholder="https://..." />
                            <div className="w-11 h-11 rounded-xl bg-zinc-50 border-2 border-dashed border-zinc-200 flex items-center justify-center overflow-hidden shrink-0">
                                {formData.imageUrl ? <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" /> : <Camera className="w-4 h-4 text-zinc-300" />}
                            </div>
                        </div>
                     </div>
                  </div>
                </div>

                {/* Right Column: Pricing & Logistics */}
                <div className="space-y-4">
                  <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-3">
                    {isAdmin && (
                      <>
                        <div className="flex items-center justify-between gap-4">
                          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2"><DollarSign className="w-3 h-3" /> Estructura de Precio</label>
                          <button type="button" onClick={() => {
                              const suggested = calculateSuggestedPrice(formData.costPrice || 0, formData.marginPercentage || 0, formData.ivaPercentage || 0, formData.internalTaxAmount || 0);
                              setFormData({...formData, finalPrice: suggested});
                          }} className="text-[9px] font-black text-emerald-600 uppercase tracking-widest border-b border-emerald-600 hover:text-emerald-500 transition-colors whitespace-nowrap">
                            Calcular Sugerido
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-zinc-500 uppercase">Costo ($)</label>
                            <input type="number" value={formData.costPrice === 0 ? '' : formData.costPrice} onChange={(e) => {
                                const val = Number(e.target.value);
                                const finalP = calculateSuggestedPrice(val, formData.marginPercentage || 0, formData.ivaPercentage || 0, formData.internalTaxAmount || 0);
                                setFormData({...formData, costPrice: val, finalPrice: finalP});
                            }} className="w-full px-2 py-2 bg-white border border-zinc-200 rounded-lg outline-none font-black text-xs" step="0.01" required />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-zinc-500 uppercase">IVA (%)</label>
                            <select value={formData.ivaPercentage || 0} onChange={(e) => {
                                const val = Number(e.target.value);
                                const finalP = calculateSuggestedPrice(formData.costPrice || 0, formData.marginPercentage || 0, val, formData.internalTaxAmount || 0);
                                setFormData({...formData, ivaPercentage: val, finalPrice: finalP});
                            }} className="w-full px-1 py-2 bg-white border border-zinc-200 rounded-lg outline-none font-black text-xs appearance-none">
                                <option value={0}>0%</option>
                                <option value={10.5}>10.5</option>
                                <option value={21}>21%</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-zinc-500 uppercase">Imp. Int</label>
                            <input type="number" value={formData.internalTaxAmount === 0 ? '' : formData.internalTaxAmount} onChange={(e) => {
                                const val = Number(e.target.value);
                                const finalP = calculateSuggestedPrice(formData.costPrice || 0, formData.marginPercentage || 0, formData.ivaPercentage || 0, val);
                                setFormData({...formData, internalTaxAmount: val, finalPrice: finalP});
                            }} className="w-full px-2 py-2 bg-white border border-zinc-200 rounded-lg outline-none font-black text-xs" step="0.01" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-zinc-500 uppercase">Margen (%)</label>
                            <input type="number" value={formData.marginPercentage === 0 ? '' : formData.marginPercentage} onChange={(e) => {
                                const val = Number(e.target.value);
                                const finalP = calculateSuggestedPrice(formData.costPrice || 0, val, formData.ivaPercentage || 0, formData.internalTaxAmount || 0);
                                setFormData({...formData, marginPercentage: val, finalPrice: finalP});
                            }} className="w-full px-2 py-2 bg-white border border-zinc-200 rounded-lg outline-none font-black text-xs" step="0.01" />
                          </div>
                        </div>
                      </>
                    )}
                    <div className={`pt-3 flex flex-row items-center justify-between gap-4 ${isAdmin ? 'mt-3 border-t border-zinc-200' : ''}`}>
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Precio Final</p>
                      </div>
                      <div className="relative w-1/2">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 w-3 h-3" />
                        <input 
                          type="number" 
                          value={formData.finalPrice === 0 ? '' : formData.finalPrice}
                          onChange={(e) => setFormData({...formData, finalPrice: Number(e.target.value)})}
                          className="w-full pl-8 pr-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg outline-none font-black text-sm italic text-emerald-600"
                          step="0.01"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Stock Actual</label>
                      <input type="number" value={formData.stock} onChange={(e) => setFormData({...formData, stock: Number(e.target.value)})} className="w-full px-5 py-3 bg-zinc-50 border border-zinc-100 rounded-xl outline-none font-bold text-sm" placeholder="0" disabled={!!editingProduct} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Stock Mínimo</label>
                      <input type="number" value={formData.minimumStock} onChange={(e) => setFormData({...formData, minimumStock: Number(e.target.value)})} className="w-full px-5 py-3 bg-rose-50/30 border border-rose-100 rounded-xl outline-none font-bold text-sm text-rose-600" placeholder="5" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Activo</span>
                      <button type="button" onClick={() => setFormData({...formData, isActive: !formData.isActive})} className={`w-10 h-5 rounded-full relative transition-all ${formData.isActive ? 'bg-emerald-500' : 'bg-zinc-300'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${formData.isActive ? 'right-0.5' : 'left-0.5'}`}></div>
                      </button>
                    </div>
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Combo x2</span>
                      <button type="button" onClick={() => setFormData({...formData, isDoubleUnitCombo: !formData.isDoubleUnitCombo})} className={`w-10 h-5 rounded-full relative transition-all ${formData.isDoubleUnitCombo ? 'bg-emerald-500' : 'bg-zinc-300'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${formData.isDoubleUnitCombo ? 'right-0.5' : 'left-0.5'}`}></div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-zinc-100 text-zinc-400 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-zinc-200 transition-colors">Cancelar</button>
                <button type="submit" className="flex-[2] py-4 bg-black text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-black/20 hover:bg-zinc-800 transition-all active:scale-95">{editingProduct ? 'Actualizar Producto' : 'Registrar Producto'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Management Modal */}
      {isStockModalOpen && stockProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-[60] p-6">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-300">
            <div className="p-8 bg-zinc-900 text-white relative">
              <button onClick={() => setIsStockModalOpen(false)} className="absolute right-8 top-8 p-3 hover:bg-white/10 rounded-2xl transition-colors">
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                  <RefreshCcw className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-xl font-black italic uppercase tracking-tight">Gestión de Stock</h2>
                  <p className="text-emerald-400/60 text-[9px] font-black uppercase tracking-widest">Movimiento de Inventario</p>
                </div>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Producto</p>
                <p className="font-black italic text-sm">{stockProduct.name}</p>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
                  <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Stock Actual</span>
                  <span className="text-lg font-black italic text-emerald-400">{stockProduct.stock} uds</span>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleStockSubmit} className="p-8 space-y-6">
              <div className="flex bg-zinc-100 p-1.5 rounded-2xl">
                <button 
                  type="button"
                  onClick={() => setStockFormData({...stockFormData, type: 0})}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${stockFormData.type === 0 ? 'bg-white text-emerald-600 shadow-md' : 'text-zinc-400'}`}
                >
                  <TrendingUp className="w-3.5 h-3.5" /> Compra
                </button>
                <button 
                  type="button"
                  onClick={() => setStockFormData({...stockFormData, type: 1})}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${stockFormData.type === 1 ? 'bg-white text-amber-600 shadow-md' : 'text-zinc-400'}`}
                >
                  <Info className="w-3.5 h-3.5" /> Ajuste
                </button>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Cantidad a {stockFormData.type === 0 ? 'Ingresar' : 'Ajustar'}</label>
                <div className="flex items-center gap-6">
                  <button 
                    type="button"
                    onClick={() => setStockFormData({...stockFormData, quantity: stockFormData.quantity - 1})}
                    className="w-14 h-14 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center font-black text-xl hover:bg-rose-50 hover:text-rose-600 transition-all"
                  >
                    -
                  </button>
                  <input 
                    type="number" 
                    value={stockFormData.quantity}
                    onChange={(e) => setStockFormData({...stockFormData, quantity: Number(e.target.value)})}
                    className="flex-1 h-14 bg-zinc-50 border border-zinc-100 rounded-2xl text-center font-black text-2xl outline-none"
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setStockFormData({...stockFormData, quantity: stockFormData.quantity + 1})}
                    className="w-14 h-14 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center font-black text-xl hover:bg-emerald-50 hover:text-emerald-600 transition-all"
                  >
                    +
                  </button>
                </div>
                <p className="text-[9px] font-bold text-zinc-400 italic text-center">
                  {stockFormData.type === 0 
                    ? "Registra un ingreso por compra (suma al stock)" 
                    : "Ajuste manual (puedes usar números negativos para restar)"}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Nota / Motivo</label>
                <input 
                  type="text" 
                  value={stockFormData.note}
                  onChange={(e) => setStockFormData({...stockFormData, note: e.target.value})}
                  className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none font-bold text-sm"
                  placeholder="Ej: Compra a Proveedor X"
                />
              </div>

              <button 
                type="submit"
                className="w-full py-5 bg-black text-white rounded-[24px] font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl shadow-black/20 hover:bg-zinc-800 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                Confirmar Movimiento
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Daily Sales Report Modal */}
      {isSalesReportOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-[70] p-6 overflow-y-auto">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-3xl my-auto animate-in fade-in zoom-in duration-300 border border-black/5">
            <div className="p-8 bg-zinc-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                  <TrendingUp className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-black italic uppercase tracking-tight">Reporte de Ventas</h2>
                  <p className="text-blue-400/60 text-[9px] font-black uppercase tracking-widest">Lo que más sale hoy</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-white/10 border border-white/10 rounded-xl px-4 py-2">
                  <span className="text-[10px] font-bold text-white/50 uppercase">Desde</span>
                  <input 
                    type="date" 
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                    onBlur={fetchSalesReport}
                    className="bg-transparent text-xs font-bold outline-none text-white [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  />
                </div>
                <div className="flex items-center gap-2 bg-white/10 border border-white/10 rounded-xl px-4 py-2">
                  <span className="text-[10px] font-bold text-white/50 uppercase">Hasta</span>
                  <input 
                    type="date" 
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                    onBlur={fetchSalesReport}
                    className="bg-transparent text-xs font-bold outline-none text-white [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  />
                </div>
                <button onClick={() => setIsSalesReportOpen(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-8">
              {salesReport.length > 0 ? (
                <div className="space-y-4">
                  {salesReport.length > 0 && salesReport[0].isRecentOnly && (
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-3">
                      <Info className="w-5 h-5 text-blue-500" />
                      <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">
                        Sin ventas hoy. Mostrando acumulado de los últimos 7 días.
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                    <div className="col-span-6">Producto</div>
                    <div className="col-span-2 text-center">Cant.</div>
                    <div className="col-span-2 text-right">Recaudado</div>
                    <div className="col-span-2 text-right">Utilidad</div>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto pr-2 space-y-2">
                    {salesReport.map((sale, i) => {
                      const utility = sale.totalRevenue - sale.totalCost;
                      return (
                        <div key={i} className="grid grid-cols-12 gap-4 items-center p-4 bg-zinc-50 rounded-2xl border border-zinc-100 hover:border-blue-200 transition-colors">
                          <div className="col-span-6">
                            <p className="font-black italic text-sm">{sale.productName}</p>
                            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{sale.category}</p>
                          </div>
                          <div className="col-span-2 text-center">
                            <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg font-black text-xs">
                              {sale.totalQuantity}
                            </span>
                          </div>
                          <div className="col-span-2 text-right font-bold text-zinc-600">
                            {formatARS(sale.totalRevenue)}
                          </div>
                          <div className="col-span-2 text-right font-black text-emerald-500 italic">
                            {formatARS(utility)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-zinc-100">
                    <button 
                      onClick={generateSalesReportPDF}
                      className="col-span-2 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-500/20"
                    >
                      Descargar Reporte PDF
                    </button>
                    <div className="p-6 bg-zinc-900 rounded-3xl text-white border border-white/5">
                      <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Total Recaudado</p>
                      <p className="text-3xl font-black italic">{formatARS(salesReport.reduce((acc, s) => acc + s.totalRevenue, 0))}</p>
                    </div>
                    <div className="p-6 bg-emerald-500 rounded-3xl text-white">
                      <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Utilidad Estimada</p>
                      <p className="text-3xl font-black italic">{formatARS(salesReport.reduce((acc, s) => acc + (s.totalRevenue - s.totalCost), 0))}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center">
                  <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <TrendingUp className="w-10 h-10 text-zinc-200" />
                  </div>
                  <p className="text-zinc-400 font-black uppercase tracking-[0.2em] text-xs">No hubo ventas registradas este día</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stock Alert Report Modal */}
      {isStockAlertsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-[70] p-6 overflow-y-auto">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-3xl my-auto animate-in fade-in zoom-in duration-300 border border-black/5">
            <div className="p-8 bg-rose-600 text-white flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black italic uppercase tracking-tight">Sugerencia de Compra</h2>
                  <p className="text-white/60 text-[9px] font-black uppercase tracking-widest">Quiebre de Stock Mínimo</p>
                </div>
              </div>
              <button onClick={() => setIsStockAlertsOpen(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8">
              {stockAlerts.length > 0 ? (
                <div className="space-y-6">
                  <p className="text-sm font-medium text-zinc-500">Los siguientes productos están por debajo de su nivel mínimo o de cobertura. La cantidad sugerida contempla el stock mínimo más la proyección de venta diaria para los días de cobertura configurados.</p>
                  
                  <div className="space-y-2">
                    {stockAlerts.map((alert, i) => (
                      <div key={i} className="flex items-center justify-between p-5 bg-rose-50 rounded-2xl border border-rose-100 group hover:bg-rose-100/50 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-rose-200">
                            <Package className="w-5 h-5 text-rose-400" />
                          </div>
                          <div>
                            <p className="font-black italic text-zinc-900 leading-tight">{alert.name}</p>
                            <p className="text-[9px] font-bold text-rose-400 uppercase tracking-widest mt-0.5">{alert.category}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-10">
                          <div className="text-center">
                            <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest mb-1">Stock Actual</p>
                            <p className="font-black italic text-rose-600">{alert.stock} uds</p>
                          </div>
                          <div className="text-center border-l border-rose-200 pl-10">
                            <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Venta / Día</p>
                            <div className="flex flex-col items-center justify-center">
                              <p className="font-bold text-blue-600 leading-none">{alert.dailySales} uds</p>
                              <p className="text-[9px] font-black text-blue-400 mt-1 uppercase tracking-widest">{alert.weeklySales} uds en 7 días</p>
                            </div>
                          </div>
                          <div className="text-center border-l border-rose-200 pl-10">
                            <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Mínimo</p>
                            <p className="font-bold text-zinc-600">{alert.minimumStock} uds</p>
                          </div>
                          <div className="text-right border-l border-rose-200 pl-10">
                            <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">Sugerido Compra</p>
                            <p className="text-xl font-black italic text-emerald-600">+{alert.needed}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={generateStockAlertsPDF}
                      className="flex-1 py-4 bg-zinc-100 text-zinc-900 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-zinc-200 transition-all"
                    >
                      Descargar PDF
                    </button>
                    <a 
                      href="/purchase-reception"
                      className="flex-[2] py-4 bg-zinc-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all flex items-center justify-center gap-3 shadow-xl shadow-black/20"
                    >
                      <ShoppingCart className="w-4 h-4" /> Ir a Cargar Compra
                    </a>
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center">
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-emerald-400" />
                  </div>
                  <p className="text-emerald-600 font-black uppercase tracking-[0.2em] text-xs italic">¡Excelente! Todos los productos tienen stock suficiente</p>
                  <p className="text-zinc-400 text-[10px] mt-2 font-medium">Ningún producto está por debajo de su límite mínimo.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Product Modal */}
      {productToDelete && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-[80] p-6">
              <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300 border border-black/5">
                  <div className="p-8 bg-black text-white">
                      <div className="flex items-center gap-4 mb-2">
                          <div className="p-2 bg-rose-500/20 rounded-xl">
                              <Trash2 className="w-5 h-5 text-rose-400" />
                          </div>
                          <h3 className="text-xl font-black italic uppercase tracking-tight">ELIMINAR PRODUCTO</h3>
                      </div>
                      <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">¿ESTÁS SEGURO QUE DESEAS ELIMINAR ESTE PRODUCTO?</p>
                  </div>
                  
                  <div className="p-8 space-y-6">
                      <div className="flex items-center gap-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                              <Package className="w-5 h-5 text-black" />
                          </div>
                          <div>
                              <p className="font-black italic text-sm">{productToDelete.name}</p>
                              <p className="text-[10px] font-bold text-zinc-400 mt-0.5">{productToDelete.category} • STOCK: {productToDelete.stock}</p>
                          </div>
                      </div>

                      <div className="flex gap-3">
                          <button
                              onClick={() => setProductToDelete(null)}
                              className="flex-1 py-5 bg-zinc-100 text-zinc-400 rounded-[24px] font-black uppercase text-[10px] tracking-widest hover:bg-zinc-200 transition-colors"
                          >
                              Cancelar
                          </button>
                          <button
                              disabled={isDeleting}
                              onClick={executeDeleteProduct}
                              className="flex-1 py-5 bg-rose-500 text-white rounded-[24px] font-black uppercase text-[10px] tracking-widest hover:bg-rose-600 transition-colors flex items-center justify-center gap-2"
                          >
                              {isDeleting ? (
                                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                              ) : (
                                  <>
                                      <Trash2 className="w-4 h-4" /> ELIMINAR
                                  </>
                              )}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && historyProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-[100] p-6">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-10 bg-black text-white relative">
              <button onClick={() => setIsHistoryModalOpen(false)} className="absolute right-8 top-8 p-3 hover:bg-white/10 rounded-2xl transition-colors">
                <X className="w-6 h-6" />
              </button>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl">
                    <History className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black italic uppercase tracking-tight">Historial de Stock</h2>
                    <p className="text-white/60 font-bold uppercase tracking-widest text-xs mt-1">{historyProduct.name}</p>
                  </div>
                </div>
                {stockMovements.length > 0 && (
                  <div className="mr-16">
                    <button 
                      onClick={generateKardexPDF}
                      className="py-3 px-6 bg-white text-black rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-zinc-200 transition-colors shadow-lg flex items-center gap-2"
                    >
                      Descargar PDF
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-10 max-h-[60vh] overflow-y-auto">
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <RefreshCcw className="w-10 h-10 animate-spin text-zinc-300 mb-4" />
                  <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Cargando movimientos...</p>
                </div>
              ) : stockMovements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <History className="w-12 h-12 text-zinc-200 mb-4" />
                  <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">No hay movimientos registrados</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-3xl border border-zinc-100 bg-white">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-zinc-50">
                      <tr>
                        <th className="p-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-black/5 whitespace-nowrap">Fecha</th>
                        <th className="p-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-black/5">Concepto</th>
                        <th className="p-5 text-[10px] font-black text-emerald-500 uppercase tracking-widest border-b border-black/5 text-center">Entrada</th>
                        <th className="p-5 text-[10px] font-black text-rose-500 uppercase tracking-widest border-b border-black/5 text-center">Salida</th>
                        <th className="p-5 text-[10px] font-black text-black uppercase tracking-widest border-b border-black/5 text-center">Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {stockMovements.map((mov) => {
                        const typeLabel = mov.type === 0 ? 'COMPRA' : mov.type === 1 ? 'AJUSTE' : 'VENTA';
                        const typeColor = mov.type === 0 ? 'bg-blue-50 text-blue-600' : mov.type === 1 ? 'bg-amber-50 text-amber-600' : 'bg-purple-50 text-purple-600';
                        return (
                          <tr key={mov.id} className="hover:bg-zinc-50/50 transition-colors">
                            <td className="p-5 align-middle whitespace-nowrap">
                              <p className="text-xs font-bold text-zinc-500">{format(new Date(mov.createdAt), "dd/MM/yyyy HH:mm'hs'")}</p>
                            </td>
                            <td className="p-5 align-middle">
                              <div className="flex items-center gap-3">
                                <span className={`px-2 py-1 rounded-lg font-black uppercase text-[9px] tracking-widest shrink-0 ${typeColor}`}>
                                  {typeLabel}
                                </span>
                                <span className="text-xs font-black italic uppercase text-zinc-700 truncate max-w-[200px]" title={mov.note || 'Sin observación'}>{mov.note || 'Sin observación'}</span>
                              </div>
                            </td>
                            <td className="p-5 align-middle text-center">
                              {mov.inQuantity > 0 ? (
                                <span className="text-sm font-black italic text-emerald-500">+{mov.inQuantity}</span>
                              ) : <span className="text-zinc-300">-</span>}
                            </td>
                            <td className="p-5 align-middle text-center">
                              {mov.outQuantity > 0 ? (
                                <span className="text-sm font-black italic text-rose-500">-{mov.outQuantity}</span>
                              ) : <span className="text-zinc-300">-</span>}
                            </td>
                            <td className="p-5 align-middle text-center bg-zinc-50/50 border-l border-black/5">
                              <span className="text-base font-black italic text-black">{mov.balance}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ranking Modal */}
      {isRankingModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-[100] p-6">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-6xl overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh]">
            <div className="p-10 bg-black text-white relative shrink-0">
              <button onClick={() => setIsRankingModalOpen(false)} className="absolute right-8 top-8 p-3 hover:bg-white/10 rounded-2xl transition-colors">
                <X className="w-6 h-6" />
              </button>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-500/20 text-purple-400 rounded-2xl">
                    <BarChart2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black italic uppercase tracking-tight">Ranking de Ventas por Día</h2>
                    <p className="text-white/60 font-bold uppercase tracking-widest text-xs mt-1">Mapa de calor de consumo</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 mr-16">
                  <div className="flex items-center gap-2 bg-white/10 border border-white/10 rounded-xl px-4 py-2">
                    <span className="text-[10px] font-bold text-white/50 uppercase">Desde</span>
                    <input 
                      type="date" 
                      value={rankingStartDate}
                      onChange={(e) => setRankingStartDate(e.target.value)}
                      onBlur={fetchRankingData}
                      className="bg-transparent text-xs font-bold outline-none text-white [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                    />
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 border border-white/10 rounded-xl px-4 py-2">
                    <span className="text-[10px] font-bold text-white/50 uppercase">Hasta</span>
                    <input 
                      type="date" 
                      value={rankingEndDate}
                      onChange={(e) => setRankingEndDate(e.target.value)}
                      onBlur={fetchRankingData}
                      className="bg-transparent text-xs font-bold outline-none text-white [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="overflow-auto bg-zinc-50 flex-1">
              {loadingRanking ? (
                <div className="flex flex-col items-center justify-center py-20 h-full">
                  <RefreshCcw className="w-10 h-10 animate-spin text-zinc-300 mb-4" />
                  <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Calculando ranking...</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-white sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-black/5 whitespace-nowrap">Producto</th>
                      {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'totalQuantity'].map((col) => {
                        const labels: Record<string, string> = {
                          monday: 'Lun', tuesday: 'Mar', wednesday: 'Mié', thursday: 'Jue', friday: 'Vie', saturday: 'Sáb', sunday: 'Dom', totalQuantity: 'Total'
                        };
                        return (
                          <th 
                            key={col} 
                            onClick={() => handleSortRanking(col)}
                            className="p-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-black/5 cursor-pointer hover:bg-zinc-50 transition-colors text-center group whitespace-nowrap"
                          >
                            <div className="flex items-center justify-center gap-1">
                              {labels[col]}
                              {rankingSortColumn === col ? (
                                rankingSortDirection === 'asc' ? <ChevronDown className="w-3 h-3 rotate-180" /> : <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {getSortedRankingData().map((item, idx) => {
                      const maxDaily = Math.max(item.monday, item.tuesday, item.wednesday, item.thursday, item.friday, item.saturday, item.sunday);
                      
                      const getCellColor = (val: number) => {
                        if (val === 0) return 'text-zinc-300';
                        if (maxDaily > 0 && val === maxDaily) return 'bg-purple-100 text-purple-700 font-black';
                        if (maxDaily > 0 && val >= maxDaily * 0.7) return 'bg-purple-50 text-purple-600 font-bold';
                        return 'text-zinc-600';
                      };

                      return (
                        <tr key={item.productId} className="hover:bg-white transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-black text-zinc-400 w-4 text-right">#{idx + 1}</span>
                              <div>
                                <p className="font-bold text-sm text-black uppercase">{item.productName}</p>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{item.category}</p>
                              </div>
                            </div>
                          </td>
                          {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                            <td key={day} className="p-2 text-center align-middle">
                              <div className={`mx-auto w-10 h-10 flex items-center justify-center rounded-xl text-xs transition-colors ${getCellColor(item[day])}`}>
                                {item[day]}
                              </div>
                            </td>
                          ))}
                          <td className="p-4 text-center">
                            <div className="inline-flex items-center justify-center px-4 py-2 bg-black text-white rounded-xl text-xs font-black">
                              {item.totalQuantity}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {customAlert && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-[90] p-6">
              <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-300 border border-black/5">
                  <div className={`p-8 ${customAlert.type === 'success' ? 'bg-emerald-500' : customAlert.type === 'error' ? 'bg-rose-500' : 'bg-amber-500'} text-white`}>
                      <div className="flex items-center gap-4">
                          <div className="p-2 bg-white/20 rounded-xl">
                              {customAlert.type === 'success' ? <CheckCircle className="w-5 h-5 text-white" /> : customAlert.type === 'error' ? <X className="w-5 h-5 text-white" /> : <AlertCircle className="w-5 h-5 text-white" />}
                          </div>
                          <h3 className="text-xl font-black italic uppercase tracking-tight">{customAlert.title}</h3>
                      </div>
                  </div>
                  
                  <div className="p-8 space-y-6">
                      <p className="text-sm font-bold text-zinc-600 text-center uppercase tracking-widest leading-relaxed">
                          {customAlert.message}
                      </p>

                      <button
                          onClick={() => setCustomAlert(null)}
                          className={`w-full py-5 text-white rounded-[24px] font-black uppercase text-[10px] tracking-widest transition-colors ${customAlert.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600' : customAlert.type === 'error' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-amber-500 hover:bg-amber-600'}`}
                      >
                          ACEPTAR
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default ProductsPage;
