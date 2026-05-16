import axios from 'axios';

const API_URL = '/api/notifications';

const notificationService = {
  getNotifications: async (limit = 50) => {
    const response = await axios.get(`${API_URL}?limit=${limit}`);
    return response.data?.data || response.data;
  },

  getUnreadCount: async () => {
    const response = await axios.get(`${API_URL}/unread-count`);
    return response.data?.data !== undefined ? response.data.data : response.data;
  },

  markAsRead: async (id) => {
    const response = await axios.put(`${API_URL}/${id}/read`);
    return response.data?.data || response.data;
  },

  markAllAsRead: async () => {
    const response = await axios.put(`${API_URL}/read-all`);
    return response.data?.data || response.data;
  },
  
  sendNotification: async (data) => {
    const response = await axios.post(`${API_URL}/send`, data);
    return response.data?.data || response.data;
  }
};

export default notificationService;
