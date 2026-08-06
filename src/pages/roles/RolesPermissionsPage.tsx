import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, Shield, AlertTriangle } from "lucide-react";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Permission, Role, RoleDetail } from "@/types/role.types";
import { getRoles, getRoleDetail, updateRolePermissions } from "@/api/roles.api";
import { getPermissions } from "@/api/permissions.api";


// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  admin:      "Admin",
  manager:    "Quản lý",
  accountant: "Kế toán",
  staff:      "Nhân viên",
};

const MODULE_LABEL: Record<string, string> = {
  vehicles:        "Quản lý xe",
  contracts:       "Hợp đồng",
  customers:       "Khách hàng",
  users:           "Người dùng",
  service_catalog: "Danh mục dịch vụ",
  dashboard:       "Dashboard",
  notifications:   "Thông báo",
  company:         "Cài đặt công ty",
  extract:         "AI Extract",
  roles:           "Phân quyền",
};

const ACTION_LABEL: Record<string, string> = {
  view:   "Xem",
  create: "Thêm",
  update: "Sửa",
  delete: "Xóa",
  use:    "Sử dụng",
};

// ─── PermissionEditor ─────────────────────────────────────────────────────────

interface PermissionEditorProps {
  roleDetail: RoleDetail;
  allPermissions: Permission[];
  onSaved: () => void;
}

function PermissionEditor({ roleDetail, allPermissions, onSaved }: PermissionEditorProps) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(roleDetail.permissions.map((p) => p.id))
  );
  const [showConfirm, setShowConfirm] = useState(false);

  const originalIds = new Set(roleDetail.permissions.map((p) => p.id));
  const isDirty =
    selected.size !== originalIds.size ||
    [...selected].some((id) => !originalIds.has(id));

  const grouped = allPermissions.reduce<Record<string, Permission[]>>((acc, p) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {});

  const { mutate, isPending } = useMutation({
    mutationFn: (ids: number[]) => updateRolePermissions(roleDetail.id, ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.roles.all });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.roles.detail(roleDetail.id) });
      toast.success("Đã cập nhật phân quyền");
      setShowConfirm(false);
      onSaved();
    },
    onError: () => toast.error("Có lỗi xảy ra"),
  });

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleModule = (permissions: Permission[]) => {
    const allChecked = permissions.every((p) => selected.has(p.id));
    setSelected((prev) => {
      const next = new Set(prev);
      permissions.forEach((p) =>
        allChecked ? next.delete(p.id) : next.add(p.id)
      );
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header role */}
      <div className="flex items-center gap-3 rounded-lg border border-[#E2E8F0] bg-white px-4 py-3">
        <Shield size={18} className="shrink-0 text-[#1A5FAB]" />
        <div>
          <p className="text-[length:var(--fs-base)] font-semibold text-[#1A3A5C]">
            {ROLE_LABEL[roleDetail.name] ?? roleDetail.name}
          </p>
          <p className="text-[length:var(--fs-body)] text-[#718096]">{roleDetail.description}</p>
        </div>
        <Badge className="ml-auto shrink-0 bg-[#E8F0FB] text-[#1A5FAB] hover:bg-[#E8F0FB]">
          {selected.size} quyền
        </Badge>
      </div>

      {/* Warning hiệu lực ngay */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[length:var(--fs-body)] text-amber-800">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <span>Thay đổi sẽ có hiệu lực ngay với tất cả người dùng thuộc vai trò này đang đăng nhập.</span>
      </div>

      {/* Permission groups */}
      <div className="flex flex-col gap-3">
        {Object.entries(grouped).map(([module, perms]) => {
          const allChecked = perms.every((p) => selected.has(p.id));
          const someChecked = perms.some((p) => selected.has(p.id));
          return (
            <div key={module} className="rounded-lg border border-[#E2E8F0]">
              {/* Module header — click để toggle cả nhóm */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleModule(perms)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggleModule(perms)}
                className="flex w-full cursor-pointer items-center gap-3 border-b border-[#E2E8F0] bg-white px-4 py-2.5 text-left"
              >
                <Checkbox
                  checked={allChecked}
                  data-indeterminate={!allChecked && someChecked}
                  className="pointer-events-none"
                  onCheckedChange={() => {}}
                />
                <span className="text-[length:var(--fs-body)] font-semibold text-[#2D3748]">
                  {MODULE_LABEL[module] ?? module}
                </span>
                <span className="ml-auto text-[length:var(--fs-body)] text-[#718096]">
                  {perms.filter((p) => selected.has(p.id)).length}/{perms.length}
                </span>
              </div>

              {/* Permission rows */}
              <div className="divide-y divide-[#F4F6F8] bg-white">
                {perms.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-primary-light"
                  >
                    <Checkbox
                      checked={selected.has(p.id)}
                      onCheckedChange={() => toggle(p.id)}
                    />
                    <span className="flex-1 text-[length:var(--fs-body)] text-[#4A5568]">
                      {p.description || `${MODULE_LABEL[p.module] ?? p.module} — ${ACTION_LABEL[p.action] ?? p.action}`}
                    </span>
                    <Badge
                      variant="outline"
                      className="shrink-0 text-[length:var(--fs-xs)] text-[#718096]"
                    >
                      {ACTION_LABEL[p.action] ?? p.action}
                    </Badge>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Nút lưu */}
      <div className="flex justify-end gap-2 border-t border-[#E2E8F0] pt-4">
        <Button
          onClick={() => setShowConfirm(true)}
          disabled={!isDirty || isPending}
          className="cursor-pointer bg-[#1A5FAB] hover:bg-[#15499A]"
        >
          Lưu thay đổi
        </Button>
      </div>

      <ConfirmModal
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Xác nhận cập nhật phân quyền"
        description={`Thay đổi phân quyền cho vai trò "${ROLE_LABEL[roleDetail.name] ?? roleDetail.name}" sẽ có hiệu lực ngay với tất cả người dùng đang đăng nhập. Bạn có chắc chắn muốn tiếp tục?`}
        confirmLabel="Xác nhận"
        cancelLabel="Hủy"
        variant="primary"
        loading={isPending}
        onConfirm={() => mutate([...selected])}
      />
    </div>
  );
}

// ─── RoleCard ─────────────────────────────────────────────────────────────────

interface RoleCardProps {
  role: Role;
  selected: boolean;
  onClick: () => void;
}

function RoleCard({ role, selected, onClick }: RoleCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full cursor-pointer rounded-lg border p-4 text-left transition-all",
        selected
          ? "border-[#1A5FAB] bg-[#E8F0FB] shadow-sm"
          : "border-[#E2E8F0] bg-white hover:border-[#1A5FAB] hover:bg-[#F8FAFC]"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            selected ? "bg-[#1A5FAB]" : "bg-[#E2E8F0]"
          )}
        >
          <Shield size={16} className={selected ? "text-white" : "text-[#718096]"} />
        </div>
        <div className="flex-1 overflow-hidden">
          <p
            className={cn(
              "text-[length:var(--fs-base)] font-semibold",
              selected ? "text-[#1A5FAB]" : "text-[#1A3A5C]"
            )}
          >
            {ROLE_LABEL[role.name] ?? role.name}
          </p>
          <p className="truncate text-[length:var(--fs-body)] text-[#718096]">
            {role.description}
          </p>
        </div>
        <Badge
          className={cn(
            "shrink-0 text-[length:var(--fs-xs)]",
            selected
              ? "bg-[#1A5FAB] text-white hover:bg-[#1A5FAB]"
              : "bg-[#F4F6F8] text-[#718096] hover:bg-[#F4F6F8]"
          )}
        >
          {role.permissions.length} quyền
        </Badge>
      </div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RolesPermissionsPage() {
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "editor">("list");

  const { data: rolesData } = useQuery({
    queryKey: QUERY_KEYS.roles.all,
    queryFn: getRoles,
  });

  const { data: permissionsData } = useQuery({
    queryKey: QUERY_KEYS.permissions.all,
    queryFn: getPermissions,
  });

  const { data: roleDetailData } = useQuery({
    queryKey: QUERY_KEYS.roles.detail(selectedRoleId!),
    queryFn: () => getRoleDetail(selectedRoleId!),
    enabled: selectedRoleId !== null,
  });

  const roles: Role[] = rolesData?.data ?? [];
  const allPermissions: Permission[] = permissionsData?.data ?? [];
  const roleDetail: RoleDetail | null = roleDetailData?.data ?? null;

  const handleSelectRole = (id: number) => {
    setSelectedRoleId(id);
    setMobileView("editor");
  };

  const handleSaved = () => {};

  return (
    <div className="flex flex-col gap-[var(--sp-section)]">
      <PageHeader title="Phân quyền vai trò" />

      {/* ── Desktop layout: 2 cột ── */}
      <div className="hidden gap-6 sm:grid sm:grid-cols-[280px_1fr]">
        {/* Cột trái — danh sách roles */}
        <div className="flex flex-col gap-3">
          <p className="text-[length:var(--fs-body)] font-medium text-[#718096]">
            Chọn vai trò để chỉnh sửa
          </p>
          {roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              selected={selectedRoleId === role.id}
              onClick={() => setSelectedRoleId(role.id)}
            />
          ))}
        </div>

        {/* Cột phải — editor */}
        <div>
          {roleDetail ? (
            <PermissionEditor
              key={roleDetail.id}
              roleDetail={roleDetail}
              allPermissions={allPermissions}
              onSaved={handleSaved}
            />
          ) : (
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-lg border border-dashed border-[#E2E8F0] text-[length:var(--fs-body)] text-[#718096]">
              Chọn một vai trò để xem và chỉnh sửa phân quyền
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile layout: 2 màn ── */}
      <div className="sm:hidden">
        {mobileView === "list" ? (
          <div className="flex flex-col gap-3">
            <p className="text-[length:var(--fs-body)] font-medium text-[#718096]">
              Chọn vai trò để chỉnh sửa
            </p>
            {roles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                selected={selectedRoleId === role.id}
                onClick={() => handleSelectRole(role.id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setMobileView("list")}
              className="flex cursor-pointer items-center gap-1 text-[length:var(--fs-body)] text-[#1A5FAB]"
            >
              <ChevronLeft size={16} />
              Danh sách vai trò
            </button>
            {roleDetail && (
              <PermissionEditor
                key={roleDetail.id}
                roleDetail={roleDetail}
                allPermissions={allPermissions}
                onSaved={() => {
                  handleSaved();
                  setMobileView("list");
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
