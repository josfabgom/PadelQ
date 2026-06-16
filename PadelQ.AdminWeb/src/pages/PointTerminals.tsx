import React, { useState, useEffect } from 'react';
import { getPointTerminals, createPointTerminal, deletePointTerminal, PointTerminal } from '../api/mercadoPagoApi';

const PointTerminals: React.FC = () => {
  const [terminals, setTerminals] = useState<PointTerminal[]>([]);
  const [name, setName] = useState('');
  const [externalPosId, setExternalPosId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTerminals();
  }, []);

  const fetchTerminals = async () => {
    try {
      const data = await getPointTerminals();
      setTerminals(data);
    } catch (error) {
      console.error('Error fetching terminals', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newTerminal = await createPointTerminal({ name, externalPosId });
      setTerminals([...terminals, newTerminal]);
      setName('');
      setExternalPosId('');
    } catch (error) {
      console.error('Error adding terminal', error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deletePointTerminal(id);
      setTerminals(terminals.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting terminal', error);
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Terminales Point Smart (Mercado Pago)</h2>
      
      <form onSubmit={handleAdd} className="mb-6 flex gap-4">
        <input 
          type="text" 
          placeholder="Nombre (ej. Caja 1)" 
          value={name} 
          onChange={(e) => setName(e.target.value)}
          className="border p-2 rounded"
          required
        />
        <input 
          type="text" 
          placeholder="ID de Terminal (external_pos_id)" 
          value={externalPosId} 
          onChange={(e) => setExternalPosId(e.target.value)}
          className="border p-2 rounded"
          required
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Agregar Terminal</button>
      </form>

      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">ID</th>
            <th className="border p-2 text-left">Nombre</th>
            <th className="border p-2 text-left">External POS ID</th>
            <th className="border p-2 text-left">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {terminals.map(t => (
            <tr key={t.id}>
              <td className="border p-2">{t.id}</td>
              <td className="border p-2">{t.name}</td>
              <td className="border p-2">{t.externalPosId}</td>
              <td className="border p-2">
                <button 
                  onClick={() => handleDelete(t.id)}
                  className="bg-red-500 text-white px-3 py-1 rounded text-sm"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
          {terminals.length === 0 && (
            <tr>
              <td colSpan={4} className="border p-4 text-center text-gray-500">
                No hay terminales registradas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default PointTerminals;
