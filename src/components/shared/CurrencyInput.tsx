import { type ChangeEvent } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

function formatThousands(digits: string): string {
  if (!digits) return ""
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

interface CurrencyInputProps {
  value: number | undefined
  onChange: (value: number | undefined) => void
  disabled?: boolean
  className?: string
  placeholder?: string
  id?: string
}

/** Input tiền VNĐ — format dấu chấm phân cách hàng nghìn ngay khi gõ (vd: 38000000 → 38.000.000). */
export function CurrencyInput({
  value,
  onChange,
  disabled,
  className,
  placeholder,
  id,
}: CurrencyInputProps) {
  // Derived trực tiếp từ value — không giữ state nội bộ để tránh lệch pha với
  // các setValue() khác (vd: effect tự-tính taxAmount/totalAmount) khiến hiển thị sai giá trị thật.
  const display = value !== undefined ? formatThousands(String(value)) : ""

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "")
    onChange(digits === "" ? undefined : Number(digits))
  }

  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      disabled={disabled}
      placeholder={placeholder}
      className={cn(className)}
    />
  )
}
