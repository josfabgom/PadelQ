import axios from 'axios';

// Get API URL from env or fallback to localhost for development
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.blackclubdepadel.com.ar';

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
