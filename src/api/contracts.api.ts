import axiosInstance from "./axios";
import type { ApiResponse } from "@/types/common.types";
import type {
  AcceptanceRecord,
  AddContractVehicleInput,
  Addendum,
  ChangeContractStatusInput,
  ChangeContractStatusResult,
  ContractDetail,
  ContractListItem,
  ContractSummary,
  ContractVehicle,
  CreateAcceptanceRecordInput,
  CreateAddendumInput,
  CreateContractInput,
  CreateIncidentInput,
  CreateInvoiceInput,
  CreateLineItemInput,
  Incident,
  Invoice,
  LineItem,
  UpdateContractInput,
  UpdateContractVehicleInput,
  UpdateIncidentInput,
  UpdateLineItemInput,
} from "@/types/contract.types";

interface ContractListResponse {
  success: boolean;
  data: ContractListItem[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

// List & detail
export const getContracts = (params?: Record<string, unknown>): Promise<ContractListResponse> =>
  axiosInstance.get("/contracts", { params }).then((r) => r.data);

export const getContractById = (id: number): Promise<ApiResponse<ContractDetail>> =>
  axiosInstance.get(`/contracts/${id}`).then((r) => r.data);

export const getContractSummary = (id: number): Promise<ApiResponse<ContractSummary>> =>
  axiosInstance.get(`/contracts/${id}/summary`).then((r) => r.data);

// CRUD contract
export const createContract = (body: CreateContractInput): Promise<ApiResponse<ContractDetail>> =>
  axiosInstance.post("/contracts", body).then((r) => r.data);

export const updateContract = (id: number, body: UpdateContractInput) =>
  axiosInstance.put(`/contracts/${id}`, body).then((r) => r.data);

export const changeContractStatus = (id: number, body: ChangeContractStatusInput): Promise<ChangeContractStatusResult | undefined> =>
  axiosInstance.patch(`/contracts/${id}/status`, body).then((r) => r.data);

// Line items
export const getLineItems = (contractId: number): Promise<ApiResponse<LineItem[]>> =>
  axiosInstance.get(`/contracts/${contractId}/line-items`).then((r) => r.data);

export const createLineItem = (contractId: number, body: CreateLineItemInput): Promise<ApiResponse<LineItem>> =>
  axiosInstance.post(`/contracts/${contractId}/line-items`, body).then((r) => r.data);

export const updateLineItem = (contractId: number, itemId: number, body: UpdateLineItemInput) =>
  axiosInstance.put(`/contracts/${contractId}/line-items/${itemId}`, body).then((r) => r.data);

export const deleteLineItem = (contractId: number, itemId: number) =>
  axiosInstance.delete(`/contracts/${contractId}/line-items/${itemId}`).then((r) => r.data);

// Contract vehicles
export const getContractVehicles = (contractId: number): Promise<ApiResponse<ContractVehicle[]>> =>
  axiosInstance.get(`/contracts/${contractId}/vehicles`).then((r) => r.data);

export const addContractVehicle = (contractId: number, body: AddContractVehicleInput) =>
  axiosInstance.post(`/contracts/${contractId}/vehicles`, body).then((r) => r.data);

export const updateContractVehicle = (contractId: number, cvId: number, body: UpdateContractVehicleInput) =>
  axiosInstance.put(`/contracts/${contractId}/vehicles/${cvId}`, body).then((r) => r.data);

export const removeContractVehicle = (contractId: number, cvId: number) =>
  axiosInstance.delete(`/contracts/${contractId}/vehicles/${cvId}`).then((r) => r.data);

// Addendums
export const getAddendums = (contractId: number): Promise<ApiResponse<Addendum[]>> =>
  axiosInstance.get(`/contracts/${contractId}/addendums`).then((r) => r.data);

export const getAddendum = (contractId: number, addId: number): Promise<ApiResponse<Addendum>> =>
  axiosInstance.get(`/contracts/${contractId}/addendums/${addId}`).then((r) => r.data);

export const createAddendum = (contractId: number, body: CreateAddendumInput) =>
  axiosInstance.post(`/contracts/${contractId}/addendums`, body).then((r) => r.data);

export const updateAddendum = (contractId: number, addId: number, body: Partial<CreateAddendumInput>) =>
  axiosInstance.put(`/contracts/${contractId}/addendums/${addId}`, body).then((r) => r.data);

export const deleteAddendum = (contractId: number, addId: number) =>
  axiosInstance.delete(`/contracts/${contractId}/addendums/${addId}`).then((r) => r.data);

// Acceptance records
export const getAcceptanceRecords = (contractId: number): Promise<ApiResponse<AcceptanceRecord[]>> =>
  axiosInstance.get(`/contracts/${contractId}/acceptance-records`).then((r) => r.data);

export const createAcceptanceRecord = (contractId: number, body: CreateAcceptanceRecordInput) =>
  axiosInstance.post(`/contracts/${contractId}/acceptance-records`, body).then((r) => r.data);

export const updateAcceptanceRecord = (contractId: number, recId: number, body: Partial<CreateAcceptanceRecordInput>) =>
  axiosInstance.put(`/contracts/${contractId}/acceptance-records/${recId}`, body).then((r) => r.data);

export const deleteAcceptanceRecord = (contractId: number, recId: number) =>
  axiosInstance.delete(`/contracts/${contractId}/acceptance-records/${recId}`).then((r) => r.data);

// Invoices
export const getInvoices = (contractId: number): Promise<ApiResponse<Invoice[]>> =>
  axiosInstance.get(`/contracts/${contractId}/invoices`).then((r) => r.data);

export const createInvoice = (contractId: number, body: CreateInvoiceInput) =>
  axiosInstance.post(`/contracts/${contractId}/invoices`, body).then((r) => r.data);

export const updateInvoice = (contractId: number, invId: number, body: Partial<CreateInvoiceInput>) =>
  axiosInstance.put(`/contracts/${contractId}/invoices/${invId}`, body).then((r) => r.data);

export const deleteInvoice = (contractId: number, invId: number) =>
  axiosInstance.delete(`/contracts/${contractId}/invoices/${invId}`).then((r) => r.data);

// Incidents
export const getIncidents = (contractId: number): Promise<ApiResponse<Incident[]>> =>
  axiosInstance.get(`/contracts/${contractId}/incidents`).then((r) => r.data);

export const createIncident = (contractId: number, body: CreateIncidentInput) =>
  axiosInstance.post(`/contracts/${contractId}/incidents`, body).then((r) => r.data);

export const updateIncident = (contractId: number, incId: number, body: UpdateIncidentInput) =>
  axiosInstance.put(`/contracts/${contractId}/incidents/${incId}`, body).then((r) => r.data);
