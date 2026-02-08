import axios from 'axios';

const api = axios.create({
  // In production (Caddy), we use the relative /api path.
  // In local dev without Caddy, it falls back to localhost:8000
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

export default api;
