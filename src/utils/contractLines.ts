import type { ContractVehicle, LineItem } from "@/types/contract.types";

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
