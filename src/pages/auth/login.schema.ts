import { z } from "zod";

const PHONE_RE = /^(0[3|5|7|8|9])+([0-9]{8})$/;

export const loginSchema = z.object({
  // BE phân biệt bằng ký tự @: có @ → email, không có → SĐT
  identifier: z
    .string({ error: "Vui lòng nhập số điện thoại hoặc email" })
    .trim()
    .min(1, "Vui lòng nhập số điện thoại hoặc email")
    .max(200, "Tối đa 200 ký tự")
    .refine(
      (v) => (v.includes("@") ? z.string().email().safeParse(v).success : PHONE_RE.test(v)),
      "Số điện thoại hoặc email không hợp lệ",
    ),
  password: z
    .string({ error: "Vui lòng nhập mật khẩu" })
    .min(1, "Vui lòng nhập mật khẩu")
    .min(6, "Mật khẩu tối thiểu 6 ký tự"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
