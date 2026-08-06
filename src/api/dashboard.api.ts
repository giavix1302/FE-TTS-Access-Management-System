import axiosInstance from "./axios";

// BE trả envelope `{ success, data: [{...}] }` cho cả 3 endpoint → lấy data[0]
export const getDashboardSummary = () =>
  axiosInstance.get("/dashboard/summary").then((r) => r.data.data[0]);

export const getDashboardCharts = () =>
  axiosInstance.get("/dashboard/charts").then((r) => r.data.data[0]);

export const getDashboardAlerts = () =>
  axiosInstance.get("/dashboard/alerts").then((r) => r.data.data[0]);
