import { useState } from "react"
import { CalendarIcon } from "lucide-react"
import { format, parseISO } from "date-fns"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface DatePickerProps {
  value?: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  align?: "start" | "center" | "end"
  /** yyyy-MM-dd — chặn chọn ngày trước ngày này */
  minDate?: string
  /** yyyy-MM-dd — chặn chọn ngày sau ngày này */
  maxDate?: string
  disabled?: boolean
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Chọn ngày",
  className,
  align = "start",
  minDate,
  maxDate,
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal cursor-pointer hover:bg-white hover:text-text-primary",
            className
          )}
        >
          <CalendarIcon size={14} className="mr-2 text-text-secondary" />
          {value ? (
            format(new Date(value), "dd/MM/yyyy")
          ) : (
            <span className="text-text-disabled">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] border-0 p-0" align={align}>
        <Calendar
          mode="single"
          className="w-full"
          selected={value ? new Date(value) : undefined}
          disabled={[
            ...(minDate ? [{ before: parseISO(minDate) }] : []),
            ...(maxDate ? [{ after: parseISO(maxDate) }] : []),
          ]}
          onSelect={(d) => {
            if (d) {
              onChange(format(d, "yyyy-MM-dd"))
              setOpen(false)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
