import { Link } from "react-router-dom";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-24 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-light">
        <SearchX className="h-10 w-10 text-primary" strokeWidth={1.5} />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-[length:var(--fs-title)] font-semibold text-text-primary">
          Không tìm thấy trang
        </h2>
        <p className="max-w-sm text-[length:var(--fs-base)] text-text-secondary">
          Đường dẫn không tồn tại hoặc đã bị thay đổi. Vui lòng kiểm tra lại địa chỉ.
        </p>
      </div>

      <Button asChild className="cursor-pointer mt-2">
        <Link to="/">Về trang chủ</Link>
      </Button>
    </div>
  );
}
