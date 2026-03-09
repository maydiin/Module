import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token and tenant header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const selectedTenantId = localStorage.getItem('selectedTenantId');
    if (selectedTenantId) {
      config.headers['X-Tenant-Id'] = selectedTenantId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Auth API
export const login = async (username, password) => {
  const response = await api.post('/auth/login', { username, password });
  if (response.data.token) {
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('username', response.data.username);
    localStorage.setItem('permissions', JSON.stringify(response.data.permissions || []));
    localStorage.setItem('isSuperAdmin', response.data.isSuperAdmin ? 'true' : 'false');
  }
  return response.data;
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  localStorage.removeItem('permissions');
  localStorage.removeItem('isSuperAdmin');
  localStorage.removeItem('selectedTenantId');
};

export const seedPermissions = async () => {
  const response = await api.post('/auth/seed');
  return response.data;
};

export const register = async (username, email, password) => {
  const response = await api.post('/auth/register', { username, email, password });
  return response.data;
};

export const verifyEmail = async (email, verificationCode) => {
  const response = await api.post('/auth/verify-email', { email, verificationCode });
  return response.data;
};

export const resendVerificationCode = async (email) => {
  const response = await api.post('/auth/resend-verification', { email });
  return response.data;
};

export const refreshToken = async () => {
  const response = await api.post('/auth/refresh-token');
  if (response.data.token) {
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('username', response.data.username);
    localStorage.setItem('permissions', JSON.stringify(response.data.permissions || []));
    localStorage.setItem('isSuperAdmin', response.data.isSuperAdmin ? 'true' : 'false');
  }
  return response.data;
};

// Tenants API
export const getTenants = async () => {
  const response = await api.get('/tenants');
  return response.data;
};


// Users Management API
export const getUsers = async () => {
  const response = await api.get('/users');
  return response.data;
};


export const createUser = async (userData) => {
  const response = await api.post('/users', userData);
  return response.data;
};

export const assignRole = async (userId, roleName) => {

  const response = await api.post(`/users/${userId}/roles`, { roleName });
  return response.data;
};

export const removeRole = async (userId, roleName) => {
  const response = await api.delete(`/users/${userId}/roles/${roleName}`);
  return response.data;
};

// Roles Management API
export const getRoles = async () => {
  const response = await api.get('/roles');
  return response.data;
};

export const getAllPermissions = async () => {
  const response = await api.get('/roles/permissions');
  return response.data;
};

export const addPermissionToRole = async (roleId, permissionName) => {
  const response = await api.post(`/roles/${roleId}/permissions`, { permissionName });
  return response.data;
};

export const removePermissionFromRole = async (roleId, permissionName) => {
  const response = await api.delete(`/roles/${roleId}/permissions/${permissionName}`);
  return response.data;
};

export const createRole = async (roleData) => {
  const response = await api.post('/roles', roleData);
  return response.data;
};

export const updateRole = async (id, roleData) => {
  const response = await api.put(`/roles/${id}`, roleData);
  return response.data;
};

export const deleteRole = async (id) => {
  await api.delete(`/roles/${id}`);
};

// Modules API
export const getModules = async () => {
  const response = await api.get('/modules');
  return response.data.data || response.data;
};

export const getModule = async (id) => {
  const response = await api.get(`/modules/${id}`);
  return response.data.data || response.data;
};

export const createModule = async (moduleData) => {
  const response = await api.post('/modules', moduleData);
  return response.data.data || response.data;
};

export const updateModule = async (moduleId, moduleData) => {
  const response = await api.put(`/modules/${moduleId}`, moduleData);
  return response.data.data || response.data;
};

// Module Fields API
export const getFields = async (moduleId) => {
  const response = await api.get(`/modules/${moduleId}/fields`);
  return response.data;
};

export const addField = async (moduleId, fieldData) => {
  const response = await api.post(`/modules/${moduleId}/fields`, fieldData);
  return response.data;
};

export const updateField = async (moduleId, fieldId, fieldData) => {
  const response = await api.put(`/modules/${moduleId}/fields/${fieldId}`, fieldData);
  return response.data;
};

export const getField = async (moduleId, fieldId) => {
  const response = await api.get(`/modules/${moduleId}/fields/${fieldId}`);
  return response.data;
};

export const getFieldTypes = async (moduleId) => {
  const response = await api.get(`/modules/${moduleId}/fields/types`);
  return response.data;
};

// Module Records API
export const getRecords = async (moduleId, params = {}) => {
  const response = await api.get(`/modules/${moduleId}/records`, { params });
  return response.data;
};

export const getRecord = async (moduleId, recordId) => {
  const response = await api.get(`/modules/${moduleId}/records/${recordId}`);
  return response.data;
};

export const createRecord = async (moduleId, data) => {
  const response = await api.post(`/modules/${moduleId}/records`, { data });
  return response.data;
};

export const updateRecord = async (moduleId, recordId, data) => {
  const response = await api.put(`/modules/${moduleId}/records/${recordId}`, { data });
  return response.data;
};

export const deleteRecord = async (moduleId, recordId) => {
  await api.delete(`/modules/${moduleId}/records/${recordId}`);
};

export const getRecordsByName = async (moduleName, params = {}) => {
  const response = await api.get(`/records/by-name/${moduleName}`, { params });
  return response.data;
};

// External API Configs API
export const getApiConfigs = async (moduleId) => {
  const response = await api.get(`/modules/${moduleId}/api-configs`);
  return response.data;
};

export const createApiConfig = async (moduleId, configData) => {
  const response = await api.post(`/modules/${moduleId}/api-configs`, configData);
  return response.data;
};

export const updateApiConfig = async (moduleId, configId, configData) => {
  const response = await api.put(`/modules/${moduleId}/api-configs/${configId}`, configData);
  return response.data;
};

export const deleteApiConfig = async (moduleId, configId) => {
  await api.delete(`/modules/${moduleId}/api-configs/${configId}`);
};

// Audit Logs API
export const getAuditLogs = async (params = {}) => {
  const response = await api.get('/audit-logs', { params });
  return response.data;
};

// Module Scripts API
export const getScripts = async (moduleId) => {
  const response = await api.get(`/modules/${moduleId}/scripts`);
  return response.data;
};

export const getScript = async (moduleId, scriptId) => {
  const response = await api.get(`/modules/${moduleId}/scripts/${scriptId}`);
  return response.data;
};

export const createScript = async (moduleId, scriptData) => {
  const response = await api.post(`/modules/${moduleId}/scripts`, scriptData);
  return response.data;
};

export const updateScript = async (moduleId, scriptId, scriptData) => {
  const response = await api.put(`/modules/${moduleId}/scripts/${scriptId}`, scriptData);
  return response.data;
};

export const deleteScript = async (moduleId, scriptId) => {
  await api.delete(`/modules/${moduleId}/scripts/${scriptId}`);
};

// Module Reports API
export const getReports = async (moduleId) => {
  const response = await api.get(`/modules/${moduleId}/reports`);
  return response.data;
};

export const getReport = async (moduleId, reportId) => {
  const response = await api.get(`/modules/${moduleId}/reports/${reportId}`);
  return response.data;
};

export const createReport = async (moduleId, reportData) => {
  const response = await api.post(`/modules/${moduleId}/reports`, reportData);
  return response.data;
};

export const updateReport = async (moduleId, reportId, reportData) => {
  const response = await api.put(`/modules/${moduleId}/reports/${reportId}`, reportData);
  return response.data;
};

export const deleteReport = async (moduleId, reportId) => {
  await api.delete(`/modules/${moduleId}/reports/${reportId}`);
};

export const getReportData = async (moduleId, reportId) => {
  const response = await api.get(`/modules/${moduleId}/reports/${reportId}/data`);
  return response.data;
};

// AI Setup API
export const generateAiConfig = async (prompt) => {
  const response = await api.post('/ai-setup/generate', { prompt });
  return response.data;
};

export const generateAiReportConfig = async (moduleId, prompt) => {
  const response = await api.post(`/ai-setup/generate-report/${moduleId}`, { prompt });
  return response.data;
};

export const applyAiConfig = async (config) => {
  const response = await api.post('/ai-setup', config);
  return response.data;
};

export default api;
