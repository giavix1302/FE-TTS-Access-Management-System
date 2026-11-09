import { z } from "zod";

// Thông báo lỗi mặc định của Zod → tiếng Việt, áp dụng cho mọi schema (import 1 lần ở main.tsx).
// Message tự viết trong schema (`.min(1, "Bắt buộc")`, `{ error: "..." }`) luôn thắng cái mặc định này.
z.config(z.locales.vi());

// Ô chưa nhập thường là `undefined` (RHF không có defaultValue) → Zod báo lỗi kiểu dữ liệu
// ("Invalid input: expected string, received undefined") chứ không chạy tới `.min(1, "Bắt buộc")`.
// Đây chỉ là câu dự phòng ("Bắt buộc nhập" / "Bắt buộc chọn") cho ô chưa khai báo message riêng.
z.config({
  customError: (issue) => {
    const missing = issue.input === undefined || issue.input === null;
    if (missing && (issue.code === "invalid_type" || issue.code === "invalid_value")) {
      // Enum / ô chọn → "chọn"; còn lại → "nhập". Ô có tên riêng nên tự khai báo `{ error }` cho rõ nghĩa
      return issue.code === "invalid_value" ? "Bắt buộc chọn" : "Bắt buộc nhập";
    }
    // Ô số bị xóa trắng / nhập chữ → NaN
    if (issue.code === "invalid_type" && issue.expected === "number") return "Phải là số";
    return undefined; // rơi về bộ message tiếng Việt ở trên
  },
});
