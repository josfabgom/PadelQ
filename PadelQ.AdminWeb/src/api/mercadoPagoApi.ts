import api, { getAuthConfig } from './api';

export interface PointTerminal {
  id: number;
  name: string;
  externalPosId: string;
  storeId?: string;
  isActive: boolean;
}

export const getPointTerminals = async (): Promise<PointTerminal[]> => {
  const response = await api.get('/api/pointterminals', getAuthConfig());
  return response.data;
};

export const createPointTerminal = async (terminal: Partial<PointTerminal>): Promise<PointTerminal> => {
  const response = await api.post('/api/pointterminals', terminal, getAuthConfig());
  return response.data;
};

export const deletePointTerminal = async (id: number): Promise<void> => {
  await api.delete(`/api/pointterminals/${id}`, getAuthConfig());
};

export interface CreateIntentRequest {
  terminalId: number;
  amount: number;
  description: string;
  referenceId: string;
}

export const createMercadoPagoIntent = async (request: CreateIntentRequest) => {
  const response = await api.post('/api/mercadopago/intent', request, getAuthConfig());
  return response.data;
};
