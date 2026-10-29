import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { extractDocument } from "@/api/documents.api";
import { getApiError } from "@/utils/apiError";
import type { ExtractDocumentType } from "@/types/contract.types";
import { usePermission } from "@/hooks/usePermission";

interface DocumentExtractButtonProps<TFields> {
  documentId?: number;
  docType: ExtractDocumentType;
  onExtract: (fields: TFields) => void;
  disabled?: boolean;
  label?: string;
  onBusyChange?: (busy: boolean) => void;
}

function extractErrorMessage(error: unknown) {
  const { code, message } = getApiError(error);
  if (code === "DOCUMENT_NOT_FOUND") return "Tài liệu không tồn tại";
  if (code === "AI_INVALID_RESPONSE") return "AI không đọc được, vui lòng nhập tay";
  if (code === "EXTRACT_DISABLED" || code === "AI_PROVIDER_UNAVAILABLE") return "AI tạm thời không khả dụng";
  if (code === "EXTRACT_TIMEOUT") return "AI xử lý quá lâu, thử lại";
  return message ?? "Không thể đọc tài liệu";
}

export function DocumentExtractButton<TFields>({
  documentId,
  docType,
  onExtract,
  disabled,
  label = "Tự điền bằng AI",
  onBusyChange,
}: DocumentExtractButtonProps<TFields>) {
  const { hasPermission } = usePermission();
  const [extracting, setExtracting] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    setWarnings([]);
    setUnavailable(false);
  }, [documentId]);

  async function handleExtract() {
    if (!documentId || extracting) return;
    setExtracting(true);
    onBusyChange?.(true);
    try {
      const response = await extractDocument<TFields>(documentId, docType);
      onExtract(response.data.fields);
      setWarnings(response.data.extraction.warnings ?? []);
      toast.success("Đã tự điền dữ liệu từ tài liệu");
    } catch (error) {
      if (getApiError(error).code === "EXTRACT_DISABLED") setUnavailable(true);
      toast.error(extractErrorMessage(error));
    } finally {
      setExtracting(false);
      onBusyChange?.(false);
    }
  }

  if (!hasPermission("extract.use")) return null;

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!documentId || disabled || extracting || unavailable}
        onClick={handleExtract}
        className="cursor-pointer"
      >
        {extracting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {extracting ? "AI đang đọc..." : label}
      </Button>
      {warnings.length > 0 && (
        <div className="rounded-md border border-warning/30 bg-warning-light px-3 py-2 text-xs text-warning">
          <p className="font-medium">Cần kiểm tra lại:</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
