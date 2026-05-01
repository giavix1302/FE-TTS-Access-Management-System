import { useState, useEffect } from "react"
import { FileText } from "lucide-react"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import {
  MobileSheetDialog,
  MobileSheetContent,
  MobileSheetFullscreenHeader,
} from "./MobileSheet"
import { TwoColDialog, FilePreviewPanel } from "./TwoColDialog"
import { FileUpload } from "./FileUpload"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface MobileTwoColDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  leftWidth?: number
  file: File | null
  onFileChange: (f: File | null) => void
  isEdit?: boolean
  existingFileName?: string | null
  existingFileUrl?: string | null
  uploadLabel?: string
  children: React.ReactNode
}

// ─── Mobile Tab Bar ───────────────────────────────────────────────────────────

function TabBar({
  active,
  onChange,
  hasFile,
}: {
  active: "document" | "form"
  onChange: (tab: "document" | "form") => void
  hasFile: boolean
}) {
  return (
    <div className="flex border-b border-border bg-background sticky top-[53px] z-10">
      <button
        type="button"
        onClick={() => onChange("document")}
        className={cn(
          "flex-1 py-2.5 text-[length:var(--fs-sm)] font-medium transition-colors cursor-pointer",
          active === "document"
            ? "text-primary border-b-2 border-primary"
            : "text-text-secondary hover:text-text-primary",
        )}
      >
        Tài liệu
      </button>
      <button
        type="button"
        onClick={() => onChange("form")}
        className={cn(
          "flex-1 py-2.5 text-[length:var(--fs-sm)] font-medium transition-colors cursor-pointer",
          active === "form"
            ? "text-primary border-b-2 border-primary"
            : "text-text-secondary hover:text-text-primary",
          !hasFile && "opacity-50 pointer-events-none",
        )}
      >
        Thông tin
      </button>
    </div>
  )
}

// ─── Mobile preview panel (existing file) ─────────────────────────────────────

function ExistingFilePreview({
  fileName,
  fileUrl,
}: {
  fileName?: string | null
  fileUrl?: string | null
}) {
  if (!fileUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-text-secondary py-12">
        <FileText className="h-10 w-10 opacity-30" />
        <p className="text-sm">File không còn khả dụng</p>
      </div>
    )
  }

  const isImage = !!fileName?.match(/\.(jpe?g|png|gif|webp)$/i)
  const isPdf = !!fileName?.toLowerCase().endsWith(".pdf")
  const isOffice = !!fileName?.match(/\.(docx?|xlsx?)$/i)

  return (
    <div className="flex flex-col h-[300px]">
      <div className="flex items-center gap-2 px-3 py-2 bg-bg-page border-b border-border shrink-0">
        <FileText className="h-4 w-4 text-primary shrink-0" />
        <p className="text-xs font-medium text-text-primary truncate flex-1">
          {fileName ?? "File đính kèm hiện tại"}
        </p>
        <span className="text-xs bg-primary-light text-primary px-1.5 py-0.5 rounded font-medium shrink-0">
          Hiện tại
        </span>
      </div>
      <div className="flex-1 bg-gray-100 overflow-hidden">
        {isPdf && (
          <iframe src={fileUrl} className="w-full h-full border-0" title="PDF preview" />
        )}
        {isImage && (
          <img src={fileUrl} alt="preview" className="w-full h-full object-contain" />
        )}
        {isOffice && (
          <iframe
            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`}
            className="w-full h-full border-0"
            title="Office preview"
          />
        )}
        {!isPdf && !isImage && !isOffice && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-text-secondary">
            <FileText className="h-10 w-10 opacity-30" />
            <p className="text-sm">Không hỗ trợ xem trước</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── MobileTwoColDialog ───────────────────────────────────────────────────────

export function MobileTwoColDialog({
  open,
  onOpenChange,
  title,
  leftWidth,
  file,
  onFileChange,
  isEdit = false,
  existingFileName,
  existingFileUrl,
  uploadLabel,
  children,
}: MobileTwoColDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 640px)")
  const hasFile = isEdit || !!file
  const [activeTab, setActiveTab] = useState<"document" | "form">(
    isEdit ? "form" : "document",
  )

  // Tự động chuyển sang tab form khi user chọn file
  useEffect(() => {
    if (file) setActiveTab("form")
  }, [file])

  // Reset tab khi đóng/mở lại
  useEffect(() => {
    if (!open) return
    setActiveTab(isEdit ? "form" : "document")
  }, [open, isEdit])

  // Desktop: chỉ render TwoColDialog gốc
  if (isDesktop) {
    return (
      <TwoColDialog
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        leftWidth={leftWidth}
        file={file}
        onFileChange={onFileChange}
        isEdit={isEdit}
        existingFileName={existingFileName}
        existingFileUrl={existingFileUrl}
        uploadLabel={uploadLabel}
      >
        {children}
      </TwoColDialog>
    )
  }

  // Mobile: fullscreen với 2 tab
  return (
    <MobileSheetDialog open={open} onOpenChange={onOpenChange}>
      <MobileSheetContent mobileVariant="fullscreen">
            {/* Header với nút back */}
            <MobileSheetFullscreenHeader title={title} />

            {/* Tab bar */}
            <TabBar
              active={activeTab}
              onChange={setActiveTab}
              hasFile={hasFile}
            />

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {/* Tab: Tài liệu */}
              {activeTab === "document" && (
                <div className="p-4 flex flex-col gap-4">
                  {isEdit ? (
                    <ExistingFilePreview
                      fileName={existingFileName}
                      fileUrl={existingFileUrl}
                    />
                  ) : file ? (
                    <div className="h-[300px]">
                      <FilePreviewPanel file={file} />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <p className="text-[length:var(--fs-sm)] text-text-secondary">
                        Chọn file để đính kèm, sau đó điền thông tin ở tab Thông tin
                      </p>
                      <FileUpload
                        value={file}
                        onChange={onFileChange}
                        label={uploadLabel}
                      />
                      <p className="text-xs text-text-secondary text-center">
                        PDF, DOCX, XLSX, JPEG, PNG — tối đa 20MB
                      </p>
                    </div>
                  )}

                  {/* Nếu đang edit, vẫn cho phép thay file mới */}
                  {isEdit && (
                    <div className="border-t border-border pt-4 flex flex-col gap-2">
                      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                        Thay thế file
                      </p>
                      <FileUpload
                        value={file}
                        onChange={onFileChange}
                        label="Kéo thả hoặc chọn file mới"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Thông tin (form + footer từ children) */}
              {activeTab === "form" && (
                <div className="flex flex-col">
                  {children}
                </div>
              )}
            </div>
          </MobileSheetContent>
    </MobileSheetDialog>
  )
}
