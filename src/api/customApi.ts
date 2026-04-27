import "./interceptors";

import { apiClient, type ApiQueryParams, type ApiRequestConfig } from "./client";

type RequestOptions = Omit<
  ApiRequestConfig,
  "data" | "method" | "params" | "retryCount" | "url"
>;

export const customApiCall = {
  async get<T>(url: string, params?: ApiQueryParams, options?: RequestOptions): Promise<T> {
    const response = await apiClient.request<T>({
      url,
      method: "GET",
      params,
      ...options,
    });

    return response.data as T;
  },

  async post<T, TBody = unknown>(
    url: string,
    body?: TBody,
    options?: RequestOptions
  ): Promise<T> {
    const response = await apiClient.request<T>({
      url,
      method: "POST",
      data: body,
      ...options,
    });

    return response.data as T;
  },

  async put<T, TBody = unknown>(
    url: string,
    body?: TBody,
    options?: RequestOptions
  ): Promise<T> {
    const response = await apiClient.request<T>({
      url,
      method: "PUT",
      data: body,
      ...options,
    });

    return response.data as T;
  },

  async delete<T>(url: string, options?: RequestOptions): Promise<T> {
    const response = await apiClient.request<T>({
      url,
      method: "DELETE",
      ...options,
    });

    return response.data as T;
  },
};