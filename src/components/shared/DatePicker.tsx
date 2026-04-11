import { useState } from "react"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
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
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Chọn ngày",
  className,
  align = "start",
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
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
      <PopoverContent className="p-0 w-[300px]" align={align}>
        <Calendar
          mode="single"
          className="w-full"
          selected={value ? new Date(value) : undefined}
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
