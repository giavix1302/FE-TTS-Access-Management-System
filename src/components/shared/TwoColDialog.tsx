import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileUpload } from "@/components/shared/FileUpload";
import { cn } from "@/lib/utils";

// ─── File Preview Panel ────────────────────────────────────────────────────────
export function FilePreviewPanel({ file }: { file: File }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const isPdf = file.type === "application/pdf";
  const isImage = file.type.startsWith("image/");
  const isOffice =
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  return (
    <div className="flex flex-col h-full">
      {/* File info bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-bg-page border-b border-border rounded-t-lg shrink-0">
        <FileText className="h-4 w-4 text-primary shrink-0" />
        <p className="text-xs font-medium text-text-primary truncate flex-1">
          {file.name}
        </p>
        <span className="text-xs text-text-secondary shrink-0">
          {file.size < 1024 * 1024
            ? `${(file.size / 1024).toFixed(1)} KB`
            : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
        </span>
      </div>

      {/* Preview */}
      <div className="flex-1 bg-gray-100 rounded-b-lg overflow-hidden">
        {isPdf && objectUrl && (
          <iframe
            src={objectUrl}
            className="w-full h-full border-0"
            title="PDF preview"
          />
        )}
        {isImage && objectUrl && (
          <img
            src={objectUrl}
            alt="preview"
            className="w-full h-full object-contain"
          />
        )}
        {isOffice && (
          /* Office Online Viewer cần URL public — file cục bộ (blob:) Microsoft không tải được.
             Hiện placeholder thay vì màn hình lỗi của Microsoft. Preview thật khả dụng sau khi upload. */
          <div className="flex flex-col items-center justify-center h-full gap-3 text-text-secondary px-6 text-center">
            <FileText className="h-12 w-12 text-primary opacity-60" />
            <p className="text-sm font-medium text-text-primary">{file.name}</p>
            <p className="text-sm">
              File Word/Excel chỉ xem trước được sau khi tải lên. File đã sẵn sàng để đính kèm.
            </p>
          </div>
        )}
        {!isPdf && !isImage && !isOffice && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-text-secondary">
            <FileText className="h-12 w-12 opacity-30" />
            <p className="text-sm">Không hỗ trợ xem trước loại file này</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TwoColDialog ──────────────────────────────────────────────────────────────
// Layout: right panel (preview) always visible, left panel (form) slides in after file selected.
// Edit mode: pass `existingFileName` to show both panels immediately.

interface TwoColDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  /** Width of the left form panel (default 420px) */
  leftWidth?: number;
  /** File selected by user */
  file: File | null;
  onFileChange: (f: File | null) => void;
  /** In edit mode — both panels shown immediately */
  isEdit?: boolean;
  /** File name shown in preview header when editing */
  existingFileName?: string | null;
  /** SAS/public URL of the existing file — used to render preview in edit mode */
  existingFileUrl?: string | null;
  /** Upload zone label */
  uploadLabel?: string;
  /** Left panel content (form + footer) */
  children: React.ReactNode;
}

export function TwoColDialog({
  open,
  onOpenChange,
  title,
  leftWidth = 420,
  file,
  onFileChange,
  isEdit = false,
  existingFileName,
  existingFileUrl,
  uploadLabel = "Kéo thả hoặc nhấp để chọn file",
  children,
}: TwoColDialogProps) {
  // Show left panel if: edit mode OR file has been selected
  const hasPreview = isEdit || !!file;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden max-h-[90vh]"
        style={{ width: "80vw", maxWidth: "80vw" }}
      >
        <DialogHeader className="pb-4 border-b border-border shrink-0">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>

        <div
          className="flex flex-row overflow-hidden"
          style={{ height: "calc(90vh - 130px)" }}
        >
          {/* ── Left: Form — fixed width, hidden until file chosen ── */}
          <div
            className="relative flex flex-col border-r border-border shrink-0 transition-all duration-300"
            style={{
              width: hasPreview ? `${leftWidth}px` : "0px",
              overflow: "hidden",
            }}
          >
            {/* Inner scroll wrapper — fixed width so content doesn't collapse during animation */}
            <div
              className="w-full h-full overflow-y-auto flex flex-col"
              style={{ width: `${leftWidth}px` }}
            >
              {children}
            </div>
          </div>

          {/* ── Right: Preview — flex-1, never shrinks ── */}
          <div
            className={cn(
              "flex-1 min-w-0 overflow-hidden h-full transition-all duration-300",
              hasPreview ? "pt-4 pl-4" : "p-8",
            )}
          >
            {!hasPreview ? (
              /* No file yet — upload zone centered */
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="text-center">
                  <p className="text-lg font-semibold text-text-primary mb-1">
                    Bắt đầu bằng cách chọn file
                  </p>
                  <p className="text-sm text-text-secondary">
                    Sau khi chọn file, form nhập liệu sẽ hiện ra bên trái
                  </p>
                </div>
                <div className="w-full max-w-md">
                  <FileUpload
                    value={file}
                    onChange={onFileChange}
                    label={uploadLabel}
                  />
                </div>
                <p className="text-xs text-text-secondary">
                  PDF, DOCX, XLSX, JPEG, PNG — tối đa 20MB
                </p>
              </div>
            ) : file ? (
              /* New file selected — live preview */
              <FilePreviewPanel file={file} />
            ) : (
              /* Edit mode, no new file — preview existing file from server */
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-2 px-3 py-2 bg-bg-page border-b border-border rounded-t-lg shrink-0">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-xs font-medium text-text-primary truncate flex-1">
                    {existingFileName ?? "File đính kèm hiện tại"}
                  </p>
                  <span className="text-xs bg-primary-light text-primary px-1.5 py-0.5 rounded font-medium shrink-0">
                    Hiện tại
                  </span>
                </div>
                {existingFileUrl ? (
                  <div className="flex-1 bg-gray-100 rounded-b-lg overflow-hidden">
                    {existingFileName?.toLowerCase().endsWith(".pdf") ? (
                      <iframe
                        src={existingFileUrl}
                        className="w-full h-full border-0"
                        title="PDF preview"
                      />
                    ) : existingFileName?.match(/\.(jpe?g|png|gif|webp)$/i) ? (
                      <img
                        src={existingFileUrl}
                        alt="preview"
                        className="w-full h-full object-contain"
                      />
                    ) : existingFileName?.match(/\.(docx?|xlsx?)$/i) ? (
                      <iframe
                        src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(existingFileUrl)}`}
                        className="w-full h-full border-0"
                        title="Office preview"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-3 text-text-secondary">
                        <FileText className="h-12 w-12 opacity-30" />
                        <p className="text-sm">
                          Không hỗ trợ xem trước loại file này
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-gray-50 rounded-b-lg border border-t-0 border-border">
                    <FileText className="h-10 w-10 text-text-secondary opacity-40" />
                    <p className="text-sm text-text-secondary">
                      File không còn khả dụng để xem trước
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
