import axiosInstance from "./axios";
import type { ContractDocument } from "@/types/contract.types";

export interface UploadDocumentPayload {
  file: File;
  doc_type: "contract" | "addendum" | "acceptance" | "invoice" | "insurance" | "inspection" | "vehicle_image" | "other";
  note?: string;
}

export const uploadDocument = ({ file, doc_type, note }: UploadDocumentPayload): Promise<ContractDocument> => {
  const form = new FormData();
  form.append("files[]", file);
  form.append("doc_type", doc_type);
  if (note) form.append("note", note);
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
