import { useRef, useState, DragEvent, ChangeEvent } from "react"
import { Paperclip, X, UploadCloud, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const ACCEPTED_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
}

const ACCEPT_STRING = Object.keys(ACCEPTED_TYPES).join(",")
const MAX_SIZE_MB = 20
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

interface FileUploadProps {
  value?: File | null
  onChange: (file: File | null) => void
  label?: string
  disabled?: boolean
  className?: string
}

export function FileUpload({
  value,
  onChange,
  label = "Kéo thả hoặc nhấp để chọn file",
  disabled = false,
  className,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function validate(file: File): string | null {
    if (!ACCEPTED_TYPES[file.type]) {
      return `Định dạng không hỗ trợ. Chấp nhận: ${Object.values(ACCEPTED_TYPES).join(", ")}`
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `File quá lớn. Tối đa ${MAX_SIZE_MB}MB`
    }
    return null
  }

  function handleFile(file: File) {
    const err = validate(file)
    if (err) {
      setError(err)
      onChange(null)
    } else {
      setError(null)
      onChange(file)
    }
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ""
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (!disabled) setDragging(true)
  }

  function handleDragLeave() {
    setDragging(false)
  }

  function handleRemove() {
    setError(null)
    onChange(null)
  }

  function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F4F6F8] px-4 py-3">
          <Paperclip className="h-5 w-5 shrink-0 text-[#1A5FAB]" />
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-medium text-[#1A202C] truncate">{value.name}</p>
            <p className="text-[13px] text-[#718096]">{formatSize(value.size)}</p>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleRemove}
              className="shrink-0 rounded-full p-1 text-[#718096] hover:bg-[#E2E8F0] hover:text-[#E74C3C] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && !disabled && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 transition-colors cursor-pointer",
            dragging
              ? "border-[#1A5FAB] bg-[#E8F0FB]"
              : "border-[#E2E8F0] bg-[#F4F6F8] hover:border-[#1A5FAB] hover:bg-[#E8F0FB]",
            disabled && "opacity-50 cursor-not-allowed",
            error && "border-[#E74C3C] bg-[#FDECEA]"
          )}
        >
          <UploadCloud
            className={cn(
              "h-8 w-8",
              dragging ? "text-[#1A5FAB]" : "text-[#718096]"
            )}
          />
          <p className="text-[15px] text-[#5A5A66] text-center">{label}</p>
          <p className="text-[13px] text-[#718096]">
            PDF, JPEG, PNG, DOCX, XLSX — tối đa {MAX_SIZE_MB}MB
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-[#FDECEA] px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-[#E74C3C]" />
          <p className="text-[13px] text-[#E74C3C]">{error}</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_STRING}
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
      />
    </div>
  )
}
