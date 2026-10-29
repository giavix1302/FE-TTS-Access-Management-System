import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, QrCode } from "lucide-react";
import { getVehicleByQr } from "@/api/vehicles.api";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { getApiError, getApiErrorMessage } from "@/utils/apiError";
import { Button } from "@/components/ui/button";

// Nội dung tem QR: https://<FE>/vehicles/qr/{qrCode} → tra xe rồi chuyển sang trang chi tiết
// (trang chi tiết có sẵn thao tác nhanh: đổi trạng thái + lấy vị trí hiện tại)
export default function VehicleQrPage() {
  const { code = "" } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const { data, error, isLoading } = useQuery({
    queryKey: QUERY_KEYS.vehicles.byQr(code.toUpperCase()),
    queryFn: () => getVehicleByQr(code).then((r) => r.data),
    enabled: !!code,
    retry: false,
  });

  useEffect(() => {
    if (data?.id) navigate(`/vehicles/${data.id}`, { replace: true });
  }, [data, navigate]);

  if (isLoading || data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-text-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-[length:var(--fs-base)]">Đang tra cứu mã QR...</p>
      </div>
    );
  }

  const notFound = !code || getApiError(error).code === "VEHICLE_NOT_FOUND";

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <QrCode className="h-12 w-12 text-text-secondary" />
      <p className="text-[length:var(--fs-title)] text-text-primary font-medium">
        {notFound ? "Mã QR không hợp lệ" : "Không tra cứu được mã QR"}
      </p>
      <p className="text-[length:var(--fs-base)] text-text-secondary max-w-sm">
        {notFound
          ? "Xe không tồn tại, đã bị xóa hoặc tem đã được thay mã mới."
          : getApiErrorMessage(error)}
      </p>
      <Button
        variant="outline"
        className="border-border cursor-pointer"
        onClick={() => navigate("/vehicles")}
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Danh sách xe
      </Button>
    </div>
  );
}
