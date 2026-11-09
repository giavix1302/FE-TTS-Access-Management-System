import { useRef, useState, type ReactElement, type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AppTooltipProps {
  /** Rỗng = không có tooltip, trả về nguyên children */
  content?: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  /** Chỉ hiện khi chữ của children đang bị cắt "..." (children có class `truncate`) */
  onlyWhenTruncated?: boolean;
  /** Một phần tử nhận được ref và props (button, a, span...) */
  children: ReactElement<{ disabled?: boolean }>;
}

function TruncatedTooltip({ content, side, children }: Omit<AppTooltipProps, "onlyWhenTruncated">) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <Tooltip
      delayDuration={100}
      open={open}
      // Đo lúc hover thay vì lúc render: độ rộng ô đổi theo màn hình và dữ liệu
      onOpenChange={(next) => {
        const el = triggerRef.current;
        setOpen(next && !!el && el.scrollWidth > el.clientWidth);
      }}
    >
      <TooltipTrigger asChild ref={triggerRef}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} onClick={(e) => e.stopPropagation()}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

/** Tooltip chuẩn của hệ thống — dùng thay cho thuộc tính `title`. */
export function AppTooltip({ content, side, onlyWhenTruncated, children }: AppTooltipProps) {
  if (!content) return children;
  if (onlyWhenTruncated) {
    return (
      <TruncatedTooltip content={content} side={side}>
        {children}
      </TruncatedTooltip>
    );
  }

  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        {/* Nút disable không bắn hover → bọc span để vẫn hiện tooltip */}
        {children.props.disabled ? <span className="inline-flex">{children}</span> : children}
      </TooltipTrigger>
      {/* Portal vẫn bubble theo cây React → chặn để không kích hoạt onClick của dòng / card cha */}
      <TooltipContent side={side} onClick={(e) => e.stopPropagation()}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
