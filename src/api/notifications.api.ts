import axiosInstance from "./axios";

export const getNotifications = (params?: Record<string, unknown>) =>
  axiosInstance.get("/notifications", { params }).then((r) => r.data);

export const getUnreadCount = () =>
  axiosInstance.get("/notifications/unread-count").then((r) => r.data);

export const markAsRead = (id: number) =>
  axiosInstance.patch(`/notifications/${id}/read`).then((r) => r.data);

export const markAllAsRead = () =>
  axiosInstance.patch("/notifications/read-all").then((r) => r.data);
