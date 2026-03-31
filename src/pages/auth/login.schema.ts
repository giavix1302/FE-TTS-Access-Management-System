import { z } from "zod";

export const loginSchema = z.object({
  phone: z
    .string()
    .min(1, "Vui lòng nhập số điện thoại")
    .regex(/^(0[3|5|7|8|9])+([0-9]{8})$/, "Số điện thoại không hợp lệ"),
  password: z
    .string()
    .min(1, "Vui lòng nhập mật khẩu")
    .min(6, "Mật khẩu tối thiểu 6 ký tự"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
