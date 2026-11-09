import { type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { applyApiErrors } from "@/utils/apiError";
import { toDateOnly, todayInVietnam } from "@/utils/format";
import type {
  CreateVehicleBody,
  VehicleDetail,
  VehicleUpsertBody,
} from "@/types/vehicle.types";

// ─── Schema ───────────────────────────────────────────────────────────────────
// Ràng buộc theo docs/docs-be/vehicle_fe.md §4.3

// <input type="number"> rỗng trả "" → coi là chưa nhập (không coerce thành 0)
const emptyToUndefined = (v: unknown) =>
  v === "" || v == null || (typeof v === "number" && Number.isNaN(v)) ? undefined : v;

const optionalNumber = () =>
  z.preprocess(emptyToUndefined, z.coerce.number({ error: "Phải là số" }).optional());

const optionalPositive = (int = false) =>
  z.preprocess(
    emptyToUndefined,
    (int
      ? z.coerce.number({ error: "Phải là số" }).int("Phải là số nguyên")
      : z.coerce.number({ error: "Phải là số" })
    )
      .positive("Phải lớn hơn 0")
      .optional(),
  );

const maxYear = new Date().getFullYear() + 1;

export const makeVehicleSchema = (mode: "create" | "edit") =>
  z
    .object({
      serialNumber: z.string().trim().max(100, "Tối đa 100 ký tự").optional(),
      model: z.string({ error: "Bắt buộc nhập model xe" }).trim().min(1, "Bắt buộc nhập model xe").max(100, "Tối đa 100 ký tự"),
      manufacturer: z.string({ error: "Bắt buộc nhập hãng sản xuất" }).trim().min(1, "Bắt buộc nhập hãng sản xuất").max(100, "Tối đa 100 ký tự"),
      manufactureYear: z.preprocess(
        emptyToUndefined,
        z.coerce
          .number({ error: "Bắt buộc nhập năm sản xuất" })
          .int("Phải là số nguyên")
          .min(1900, "Năm không hợp lệ (từ 1900)")
          .max(maxYear, `Năm không hợp lệ (tối đa ${maxYear})`),
      ),
      engineType: z.enum(["Fuel", "Electric"], { error: "Bắt buộc chọn loại động cơ" }),
      // Thêm: bắt buộc. Sửa: xe cũ có thể chưa có loại → để trống = giữ nguyên
      vehicleType: z
        .enum(["telescopic_boom", "articulating_boom", "scissor", "vertical_mast", "spider"])
        .optional(),
      capacity: optionalPositive(),
      occupancy: optionalPositive(true),
      platformHeight: optionalNumber(),
      workHeight: optionalPositive(),
      liftingSpeed: optionalNumber(),
      travelingSpeed: optionalNumber(),
      note: z.string().trim().max(1000, "Tối đa 1000 ký tự").optional(),
      ownerName: z.string().trim().max(200, "Người sở hữu tối đa 200 ký tự").optional(),
      purchaseDate: z
        .string()
        .optional()
        .refine((v) => !v || v <= todayInVietnam(), "Ngày mua không được ở tương lai"),
      purchasePrice: z.number().min(0, "Giá mua không hợp lệ (không được âm)").optional(),
      lat: z.preprocess(
        emptyToUndefined,
        z.coerce.number({ error: "Phải là số" }).min(-90, "Từ -90 đến 90").max(90, "Từ -90 đến 90").optional(),
      ),
      lng: z.preprocess(
        emptyToUndefined,
        z.coerce.number({ error: "Phải là số" }).min(-180, "Từ -180 đến 180").max(180, "Từ -180 đến 180").optional(),
      ),
    })
    .superRefine((v, ctx) => {
      if (mode === "create" && !v.serialNumber) {
        ctx.addIssue({ code: "custom", path: ["serialNumber"], message: "Bắt buộc nhập số serial" });
      }
      if (mode === "create" && !v.vehicleType) {
        ctx.addIssue({ code: "custom", path: ["vehicleType"], message: "Bắt buộc chọn loại xe" });
      }
      // lat/lng đi theo cặp
      if ((v.lat == null) !== (v.lng == null)) {
        const path = v.lat == null ? "lat" : "lng";
        ctx.addIssue({ code: "custom", path: [path], message: "Nhập đủ cả vĩ độ và kinh độ" });
      }
    });

type VehicleSchema = ReturnType<typeof makeVehicleSchema>;
export type VehicleFormInput = z.input<VehicleSchema>;
export type VehicleFormValues = z.output<VehicleSchema>;
export type VehicleFormApi = UseFormReturn<VehicleFormInput, unknown, VehicleFormValues>;

export const EMPTY_VEHICLE_FORM: VehicleFormInput = {
  serialNumber: "",
  model: "",
  manufacturer: "",
  manufactureYear: "",
  engineType: undefined as unknown as "Fuel",
  vehicleType: undefined,
  capacity: "",
  occupancy: "",
  platformHeight: "",
  workHeight: "",
  liftingSpeed: "",
  travelingSpeed: "",
  note: "",
  ownerName: "",
  purchaseDate: "",
  purchasePrice: undefined,
  lat: "",
  lng: "",
};

export const vehicleToFormValues = (v: VehicleDetail): VehicleFormInput => ({
  serialNumber: v.serialNumber,
  model: v.model,
  manufacturer: v.manufacturer,
  manufactureYear: v.manufactureYear,
  engineType: v.engineType,
  vehicleType: v.vehicleType ?? undefined,
  capacity: v.capacity ?? "",
  occupancy: v.occupancy ?? "",
  platformHeight: v.platformHeight ?? "",
  workHeight: v.workHeight ?? "",
  liftingSpeed: v.liftingSpeed ?? "",
  travelingSpeed: v.travelingSpeed ?? "",
  note: v.note ?? "",
  ownerName: v.ownerName ?? "",
  purchaseDate: toDateOnly(v.purchaseDate) ?? "",
  purchasePrice: v.purchasePrice ?? undefined,
  lat: "",
  lng: "",
});

// PUT ghi đè toàn bộ: field trống gửi null (= xóa giá trị). lat/lng chỉ gửi khi có đủ cặp.
// vehicleType thì ngược lại: không gửi = giữ loại cũ (BE không cho xóa loại).
// Người sở hữu: "" = xóa. Ngày mua / giá mua: không gửi = giữ cũ, BE chưa có cách xóa trống
export const toVehicleBody = (v: VehicleFormValues): VehicleUpsertBody => ({
  model: v.model,
  manufacturer: v.manufacturer,
  manufactureYear: v.manufactureYear,
  engineType: v.engineType,
  ...(v.vehicleType ? { vehicleType: v.vehicleType } : {}),
  capacity: v.capacity ?? null,
  occupancy: v.occupancy ?? null,
  platformHeight: v.platformHeight ?? null,
  workHeight: v.workHeight ?? null,
  liftingSpeed: v.liftingSpeed ?? null,
  travelingSpeed: v.travelingSpeed ?? null,
  note: v.note || null,
  ownerName: v.ownerName ?? "",
  ...(v.purchaseDate ? { purchaseDate: v.purchaseDate } : {}),
  ...(v.purchasePrice != null ? { purchasePrice: v.purchasePrice } : {}),
  ...(v.lat != null && v.lng != null ? { lat: v.lat, lng: v.lng } : {}),
});

export const toCreateVehicleBody = (v: VehicleFormValues): CreateVehicleBody => ({
  // BE lưu serial cắt khoảng trắng + IN HOA, kiểm tra trùng theo dạng đó
  serialNumber: (v.serialNumber ?? "").trim().toUpperCase(),
  ...toVehicleBody(v),
  // Schema create đã bắt buộc vehicleType
  vehicleType: v.vehicleType!,
});

// Form sửa không hiện serial / vị trí → lỗi các ô này phải ra toast
const HIDDEN_WHEN_EDIT = ["serialNumber", "lat", "lng"];

// Map lỗi BE vào ô input, không map được thì toast
export const applyVehicleServerError = (
  err: unknown,
  form: VehicleFormApi,
  mode: "create" | "edit",
) =>
  applyApiErrors(
    err,
    form.setError,
    Object.keys(EMPTY_VEHICLE_FORM).filter((f) => mode === "create" || !HIDDEN_WHEN_EDIT.includes(f)),
  );

// ─── Geolocation ─────────────────────────────────────────────────────────────

export const getCurrentPosition = (): Promise<{ lat: number; lng: number }> =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Trình duyệt không hỗ trợ định vị"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? "Bạn chưa cho phép truy cập vị trí"
              : "Không lấy được vị trí hiện tại",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });
