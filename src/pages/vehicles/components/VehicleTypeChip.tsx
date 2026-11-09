import { getVehicleTypeLabel } from "@/constants/vehicleType";

interface VehicleTypeChipProps {
  type: string | null | undefined;
  /** `sm`: thẻ mobile (chữ 10px) */
  size?: "md" | "sm";
}

// Xe cũ chưa có loại → "—" (không dựng chip rỗng)
export function VehicleTypeChip({ type, size = "md" }: VehicleTypeChipProps) {
  if (!type) return <span className="text-text-secondary">—</span>;
  const sizeClass =
    size === "sm"
      ? "px-2 py-0.5 text-[10px]"
      : "px-2.5 py-0.5 text-[length:var(--fs-sm)]";
  return (
    <span
      className={`inline-flex items-center rounded-full bg-accent-light font-medium text-accent ${sizeClass}`}
    >
      {getVehicleTypeLabel(type)}
    </span>
  );
}
