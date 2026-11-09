import type { ServiceCatalogItem } from "@/types/serviceCatalog.types";

export const SERVICE_NAME_MAX = 200;
export const SERVICE_UNIT_MAX = 50;

// Đơn vị là văn bản tự do (BE không kiểm soát) → gợi ý để tránh "ngày" / "Ngày" / "ngay"
export const DEFAULT_UNITS = ["Ngày", "Giờ", "Chuyến", "Tháng", "Lần"];

// BE trim nhưng không gộp khoảng trắng giữa → FE trim + gộp khoảng trắng trước khi gửi
export const collapseSpaces = (s: string): string => s.trim().replace(/\s+/g, " ");

const fold = (s: string): string => collapseSpaces(s).toLowerCase();

const stripDiacritics = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

export const matchesSearch = (text: string, query: string): boolean => {
  const q = stripDiacritics(query.trim());
  return !q || stripDiacritics(text).includes(q);
};

// BE trả theo collation của DB → sắp lại để thứ tự tiếng Việt ổn định
export const sortServices = (all: ServiceCatalogItem[]): ServiceCatalogItem[] =>
  [...all].sort((a, b) => a.name.localeCompare(b.name, "vi"));

// BE coi trùng khi giống nhau không phân biệt hoa/thường (409) → chặn luôn.
// So với toàn bộ mảng đã tải, kể cả dịch vụ đã ẩn; bỏ qua chính nó để vẫn sửa được hoa/thường của tên
export function findDuplicateService(
  all: ServiceCatalogItem[],
  name: string,
  ignoreId?: number,
): ServiceCatalogItem | undefined {
  const target = fold(name);
  if (!target) return undefined;
  return all.find((s) => s.id !== ignoreId && fold(s.name) === target);
}

// Mặc định đứng trước để giữ cách viết chuẩn khi gộp không phân biệt hoa thường
export function collectUnits(all: ServiceCatalogItem[]): string[] {
  const seen = new Map<string, string>();
  const add = (u: string) => {
    const unit = collapseSpaces(u);
    const key = unit.toLowerCase();
    if (unit && !seen.has(key)) seen.set(key, unit);
  };
  DEFAULT_UNITS.forEach(add);
  [...all]
    .flatMap((s) => s.units)
    .sort((a, b) => a.localeCompare(b, "vi"))
    .forEach(add);
  return [...seen.values()];
}
