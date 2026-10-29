import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { router } from "@/router";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import "./index.css";

function getQueryErrorMessage(error: unknown): string {
  const status = getApiErrorStatus(error);
  if (status === undefined) return "Không kết nối được máy chủ, vui lòng thử lại";
  if (status === 403) return getApiErrorMessage(error, "Bạn không có quyền xem dữ liệu này");
  if (status === 404) return getApiErrorMessage(error, "Không tìm thấy dữ liệu");
  if (status >= 500) return getApiErrorMessage(error, `Máy chủ gặp lỗi (${status}), vui lòng thử lại sau`);
  return getApiErrorMessage(error, "Không tải được dữ liệu");
}

const queryClient = new QueryClient({
  // Mọi query lỗi đều báo toast — trừ 401 (axios tự refresh/đưa về login) và query tự hiện lỗi (meta.silentError)
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.silentError || getApiErrorStatus(error) === 401) return;
      const message = getQueryErrorMessage(error);
      // id theo message → nhiều query lỗi cùng lúc chỉ hiện 1 toast
      toast.error(message, { id: `query-error:${message}` });
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1,
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
