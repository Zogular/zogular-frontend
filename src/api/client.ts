import axios from "axios";
import { readLocalStorageValue } from "@/lib/persisted-storage";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

const SELLER_TOKEN_KEY = "zogular_seller_token";

function getSellerToken(): string | null {
  if (typeof window === "undefined") return null;
  return readLocalStorageValue(SELLER_TOKEN_KEY, ["zamoyo_seller_token"]);
}

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = getSellerToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
);
