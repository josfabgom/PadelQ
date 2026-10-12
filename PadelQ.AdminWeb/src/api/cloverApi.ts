import api from './api';

export const sendCloverCharge = async (amount: number, orderId: string, deviceId?: string) => {
    try {
        const payload = { amount, orderId, deviceId: deviceId || "" };
        const response = await api.post('/api/clover/charge', payload);
        return response.data;
    } catch (error: any) {
        throw new Error(error.response?.data || error.message);
    }
};

export const setCloverDevice = async (deviceId: string) => {
    try {
        const response = await api.post('/api/clover/device', { deviceId });
        return response.data;
    } catch (error: any) {
        throw new Error(error.response?.data || error.message);
    }
};
