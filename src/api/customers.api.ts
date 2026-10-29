import axiosInstance from "./axios";
import type {
  CustomerListItem,
  CustomerDetail,
  CustomerContractItem,
  CustomerContact,
  CustomerContractStatus,
  CustomerGender,
  CustomerType,
  Contact,
  ContactDetail,
  ContactListItem,
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

export interface CreateCustomerResult {
  id: number;
  customerType: CustomerType;
  displayName: string;
  phone: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
}

export interface GetCustomersParams {
  search?: string;
  customer_type?: CustomerType;
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
  gender?: CustomerGender;
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
  gender?: CustomerGender;
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
  status?: CustomerContractStatus;
  page?: number;
  page_size?: number;
}

export interface ContactInput {
  fullName: string;
  phone?: string | null;
  email?: string | null;
}

export interface CustomerContactInput extends ContactInput {
  title?: string | null;
  isPrimary?: boolean;
}

export type UpdateCustomerContactBody = Partial<ContactInput> & {
  title?: string | null;
  isPrimary?: boolean;
};

export interface LinkCustomerContactBody {
  contactId: number;
  title?: string | null;
  isPrimary?: boolean;
}

export interface GetContactsParams {
  search?: string;
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
    .post<ApiResponse<CreateCustomerResult>>("/customers/business", {
      ...body,
      shortName: body.shortName.trim().toUpperCase(),
    })
    .then((r) => r.data);

export const updateIndividualCustomer = (id: number, body: UpdateIndividualCustomerBody) =>
  axiosInstance
    .put<ApiResponse<CustomerDetail>>(`/customers/${id}/individual`, body)
    .then((r) => r.data);

export const updateBusinessCustomer = (id: number, body: UpdateBusinessCustomerBody) =>
  axiosInstance
    .put<ApiResponse<CustomerDetail>>(`/customers/${id}/business`, {
      ...body,
      ...(body.shortName !== undefined
        ? { shortName: body.shortName.trim().toUpperCase() }
        : {}),
    })
    .then((r) => r.data);

export const activateCustomer = (id: number) =>
  axiosInstance
    .put<void>(`/customers/${id}/activate`)
    .then(() => undefined);

export const deactivateCustomer = (id: number) =>
  axiosInstance
    .put<void>(`/customers/${id}/deactivate`)
    .then(() => undefined);

export const getCustomerContracts = (id: number, params?: GetCustomerContractsParams) =>
  axiosInstance
    .get<PagedApiResponse<CustomerContractItem>>(`/customers/${id}/contracts`, { params })
    .then((r) => r.data);

export const getCustomerContacts = (id: number) =>
  axiosInstance
    .get<ApiResponse<CustomerContact[]>>(`/customers/${id}/contacts`)
    .then((r) => r.data);

export const createCustomerContact = (id: number, body: CustomerContactInput) =>
  axiosInstance
    .post<ApiResponse<CustomerContact>>(`/customers/${id}/contacts`, body)
    .then((r) => r.data);

export const linkCustomerContact = (id: number, body: LinkCustomerContactBody) =>
  axiosInstance
    .post<ApiResponse<CustomerContact>>(`/customers/${id}/contacts/link`, body)
    .then((r) => r.data);

export const updateCustomerContact = (
  id: number,
  contactId: number,
  body: UpdateCustomerContactBody,
) =>
  axiosInstance
    .put<ApiResponse<CustomerContact>>(`/customers/${id}/contacts/${contactId}`, body)
    .then((r) => r.data);

export const deleteCustomerContact = (id: number, contactId: number) =>
  axiosInstance
    .delete<void>(`/customers/${id}/contacts/${contactId}`)
    .then(() => undefined);

export const getContacts = (params?: GetContactsParams) =>
  axiosInstance
    .get<PagedApiResponse<ContactListItem>>("/contacts", { params })
    .then((r) => r.data);

export const getContactById = (id: number) =>
  axiosInstance.get<ApiResponse<ContactDetail>>(`/contacts/${id}`).then((r) => r.data);

export const createContact = (body: ContactInput) =>
  axiosInstance.post<ApiResponse<Contact>>("/contacts", body).then((r) => r.data);

export const updateContact = (id: number, body: Partial<ContactInput>) =>
  axiosInstance.put<ApiResponse<Contact>>(`/contacts/${id}`, body).then((r) => r.data);

export const deactivateContact = (id: number) =>
  axiosInstance.delete<void>(`/contacts/${id}`).then(() => undefined);
