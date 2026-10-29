import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, Mail, Pencil, Phone, Trash2, User } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { deactivateContact, getContactById, updateContact } from "@/api/customers.api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { Skeleton } from "@/components/ui/skeleton";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { formatDateTime } from "@/utils/format";
import { getApiError, getApiErrorMessage } from "@/utils/apiError";
import { toast } from "sonner";
import { usePermission } from "@/hooks/usePermission";
import { isValidPhone, PHONE_INPUT_PATTERN, PHONE_VALIDATION_MESSAGE } from "@/utils/phone";

const valueOrDash = (value?: string) => value?.trim() || "—";
const fieldClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20";

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();
  const canUpdate = hasPermission("contacts.update");
  const canDelete = hasPermission("contacts.delete");
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const contactId = Number(id);
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.contacts.detail(contactId),
    queryFn: () => getContactById(contactId),
    enabled: Number.isInteger(contactId) && contactId > 0,
  });
  const contact = data?.data;
  const updateMutation = useMutation({
    mutationFn: (body: { fullName: string; phone: string; email: string }) => updateContact(contactId, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contacts.detail(contactId) }); queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contacts.all }); toast.success("Đã cập nhật người liên hệ"); setEditErrors({}); setEditing(false); },
    onError: (error: unknown) => {
      const apiError = getApiError(error);
      const nextErrors: Record<string, string> = {};
      apiError.details?.forEach(({ field, message }) => { nextErrors[field] = message; });
      if (apiError.code === "CONTACT_PHONE_OR_EMAIL_EXISTS" && !apiError.details?.length) {
        nextErrors.phone = apiError.message ?? "Số điện thoại hoặc email đã được sử dụng";
        nextErrors.email = apiError.message ?? "Số điện thoại hoặc email đã được sử dụng";
      }
      setEditErrors(nextErrors);
      toast.error(getApiErrorMessage(error));
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deactivateContact(contactId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: QUERY_KEYS.contacts.all }); toast.success("Đã vô hiệu hóa người liên hệ"); navigate("/contacts"); },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error)),
  });

  if (isLoading) return <Skeleton className="h-64 w-full rounded-lg" />;
  if (!contact) return <div className="py-24 text-center text-text-secondary">Không tìm thấy người liên hệ.</div>;

  return (
    <div className="flex flex-col gap-3 lg:gap-4">
      <button onClick={() => navigate("/contacts")} className="flex w-fit cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-[length:var(--fs-base)] text-text-secondary transition-colors hover:bg-primary-light hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Danh sách người liên hệ
      </button>
      <section className="rounded-lg border border-border bg-bg-card p-[var(--sp-card)] lg:p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#4F46E5]"><User className="h-8 w-8" /></span>
          <div className="flex-1"><h1 className="text-[length:var(--fs-heading)] font-semibold text-text-primary">{contact.fullName}</h1><p className="mt-1 text-[length:var(--fs-base)] text-text-secondary">Người liên hệ dùng chung giữa các khách hàng</p></div>
          {(canUpdate || canDelete) && <div className="flex shrink-0 gap-2">{canUpdate && <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="cursor-pointer border-border"><Pencil className="mr-1.5 h-4 w-4" />Chỉnh sửa</Button>}{canDelete && <Button variant="outline" size="sm" disabled={(contact.customers?.length ?? 0) > 0} onClick={() => setConfirmDelete(true)} className="cursor-pointer border-error text-error hover:bg-error hover:text-white"><Trash2 className="mr-1.5 h-4 w-4" />Vô hiệu hóa</Button>}</div>}
        </div>
      </section>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
        <section className="rounded-lg border border-border bg-bg-card p-[var(--sp-card)] lg:p-5">
          <h2 className="mb-3 border-b border-border pb-3 text-[length:var(--fs-nav)] font-semibold text-text-primary">Thông tin liên hệ</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><p className="text-[length:var(--fs-sm)] text-text-secondary">Điện thoại</p><p className="mt-0.5 flex items-center gap-1.5 text-[length:var(--fs-base)] font-medium text-text-primary"><Phone className="h-4 w-4 text-text-secondary" />{valueOrDash(contact.phone)}</p></div>
            <div><p className="text-[length:var(--fs-sm)] text-text-secondary">Email</p><p className="mt-0.5 flex items-center gap-1.5 text-[length:var(--fs-base)] font-medium text-text-primary"><Mail className="h-4 w-4 text-text-secondary" />{valueOrDash(contact.email)}</p></div>
          </div>
        </section>
        <section className="rounded-lg border border-border bg-bg-card p-[var(--sp-card)] lg:p-5">
          <h2 className="mb-3 border-b border-border pb-3 text-[length:var(--fs-nav)] font-semibold text-text-primary">Thông tin hệ thống</h2>
          <div className="grid gap-3 sm:grid-cols-2"><div><p className="text-[length:var(--fs-sm)] text-text-secondary">Tạo lúc</p><p className="mt-0.5 text-[length:var(--fs-base)] font-medium text-text-primary">{formatDateTime(contact.createdAt)}</p></div><div><p className="text-[length:var(--fs-sm)] text-text-secondary">Cập nhật lần cuối</p><p className="mt-0.5 text-[length:var(--fs-base)] font-medium text-text-primary">{formatDateTime(contact.updatedAt)}</p></div></div>
        </section>
      </div>
      {contact.customers && <section className="rounded-lg border border-border bg-bg-card p-[var(--sp-card)] lg:p-5">
        <h2 className="mb-3 border-b border-border pb-3 text-[length:var(--fs-nav)] font-semibold text-text-primary">Khách hàng đang liên kết ({contact.customers.length})</h2>
        <div className="grid gap-2">{contact.customers.map((customer) => <button key={customer.customerId} onClick={() => navigate(`/customers/${customer.customerId}`)} className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-border bg-bg-page px-3 py-2.5 text-left transition-colors hover:border-primary hover:bg-primary-light"><Building2 className="h-4 w-4 shrink-0 text-primary" /><span className="flex-1 font-medium text-text-primary">{customer.displayName}</span>{customer.title && <span className="text-sm text-text-secondary">{customer.title}</span>}{customer.isPrimary && <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs text-primary">Liên hệ chính</span>}</button>)}</div>
      </section>}
      <ContactEditDialog key={`${contact.id}-${editing}`} open={editing} onOpenChange={(value) => { setEditing(value); if (value) setEditErrors({}); }} contact={contact} loading={updateMutation.isPending} errors={editErrors} onSubmit={(body) => updateMutation.mutate(body)} />
      <ConfirmModal open={confirmDelete} onOpenChange={setConfirmDelete} title="Vô hiệu hóa người liên hệ?" description="Người liên hệ chỉ có thể vô hiệu hóa khi không còn liên kết với khách hàng." confirmLabel="Vô hiệu hóa" variant="danger" loading={deleteMutation.isPending} onConfirm={() => deleteMutation.mutate()} />
    </div>
  );
}

function ContactEditDialog({ open, onOpenChange, contact, loading, errors, onSubmit }: { open: boolean; onOpenChange: (value: boolean) => void; contact: { fullName: string; phone?: string; email?: string }; loading: boolean; errors: Record<string, string>; onSubmit: (body: { fullName: string; phone: string; email: string }) => void }) {
  const [fullName, setFullName] = useState(contact.fullName);
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [email, setEmail] = useState(contact.email ?? "");
  const phoneValid = isValidPhone(phone, false);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Chỉnh sửa người liên hệ</DialogTitle></DialogHeader><div className="space-y-3"><div><Label>Họ và tên</Label><input value={fullName} onChange={(event) => setFullName(event.target.value)} className={`${fieldClass} mt-1`} />{errors.fullName && <p className="mt-1 text-xs text-error">{errors.fullName}</p>}</div><div className="grid grid-cols-2 gap-3"><div><Label>Điện thoại</Label><input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" pattern={PHONE_INPUT_PATTERN} className={`${fieldClass} mt-1`} />{phone && !phoneValid && <p className="mt-1 text-xs text-error">{PHONE_VALIDATION_MESSAGE}</p>}{errors.phone && <p className="mt-1 text-xs text-error">{errors.phone}</p>}</div><div><Label>Email</Label><input value={email} onChange={(event) => setEmail(event.target.value)} className={`${fieldClass} mt-1`} />{errors.email && <p className="mt-1 text-xs text-error">{errors.email}</p>}</div></div><p className="text-xs text-text-secondary">Cần có ít nhất số điện thoại hoặc email.</p></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button><Button disabled={loading || !fullName.trim() || !(phone.trim() || email.trim()) || !phoneValid} onClick={() => onSubmit({ fullName: fullName.trim(), phone: phone.trim(), email: email.trim() })} className="bg-primary text-white hover:bg-primary-dark">{loading ? "Đang lưu..." : "Lưu thay đổi"}</Button></DialogFooter></DialogContent></Dialog>;
}
