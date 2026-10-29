import type { ServiceCatalogItem } from "@/types/serviceCatalog.types";

export const SERVICE_NAME_MAX = 200;
export const SERVICE_UNIT_MAX = 50;

// Đơn vị là văn bản tự do (BE không kiểm soát) → gợi ý để tránh "ngày" / "Ngày" / "ngay"
export const DEFAULT_UNITS = ["Ngày", "Giờ", "Chuyến", "Tháng", "Lần"];

// BE so sánh tên đúng từng ký tự, không trim → FE trim + gộp khoảng trắng trước khi gửi
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

export interface DuplicateMatch {
  // exact: trùng đúng từng ký tự → BE sẽ 409, chặn luôn
  // similar: chỉ khác hoa/thường → cảnh báo mềm
  kind: "exact" | "similar";
  item: ServiceCatalogItem;
}

// So với toàn bộ mảng đã tải, kể cả dịch vụ đã ẩn
export function findDuplicateService(
  all: ServiceCatalogItem[],
  name: string,
  ignoreId?: number,
): DuplicateMatch | undefined {
  const target = collapseSpaces(name);
  if (!target) return undefined;
  let similar: DuplicateMatch | undefined;
  for (const s of all) {
    if (s.id === ignoreId) continue;
    if (s.name === target) return { kind: "exact", item: s };
    if (!similar && fold(s.name) === fold(target)) similar = { kind: "similar", item: s };
  }
  return similar;
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
