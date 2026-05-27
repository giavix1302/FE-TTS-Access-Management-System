import axiosInstance from "./axios";
import type {
  CustomerListItem,
  CustomerDetail,
  CustomerContractItem,
} from "@/types/customer.types";

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface PagedApiResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

interface CreateCustomerResult {
  id: number;
  customerType: string;
  displayName: string;
  phone: string;
  email?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface GetCustomersParams {
  search?: string;
  customer_type?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}

export interface CreateIndividualCustomerBody {
  fullName: string;
  phone: string;
  nationalId: string;
  email?: string;
  nationalIdIssueDate?: string;
  nationalIdIssuePlace?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  hometown?: string;
  permanentAddress?: string;
}

export interface CreateBusinessCustomerBody {
  internationalName: string;
  shortName: string;
  taxCode: string;
  taxAddress?: string;
  officeAddress?: string;
  representative?: string;
  representativeTitle?: string;
  phone?: string;
  email?: string;
}

export interface UpdateIndividualCustomerBody {
  fullName?: string;
  phone?: string;
  email?: string;
  nationalId?: string;
  nationalIdIssueDate?: string;
  nationalIdIssuePlace?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  hometown?: string;
  permanentAddress?: string;
}

export interface UpdateBusinessCustomerBody {
  internationalName?: string;
  shortName?: string;
  taxCode?: string;
  taxAddress?: string;
  officeAddress?: string;
  representative?: string;
  representativeTitle?: string;
  phone?: string;
  email?: string;
}

export interface GetCustomerContractsParams {
  status?: string;
  page?: number;
  page_size?: number;
}

export const getCustomers = (params?: GetCustomersParams) =>
  axiosInstance
    .get<PagedApiResponse<CustomerListItem>>("/customers", { params })
    .then((r) => r.data);

export const getCustomerById = (id: number) =>
  axiosInstance
    .get<ApiResponse<CustomerDetail>>(`/customers/${id}`)
    .then((r) => r.data);

export const createIndividualCustomer = (body: CreateIndividualCustomerBody) =>
  axiosInstance
    .post<ApiResponse<CreateCustomerResult>>("/customers/individual", body)
    .then((r) => r.data);

export const createBusinessCustomer = (body: CreateBusinessCustomerBody) =>
  axiosInstance
    .post<ApiResponse<CreateCustomerResult>>("/customers/business", body)
    .then((r) => r.data);

export const updateIndividualCustomer = (id: number, body: UpdateIndividualCustomerBody) =>
  axiosInstance
    .put<ApiResponse<null>>(`/customers/${id}/individual`, body)
    .then((r) => r.data);

export const updateBusinessCustomer = (id: number, body: UpdateBusinessCustomerBody) =>
  axiosInstance
    .put<ApiResponse<null>>(`/customers/${id}/business`, body)
    .then((r) => r.data);

export const activateCustomer = (id: number) =>
  axiosInstance
    .put<ApiResponse<null>>(`/customers/${id}/activate`)
    .then((r) => r.data);

export const deactivateCustomer = (id: number) =>
  axiosInstance
    .put<ApiResponse<null>>(`/customers/${id}/deactivate`)
    .then((r) => r.data);

export const getCustomerContracts = (id: number, params?: GetCustomerContractsParams) =>
  axiosInstance
    .get<PagedApiResponse<CustomerContractItem>>(`/customers/${id}/contracts`, { params })
    .then((r) => r.data);
