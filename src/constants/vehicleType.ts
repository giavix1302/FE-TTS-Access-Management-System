import type { VehicleType } from "@/types/vehicle.types";

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  telescopic_boom: "Boom Lift S",
  articulating_boom: "Boom Lift Z",
  scissor: "Cắt kéo",
  vertical_mast: "Trục đứng",
  spider: "Chân nhện",
};

export const VEHICLE_TYPE_OPTIONS = Object.entries(VEHICLE_TYPE_LABELS).map(
  ([value, label]) => ({ value: value as VehicleType, label }),
);

// Xe cũ chưa có loại → BE bỏ key
export function getVehicleTypeLabel(type: string | null | undefined) {
  if (!type) return "—";
  return VEHICLE_TYPE_LABELS[type as VehicleType] ?? type;
}
