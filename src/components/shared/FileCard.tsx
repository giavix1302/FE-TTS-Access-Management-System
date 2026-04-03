import { useState } from 'react'
import { format } from 'date-fns'
import {
  FileText, FileSpreadsheet, FileImage, Download, Trash2, Eye, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FileCardProps {
  fileName: string
  url: string
  /** File size in bytes — omit to hide */
  fileSize?: number
  /** ISO date string — omit to hide */
  createdAt?: string
  /** Full name of uploader — omit to hide */
  createdBy?: string
  onDelete?: () => void
  /** Override download handler. Default: open url in new tab */
  onDownload?: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type FileType = 'docx' | 'xlsx' | 'jpeg' | 'png' | 'pdf' | 'unknown'

function detectFileType(fileName: string, url: string): FileType {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.docx')) return 'docx'
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'xlsx'
  if (lower.endsWith('.pdf')) return 'pdf'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || url.includes('image/jpeg')) return 'jpeg'
  if (lower.endsWith('.png') || url.includes('image/png')) return 'png'
  return 'unknown'
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileLabel(type: FileType): string {
  const map: Record<FileType, string> = {
    docx: 'docx', xlsx: 'xlsx', jpeg: 'jpeg', png: 'png', pdf: 'pdf', unknown: 'file',
  }
  return map[type]
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FileTypeIcon({ type }: { type: FileType }) {
  const base = 'w-10 h-10 flex items-center justify-center rounded-lg shrink-0'

  if (type === 'jpeg' || type === 'png') {
    return (
      <div className={`${base} bg-[#E8F0FB]`}>
        <FileImage className="w-5 h-5 text-[#1A5FAB]" />
      </div>
    )
  }
  if (type === 'pdf') {
    return (
      <div className={`${base} bg-[#FDECEA]`}>
        <FileText className="w-5 h-5 text-[#E74C3C]" />
      </div>
    )
  }
  if (type === 'xlsx') {
    return (
      <div className={`${base} bg-[#E6F4EA]`}>
        <FileSpreadsheet className="w-5 h-5 text-[#27AE60]" />
      </div>
    )
  }
  // docx / unknown
  return (
    <div className={`${base} bg-[#EEF2F7]`}>
      <FileText className="w-5 h-5 text-[#5A5A66]" />
    </div>
  )
}

function PreviewModal({
  open, onClose, fileType, url, fileName,
}: {
  open: boolean
  onClose: () => void
  fileType: FileType
  url: string
  fileName: string
}) {
  const canPreview = fileType === 'jpeg' || fileType === 'png' || fileType === 'pdf'

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl h-[90dvh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-[#E2E8F0] shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[length:var(--fs-base)] font-medium text-[#1A202C] truncate pr-4">
              {fileName}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {!canPreview ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-[#5A5A66]">
              <FileText className="w-12 h-12 text-[#CBD5E0]" />
              <p className="text-[length:var(--fs-sm)]">
                Không hỗ trợ xem trực tiếp với định dạng này.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() => window.open(url, '_blank')}
              >
                <Download className="w-4 h-4 mr-1.5" />
                Tải về để xem
              </Button>
            </div>
          ) : fileType === 'pdf' ? (
            <iframe
              src={url}
              className="w-full h-full border-0"
              title={fileName}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-[#F4F6F8] p-4">
              <img
                src={url}
                alt={fileName}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FileCard({
  fileName,
  url,
  fileSize,
  createdAt,
  createdBy,
  onDelete,
  onDownload,
}: FileCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false)

  const fileType = detectFileType(fileName, url)
  const canPreview = fileType === 'jpeg' || fileType === 'png' || fileType === 'pdf'

  const metaParts: string[] = []
  metaParts.push(getFileLabel(fileType))
  if (fileSize !== undefined) metaParts.push(formatFileSize(fileSize))
  if (createdAt) metaParts.push(format(new Date(createdAt), 'dd/MM/yyyy'))
  if (createdBy) metaParts.push(createdBy)

  function handleDownload() {
    if (onDownload) {
      onDownload()
      return
    }
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.target = '_blank'
    a.rel = 'noreferrer'
    a.click()
  }

  return (
    <>
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F4F6F8] transition-colors">
        {/* S1 — File type icon */}
        <FileTypeIcon type={fileType} />

        {/* S2 — File info */}
        <div className="flex-1 min-w-0">
          <p className="text-[length:var(--fs-sm)] font-medium text-[#1A202C] truncate leading-snug">
            {fileName}
          </p>
          <p className="text-[length:var(--fs-xs,11px)] text-[#718096] mt-0.5 truncate">
            {metaParts.join(' | ')}
          </p>
        </div>

        {/* S3 — Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {canPreview && (
            <button
              type="button"
              title="Xem trước"
              className="p-1.5 rounded-md text-[#718096] hover:bg-[#E8F0FB] hover:text-[#1A5FAB] cursor-pointer transition-colors"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            title="Tải về"
            className="p-1.5 rounded-md text-[#718096] hover:bg-[#E8F0FB] hover:text-[#1A5FAB] cursor-pointer transition-colors"
            onClick={handleDownload}
          >
            <Download className="w-4 h-4" />
          </button>
          {onDelete && (
            <button
              type="button"
              title="Xóa"
              className="p-1.5 rounded-md text-[#718096] hover:bg-[#FDECEA] hover:text-[#E74C3C] cursor-pointer transition-colors"
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        fileType={fileType}
        url={url}
        fileName={fileName}
      />
    </>
  )
}
