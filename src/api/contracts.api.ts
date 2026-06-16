import axiosInstance from "./axios";

// List & detail
export const getContracts = (params?: Record<string, unknown>) =>
  axiosInstance.get("/contracts", { params }).then((r) => r.data);

export const getContractById = (id: number) =>
  axiosInstance.get(`/contracts/${id}`).then((r) => r.data);

export const getContractSummary = (id: number) =>
  axiosInstance.get(`/contracts/${id}/summary`).then((r) => r.data);

// CRUD contract
export const createContract = (body: unknown) =>
  axiosInstance.post("/contracts", body).then((r) => r.data);

export const updateContract = (id: number, body: unknown) =>
  axiosInstance.put(`/contracts/${id}`, body).then((r) => r.data);

export const changeContractStatus = (id: number, body: unknown) =>
  axiosInstance.patch(`/contracts/${id}/status`, body).then((r) => r.data);

export const updateExcludedDays = (id: number, body: unknown) =>
  axiosInstance.patch(`/contracts/${id}/excluded-days`, body).then((r) => r.data);

// Line items
export const createLineItem = (contractId: number, body: unknown) =>
  axiosInstance.post(`/contracts/${contractId}/line-items`, body).then((r) => r.data);

export const updateLineItem = (contractId: number, itemId: number, body: unknown) =>
  axiosInstance.put(`/contracts/${contractId}/line-items/${itemId}`, body).then((r) => r.data);

export const deleteLineItem = (contractId: number, itemId: number) =>
  axiosInstance.delete(`/contracts/${contractId}/line-items/${itemId}`).then((r) => r.data);

// Contract vehicles
export const getContractVehicles = (contractId: number) =>
  axiosInstance.get(`/contracts/${contractId}/vehicles`).then((r) => r.data);

export const addContractVehicle = (contractId: number, body: unknown) =>
  axiosInstance.post(`/contracts/${contractId}/vehicles`, body).then((r) => r.data);

export const updateContractVehicle = (contractId: number, cvId: number, body: unknown) =>
  axiosInstance.put(`/contracts/${contractId}/vehicles/${cvId}`, body).then((r) => r.data);

export const removeContractVehicle = (contractId: number, cvId: number) =>
  axiosInstance.delete(`/contracts/${contractId}/vehicles/${cvId}`).then((r) => r.data);

// Addendums
export const getAddendums = (contractId: number) =>
  axiosInstance.get(`/contracts/${contractId}/addendums`).then((r) => r.data);

export const createAddendum = (contractId: number, body: unknown) =>
  axiosInstance.post(`/contracts/${contractId}/addendums`, body).then((r) => r.data);

export const updateAddendum = (contractId: number, addId: number, body: unknown) =>
  axiosInstance.put(`/contracts/${contractId}/addendums/${addId}`, body).then((r) => r.data);

export const deleteAddendum = (contractId: number, addId: number) =>
  axiosInstance.delete(`/contracts/${contractId}/addendums/${addId}`).then((r) => r.data);

// Acceptance records
export const getAcceptanceRecords = (contractId: number) =>
  axiosInstance.get(`/contracts/${contractId}/acceptance-records`).then((r) => r.data);

export const createAcceptanceRecord = (contractId: number, body: unknown) =>
  axiosInstance.post(`/contracts/${contractId}/acceptance-records`, body).then((r) => r.data);

export const updateAcceptanceRecord = (contractId: number, recId: number, body: unknown) =>
  axiosInstance.put(`/contracts/${contractId}/acceptance-records/${recId}`, body).then((r) => r.data);

export const deleteAcceptanceRecord = (contractId: number, recId: number) =>
  axiosInstance.delete(`/contracts/${contractId}/acceptance-records/${recId}`).then((r) => r.data);

// Invoices
export const getInvoices = (contractId: number) =>
  axiosInstance.get(`/contracts/${contractId}/invoices`).then((r) => r.data);

export const createInvoice = (contractId: number, body: unknown) =>
  axiosInstance.post(`/contracts/${contractId}/invoices`, body).then((r) => r.data);

export const updateInvoice = (contractId: number, invId: number, body: unknown) =>
  axiosInstance.put(`/contracts/${contractId}/invoices/${invId}`, body).then((r) => r.data);

export const deleteInvoice = (contractId: number, invId: number) =>
  axiosInstance.delete(`/contracts/${contractId}/invoices/${invId}`).then((r) => r.data);

// Incidents
export const getIncidents = (contractId: number) =>
  axiosInstance.get(`/contracts/${contractId}/incidents`).then((r) => r.data);

export const createIncident = (contractId: number, body: unknown) =>
  axiosInstance.post(`/contracts/${contractId}/incidents`, body).then((r) => r.data);

export const updateIncident = (contractId: number, incId: number, body: unknown) =>
  axiosInstance.put(`/contracts/${contractId}/incidents/${incId}`, body).then((r) => r.data);
