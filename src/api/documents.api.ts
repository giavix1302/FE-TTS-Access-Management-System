import axiosInstance from "./axios";
import type { ContractDocument } from "@/types/contract.types";

export interface DocumentUrlDto {
  id: number;
  docType: string;
  fileName: string;
  sasUrl: string;
  sasExpiresAt: string;
  mimeType: string;
  fileSizeKb: number;
  note?: string | null;
  vehicleId?: number | null;
  uploadedAt: string;
  uploadedBy?: { id: number; fullName: string } | null;
}

export const getDocumentUrl = (documentId: number): Promise<DocumentUrlDto> =>
  axiosInstance.get(`/documents/${documentId}/url`).then((r) => r.data.data);

export interface UploadDocumentPayload {
  file: File;
  doc_type: "contract" | "addendum" | "acceptance" | "invoice" | "insurance" | "inspection" | "vehicle_image" | "logo" | "other";
  note?: string;
  /** true = upload ngay lúc chọn file trong dialog (chưa lưu record chính) — dọn tự động sau 3h nếu không được promote */
  is_temp?: boolean;
}

export const uploadDocument = ({ file, doc_type, note, is_temp }: UploadDocumentPayload): Promise<ContractDocument> => {
  const form = new FormData();
  form.append("files[]", file);
  form.append("doc_type", doc_type);
  if (note) form.append("note", note);
  if (is_temp) form.append("is_temp", "true");
  return axiosInstance
    .post("/documents", form, { headers: { "Content-Type": "multipart/form-data" } })
    .then((r) => r.data.data[0]);
};

export type EntityType =
  | "contract"
  | "addendum"
  | "acceptance"
  | "invoice"
  | "insurance"
  | "inspection";

export interface ReplaceDocumentPayload {
  documentId: number;
  file: File;
  entityType: EntityType;
  entityId: number;
  note?: string;
}

export const replaceDocument = ({
  documentId,
  file,
  entityType,
  entityId,
  note,
}: ReplaceDocumentPayload): Promise<ContractDocument> => {
  const form = new FormData();
  form.append("file", file);
  form.append("entity_type", entityType);
  form.append("entity_id", String(entityId));
  if (note) form.append("note", note);
  return axiosInstance
    .patch(`/documents/${documentId}/replace`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data.data);
};
