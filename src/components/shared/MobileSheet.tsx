import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { ArrowLeft, X } from "lucide-react"
import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

// ─── Overlay ──────────────────────────────────────────────────────────────────

const MobileSheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/40",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
))
MobileSheetOverlay.displayName = "MobileSheetOverlay"

// ─── Content ──────────────────────────────────────────────────────────────────

interface MobileSheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Mobile variant: "sheet" = bottom sheet (default) | "fullscreen" = chiếm toàn màn hình */
  mobileVariant?: "sheet" | "fullscreen"
  /** Label nút back trên fullscreen (default "Quay lại") */
  backLabel?: string
  title?: string
  hideCloseButton?: boolean
}

const MobileSheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  MobileSheetContentProps
>(
  (
    {
      className,
      children,
      mobileVariant = "sheet",
      title,
      hideCloseButton = false,
      ...props
    },
    ref,
  ) => (
    <DialogPortal>
      <MobileSheetOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed z-50 bg-background shadow-lg duration-300",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          // ── Mobile: bottom sheet ───────────────────────────────────────────
          mobileVariant === "sheet" && [
            "bottom-0 left-0 right-0 w-full rounded-t-2xl",
            "max-h-[92dvh] overflow-y-auto",
            "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          ],
          // ── Mobile: fullscreen ─────────────────────────────────────────────
          mobileVariant === "fullscreen" && [
            "inset-0 w-full h-[100dvh] overflow-y-auto rounded-none flex flex-col",
            "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          ],
          // ── Desktop: centered modal ────────────────────────────────────────
          "sm:inset-auto sm:bottom-auto sm:rounded-lg sm:border sm:overflow-visible sm:h-auto sm:flex-none",
          "sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]",
          "sm:w-full sm:max-w-lg sm:max-h-none",
          "sm:data-[state=closed]:fade-out-0 sm:data-[state=open]:fade-in-0",
          "sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
          "sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%]",
          "sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]",
          "sm:p-6 sm:gap-4 sm:grid",
          className,
        )}
        {...props}
      >
        {/* Radix yêu cầu DialogTitle trong DOM cho accessibility */}
        <DialogPrimitive.Title className="sr-only">{title ?? "Dialog"}</DialogPrimitive.Title>

        {/* Drag handle — chỉ hiện trên mobile sheet */}
        {mobileVariant === "sheet" && (
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="h-1 w-10 rounded-full bg-border" />
          </div>
        )}

        {children}

        {/* Close button desktop */}
        {!hideCloseButton && (
          <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none hidden sm:block">
            <X className="h-5 w-5 cursor-pointer" />
            <span className="sr-only">Đóng</span>
          </DialogClose>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  ),
)
MobileSheetContent.displayName = "MobileSheetContent"

// ─── Header ───────────────────────────────────────────────────────────────────

interface MobileSheetHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Hiện nút X trên mobile (dùng cho sheet, không phải fullscreen) */
  showMobileClose?: boolean
}

const MobileSheetHeader = ({
  className,
  children,
  showMobileClose = true,
  ...props
}: MobileSheetHeaderProps) => (
  <div
    className={cn(
      "flex items-center justify-between gap-2 px-5 py-4 sm:px-0 sm:py-0",
      "border-b border-border sm:border-0",
      className,
    )}
    {...props}
  >
    <div className="flex-1">{children}</div>
    {showMobileClose && (
      <DialogClose className="sm:hidden rounded-full p-1.5 hover:bg-bg-page text-text-secondary cursor-pointer">
        <X className="h-5 w-5" />
        <span className="sr-only">Đóng</span>
      </DialogClose>
    )}
  </div>
)
MobileSheetHeader.displayName = "MobileSheetHeader"

// ─── Fullscreen Header (có nút back) ──────────────────────────────────────────

interface MobileSheetFullscreenHeaderProps
  extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  onBack?: () => void
}

const MobileSheetFullscreenHeader = ({
  title,
  onBack,
  className,
  ...props
}: MobileSheetFullscreenHeaderProps) => (
  <div
    className={cn(
      "flex items-center gap-3 px-4 py-3 border-b border-border bg-background sticky top-0 z-10 sm:hidden",
      className,
    )}
    {...props}
  >
    <DialogClose asChild>
      <button
        type="button"
        onClick={onBack}
        className="p-1.5 rounded-full hover:bg-bg-page text-text-secondary cursor-pointer"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
    </DialogClose>
    <p className="font-semibold text-text-primary text-[length:var(--fs-base)] flex-1 truncate">
      {title}
    </p>
  </div>
)
MobileSheetFullscreenHeader.displayName = "MobileSheetFullscreenHeader"

// ─── Title ────────────────────────────────────────────────────────────────────

const MobileSheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-[length:var(--fs-title)] font-semibold leading-none tracking-tight text-text-primary",
      className,
    )}
    {...props}
  />
))
MobileSheetTitle.displayName = "MobileSheetTitle"

// ─── Body ─────────────────────────────────────────────────────────────────────

const MobileSheetBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("px-5 py-4 flex flex-col gap-4 sm:px-0 sm:py-0", className)}
    {...props}
  />
)
MobileSheetBody.displayName = "MobileSheetBody"

// ─── Footer ───────────────────────────────────────────────────────────────────

const MobileSheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex items-center justify-end gap-2 px-5 py-4 border-t border-border",
      "sm:px-0 sm:py-0 sm:border-0 sm:flex-row sm:justify-end",
      className,
    )}
    {...props}
  />
)
MobileSheetFooter.displayName = "MobileSheetFooter"

export {
  Dialog as MobileSheetDialog,
  DialogClose as MobileSheetClose,
  MobileSheetContent,
  MobileSheetHeader,
  MobileSheetFullscreenHeader,
  MobileSheetTitle,
  MobileSheetBody,
  MobileSheetFooter,
}
