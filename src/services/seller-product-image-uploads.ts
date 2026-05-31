import { apiClient } from "@/services/api";

type ProductImageSignatureResponse = {
  status: string;
  data: {
    timestamp: number;
    signature: string;
    apiKey: string;
    cloudName: string;
    folder: string;
    allowedFormats: string[];
    maxFileSize: number;
  };
};

type CloudinaryUploadResponse = {
  secure_url?: string;
  public_id?: string;
  width?: number;
  height?: number;
  error?: {
    message?: string;
  };
};

export type UploadedSellerProductImage = {
  url: string;
  publicId: string;
  width: number | null;
  height: number | null;
};

export async function uploadSellerProductImage(
  file: File,
): Promise<UploadedSellerProductImage> {
  const signatureResponse = await apiClient<ProductImageSignatureResponse>(
    "/vendor/uploads/product-image/signature",
    {
      method: "POST",
      body: JSON.stringify({}),
      csrf: true,
    },
  );

  const uploadConfig = signatureResponse.data;

  if (file.size > uploadConfig.maxFileSize) {
    throw new Error("Image exceeds the 3MB upload limit.");
  }

  const formData = new FormData();
  formData.set("file", file, file.name);
  formData.set("api_key", uploadConfig.apiKey);
  formData.set("timestamp", String(uploadConfig.timestamp));
  formData.set("signature", uploadConfig.signature);
  formData.set("folder", uploadConfig.folder);
  formData.set("allowed_formats", uploadConfig.allowedFormats.join(","));
  formData.set("max_file_size", String(uploadConfig.maxFileSize));

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${uploadConfig.cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  const payload = (await response.json()) as CloudinaryUploadResponse;

  if (!response.ok) {
    throw new Error(payload.error?.message?.trim() || "Image upload failed.");
  }

  if (!payload.secure_url || !payload.public_id) {
    throw new Error("Cloudinary did not return a durable image reference.");
  }

  return {
    url: payload.secure_url,
    publicId: payload.public_id,
    width: typeof payload.width === "number" ? payload.width : null,
    height: typeof payload.height === "number" ? payload.height : null,
  };
}
