import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Modules API
export const getModules = async () => {
  const response = await api.get('/modules');
  return response.data;
};

export const getModule = async (id) => {
  const response = await api.get(`/modules/${id}`);
  return response.data;
};

export const createModule = async (moduleData) => {
  const response = await api.post('/modules', moduleData);
  return response.data;
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

export const getRecordsByName = async (moduleName) => {
  const response = await api.get(`/records/by-name/${moduleName}`);
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

export default api;
