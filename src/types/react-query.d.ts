import "@tanstack/react-query";

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: {
      // true → trang tự hiển thị lỗi, QueryCache không bắn toast chung
      silentError?: boolean;
    };
  }
}
