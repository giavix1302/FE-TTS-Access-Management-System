import { useState } from "react";
import { Controller } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VEHICLE_TYPE_OPTIONS } from "@/constants/vehicleType";
import {
  getCurrentPosition,
  type VehicleFormApi,
} from "@/pages/vehicles/components/vehicleForm.schema";

// ─── Fields ──────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[length:var(--fs-base)] font-medium">
        {label} {required && <span className="text-error">*</span>}
      </Label>
      {children}
      {error && <p className="text-[length:var(--fs-sm)] text-error">{error}</p>}
    </div>
  );
}

export function VehicleFormFields({
  form,
  mode,
}: {
  form: VehicleFormApi;
  mode: "create" | "edit";
}) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = form;
  const [locating, setLocating] = useState(false);

  const fillLocation = async () => {
    setLocating(true);
    try {
      const { lat, lng } = await getCurrentPosition();
      setValue("lat", lat, { shouldValidate: true });
      setValue("lng", lng, { shouldValidate: true });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLocating(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-3">
          {mode === "create" && (
            <Field label="Serial Number" required error={errors.serialNumber?.message}>
              <Input
                {...register("serialNumber")}
                placeholder="VD: SN-2021-001"
                className="border-border"
              />
            </Field>
          )}
          <Field label="Model" required error={errors.model?.message}>
            <Input {...register("model")} placeholder="VD: GS-3246" className="border-border" />
          </Field>
          <Field label="Hãng SX" required error={errors.manufacturer?.message}>
            <Input {...register("manufacturer")} placeholder="VD: Genie" className="border-border" />
          </Field>
          <Field label="Năm SX" required error={errors.manufactureYear?.message}>
            <Input
              {...register("manufactureYear")}
              type="number"
              placeholder="VD: 2022"
              className="border-border"
            />
          </Field>
        </div>

        <div className="flex flex-col gap-3">
          <Field label="Loại xe" required={mode === "create"} error={errors.vehicleType?.message}>
            <Controller
              control={control}
              name="vehicleType"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger className="border-border cursor-pointer">
                    <SelectValue placeholder="Chọn loại xe" />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Loại động cơ" required error={errors.engineType?.message}>
            <Controller
              control={control}
              name="engineType"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger className="border-border cursor-pointer">
                    <SelectValue placeholder="Chọn loại động cơ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Electric">Điện</SelectItem>
                    <SelectItem value="Fuel">Xăng/Dầu</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Tải trọng (kg)" error={errors.capacity?.message}>
            <Input
              {...register("capacity")}
              type="number"
              step="any"
              placeholder="VD: 227"
              className="border-border"
            />
          </Field>
          <Field label="Số người" error={errors.occupancy?.message}>
            <Input
              {...register("occupancy")}
              type="number"
              placeholder="VD: 2"
              className="border-border"
            />
          </Field>
          <Field label="Chiều cao sàn (m)" error={errors.platformHeight?.message}>
            <Input
              {...register("platformHeight")}
              type="number"
              step="any"
              placeholder="VD: 9.75"
              className="border-border"
            />
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Chiều cao LV (m)" error={errors.workHeight?.message}>
          <Input
            {...register("workHeight")}
            type="number"
            step="any"
            placeholder="VD: 11.75"
            className="border-border"
          />
        </Field>
        <Field label="Tốc độ nâng (m/s)" error={errors.liftingSpeed?.message}>
          <Input
            {...register("liftingSpeed")}
            type="number"
            step="any"
            placeholder="VD: 0.2"
            className="border-border"
          />
        </Field>
        <Field label="Tốc độ di chuyển (km/h)" error={errors.travelingSpeed?.message}>
          <Input
            {...register("travelingSpeed")}
            type="number"
            step="any"
            placeholder="VD: 3.2"
            className="border-border"
          />
        </Field>
      </div>

      {/* Sửa xe không gửi lat/lng → BE giữ vị trí cũ; cập nhật vị trí ở trang chi tiết */}
      {mode === "create" && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[length:var(--fs-base)] font-medium">Vị trí</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-border cursor-pointer h-7"
              onClick={fillLocation}
              disabled={locating}
            >
              {locating ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <LocateFixed className="h-3.5 w-3.5 mr-1" />
              )}
              Lấy vị trí hiện tại
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Input
                {...register("lat")}
                type="number"
                step="any"
                placeholder="Vĩ độ (lat)"
                className="border-border"
              />
              {errors.lat && (
                <p className="text-[length:var(--fs-sm)] text-error">{errors.lat.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Input
                {...register("lng")}
                type="number"
                step="any"
                placeholder="Kinh độ (lng)"
                className="border-border"
              />
              {errors.lng && (
                <p className="text-[length:var(--fs-sm)] text-error">{errors.lng.message}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <Field label="Ghi chú" error={errors.note?.message}>
        <Textarea
          {...register("note")}
          rows={3}
          placeholder="Ghi chú thêm về xe..."
          className="border-border resize-none"
        />
      </Field>
    </>
  );
}
