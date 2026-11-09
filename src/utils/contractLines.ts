import { formatCurrency } from "@/utils/format";
import type { ContractVehicle, LineItem } from "@/types/contract.types";

// Diễn giải lineTotal = unitPrice × quantity × (duration ?? 1). `unit` là đơn vị của đơn giá:
// có duration thì unit đi với thời gian, còn quantity là số xe (dòng thuê xe) hoặc số lần.
// VD: "8.000.000 ₫/Tháng × 2 xe × 1 Tháng", "1.600.000 ₫/Chuyến × 2 Chuyến"
export function formatLineCalculation(line: LineItem): string {
  const price = `${formatCurrency(line.unitPrice)}/${line.unit}`;
  if (line.service.allowVehicle) {
    const time = line.duration != null ? ` × ${line.duration} ${line.unit}` : "";
    return `${price} × ${line.quantity} xe${time}`;
  }
  if (line.duration != null) {
    return `${price} × ${line.quantity} lần × ${line.duration} ${line.unit}`;
  }
  return `${price} × ${line.quantity} ${line.unit}`;
}

// View model FE tự dựng: nối lineItems[] và vehicles[] (BE trả phẳng, tách rời) qua lineItemId
export interface LineView extends LineItem {
  /** Mọi lần giao của dòng, sắp theo id tăng dần (BE suy ra xe thay thế theo thứ tự id) */
  deployments: ContractVehicle[];
  /** Một lần giao chưa trả để tương thích các UI cũ; dòng có thể có nhiều xe chưa trả. */
  current?: ContractVehicle;
  currentDeployments: ContractVehicle[];
}

export function buildLineViews(lines: LineItem[], cvs: ContractVehicle[]): LineView[] {
  return [...lines]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map((li) => {
      const deployments = cvs.filter((v) => v.lineItemId === li.id).sort((a, b) => a.id - b.id);
      const currentDeployments = deployments.filter((v) => !v.returnDate);
      return { ...li, deployments, current: currentDeployments[0], currentDeployments };
    });
}

// Trạng thái thay xe của một dòng. Lần giao chiếm chỗ khi chưa được thay, và chưa trả hoặc đã có sự cố
// replacement (giữ chỗ cho xe sắp thay). Xe thay thế nhận lại đúng chỗ của xe bị thay.
export function getLineSlots(deployments: ContractVehicle[], replacementIncidentCvIds: Set<number>) {
  const replacedIds = new Set(
    deployments.map((d) => d.replacesContractVehicleId).filter((id): id is number => id != null),
  );
  const occupied = deployments.filter(
    (d) => !replacedIds.has(d.id) && (!d.returnDate || replacementIncidentCvIds.has(d.id)),
  ).length;
  // Gán xe thay thế được: đã xuất bãi, có sự cố replacement, chưa được thay (không cần xe cũ đã trả)
  const awaitingIds = new Set(
    deployments
      .filter((d) => !!d.deployDate && replacementIncidentCvIds.has(d.id) && !replacedIds.has(d.id))
      .map((d) => d.id),
  );
  return { occupied, replacedIds, awaitingIds };
}

// lineItems của HĐ gồm cả dòng gốc lẫn dòng phụ lục → tách theo addendumId (không có = dòng gốc)
export function splitLinesByAddendum<T extends LineItem>(lines: T[]) {
  const base: T[] = [];
  const byAddendum = new Map<number, T[]>();
  for (const li of lines) {
    if (li.addendumId == null) {
      base.push(li);
    } else {
      const group = byAddendum.get(li.addendumId) ?? [];
      group.push(li);
      byAddendum.set(li.addendumId, group);
    }
  }
  return { base, byAddendum };
}
