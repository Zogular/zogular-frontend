export type SignedCloudinaryUploadConfig = {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
  publicId: string;
  reservedPublicId?: string;
  reservationId?: string;
  resourceType: "image" | "auto";
  type?: "upload" | "authenticated";
  uploadUrl: string;
  allowedFormats: string[];
  allowedMimeTypes: string[];
  maxFileSize: number;
};

export type CloudinaryDirectUploadResponse = {
  secure_url?: string;
  public_id?: string;
  format?: string;
  original_filename?: string;
  bytes?: number;
  width?: number;
  height?: number;
  version?: number;
  signature?: string;
  resource_type?: string;
  error?: {
    message?: string;
  };
};

function getFileExtension(file: File) {
  const segments = file.name.toLowerCase().split(".");
  return segments.length > 1 ? segments.pop() ?? "" : "";
}

export function isAllowedCloudinaryUploadFile(
  file: File,
  uploadConfig: SignedCloudinaryUploadConfig,
) {
  const normalizedType = file.type.toLowerCase();
  const normalizedExtension = getFileExtension(file);

  return (
    uploadConfig.allowedMimeTypes.includes(normalizedType) ||
    uploadConfig.allowedFormats.includes(normalizedExtension)
  );
}

export function isSupportedCloudinaryDeliveryType(
  value: unknown,
): value is NonNullable<SignedCloudinaryUploadConfig["type"]> {
  return value === "upload" || value === "authenticated";
}

export function uploadFileToCloudinary(
  uploadConfig: SignedCloudinaryUploadConfig,
  file: File,
  onProgress?: (progress: number) => void,
) {
  return new Promise<CloudinaryDirectUploadResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();

    formData.set("file", file, file.name);
    formData.set("api_key", uploadConfig.apiKey);
    formData.set("timestamp", String(uploadConfig.timestamp));
    formData.set("signature", uploadConfig.signature);
    if (uploadConfig.folder.trim()) {
      formData.set("folder", uploadConfig.folder);
    }
    formData.set("public_id", uploadConfig.publicId);
    if (isSupportedCloudinaryDeliveryType(uploadConfig.type)) {
      formData.set("type", uploadConfig.type);
    }

    xhr.open("POST", uploadConfig.uploadUrl);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.onabort = () => reject(new Error("Upload was cancelled."));
    xhr.onload = () => {
      let payload: CloudinaryDirectUploadResponse = {};

      try {
        payload = JSON.parse(xhr.responseText || "{}") as CloudinaryDirectUploadResponse;
      } catch {
        reject(new Error("Upload failed."));
        return;
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(payload.error?.message?.trim() || "Upload failed."));
        return;
      }

      resolve(payload);
    };

    xhr.send(formData);
  });
}
