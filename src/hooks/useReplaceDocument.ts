import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { replaceDocument } from "@/api/documents.api";
import type { EntityType } from "@/api/documents.api";

interface UseReplaceDocumentOptions {
  documentId: number | undefined;
  entityType: EntityType;
  entityId: number;
  /** Query keys to invalidate on success */
  queryKeys: unknown[][];
}

export function useReplaceDocument({
  documentId,
  entityType,
  entityId,
  queryKeys,
}: UseReplaceDocumentOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => {
      if (!documentId) return Promise.reject(new Error("No document"));
      return replaceDocument({ documentId, file, entityType, entityId });
    },
    onSuccess: () => {
      queryKeys.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: key })
      );
      toast.success("Đã thay thế file thành công");
    },
    onError: () => toast.error("Thay thế file thất bại"),
  });
}
