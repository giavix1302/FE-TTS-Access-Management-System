import { useNavigate } from "react-router-dom";
import { Construction } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ComingSoonPageProps {
  title: string;
  description?: string;
}

export default function ComingSoonPage({
  title,
  description = "Tính năng này đang được phát triển và sẽ sớm ra mắt.",
}: ComingSoonPageProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-24 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-light">
        <Construction className="h-10 w-10 text-primary" strokeWidth={1.5} />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-[length:var(--fs-title)] font-semibold text-text-primary">
          {title}
        </h2>
        <p className="max-w-sm text-[length:var(--fs-base)] text-text-secondary">
          {description}
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-full border border-border bg-bg-card px-4 py-1.5">
        <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
        <span className="text-[length:var(--fs-sm)] font-medium text-text-secondary">
          Đang phát triển
        </span>
      </div>

      <Button
        variant="outline"
        className="cursor-pointer mt-2"
        onClick={() => navigate(-1)}
      >
        Quay lại
      </Button>
    </div>
  );
}
