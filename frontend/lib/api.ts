import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

export const sessionsApi = {
  getAll: () => apiClient.get('/api/sessions').then(r => r.data),
  getOne: (id: string) => apiClient.get(`/api/sessions/${id}`).then(r => r.data),
  create: (data: { title: string; description?: string; language?: string }) =>
    apiClient.post('/api/sessions', data).then(r => r.data),
  join: (inviteCode: string) =>
    apiClient.post('/api/sessions/join', { inviteCode }).then(r => r.data),
  start: (id: string) => apiClient.patch(`/api/sessions/${id}/start`).then(r => r.data),
  end: (id: string) => apiClient.patch(`/api/sessions/${id}/end`).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/api/sessions/${id}`).then(r => r.data),
};

export default apiClient;
