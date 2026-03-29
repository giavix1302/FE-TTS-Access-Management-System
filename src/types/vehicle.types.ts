export type VehicleStatus = "at_yard" | "renting" | "maintenance";
export type EngineType = "Electric" | "Fuel";

export interface Vehicle {
  id: number;
  license_plate: string;
  brand: string;
  model: string;
  year: number;
  engine_type: EngineType;
  seats: number;
  status: VehicleStatus;
  daily_rate: number;
  created_at: string;
  updated_at: string;
}
