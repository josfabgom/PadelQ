import axios from 'axios';

// Get API URL from env or fallback to localhost for development
// URL de tu backend local (corregida sin el /api duplicado)
const API_BASE_URL = 'http://localhost:5041'; 

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Helper to get auth config
export const getAuthConfig = () => {
  const token = localStorage.getItem('padelq_token');
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

export default api;
