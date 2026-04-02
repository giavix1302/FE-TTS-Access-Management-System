import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ConfirmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "primary"
  loading?: boolean
  onConfirm: () => void
}

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  variant = "primary",
  loading = false,
  onConfirm,
}: ConfirmModalProps) {
  const confirmStyle =
    variant === "danger"
      ? { backgroundColor: "#E74C3C", color: "#fff" }
      : { backgroundColor: "#1A5FAB", color: "#fff" }

  const confirmHoverClass =
    variant === "danger" ? "hover:opacity-90" : "hover:opacity-90"

  return (
    <Dialog open={open} onOpenChange={loading ? undefined : onOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-semibold text-[#1A202C]">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-[15px] text-[#5A5A66] mt-1">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <DialogFooter className="mt-2 gap-2 sm:gap-2">
          <Button
            variant="outline"
            className="border-[#E2E8F0] text-[#5A5A66] hover:bg-[#F4F6F8] text-[15px]"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            className={`text-[15px] font-medium ${confirmHoverClass}`}
            style={confirmStyle}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
