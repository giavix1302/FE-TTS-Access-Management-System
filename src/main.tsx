import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { router } from "@/router";
import { getApiErrorMessage, getApiErrorStatus, isConcurrentUpdateError } from "@/utils/apiError";
import "@/lib/zod";
import "./index.css";

function getQueryErrorMessage(error: unknown): string {
  const status = getApiErrorStatus(error);
  if (status === undefined) return "Không kết nối được máy chủ, vui lòng thử lại";
  if (status === 403) return getApiErrorMessage(error, "Bạn không có quyền xem dữ liệu này");
  if (status === 404) return getApiErrorMessage(error, "Không tìm thấy dữ liệu");
  if (status >= 500) return getApiErrorMessage(error, `Máy chủ gặp lỗi (${status}), vui lòng thử lại sau`);
  return getApiErrorMessage(error, "Không tải được dữ liệu");
}

const queryClient: QueryClient = new QueryClient({
  // Mọi query lỗi đều báo toast — trừ 401 (axios tự refresh/đưa về login) và query tự hiện lỗi (meta.silentError)
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.silentError || getApiErrorStatus(error) === 401) return;
      const message = getQueryErrorMessage(error);
      // id theo message → nhiều query lỗi cùng lúc chỉ hiện 1 toast.
      // 429: message đổi theo số giây còn lại nên dùng id cố định
      const id = getApiErrorStatus(error) === 429 ? "rate-limit" : `query-error:${message}`;
      toast.error(message, { id });
    },
  }),
  // 409 CONCURRENT_UPDATE: tải lại dữ liệu đang mở rồi để người dùng làm lại. Toast do onError của từng mutation hiện
  mutationCache: new MutationCache({
    onError: (error) => {
      if (isConcurrentUpdateError(error)) queryClient.invalidateQueries();
    },
  }),
  defaultOptions: {
    queries: {
      // 429: không tự retry — mỗi lần gọi lại vẫn tính vào giới hạn của BE
      retry: (failureCount, error) => getApiErrorStatus(error) !== 429 && failureCount < 1,
      staleTime: 1000 * 60,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
