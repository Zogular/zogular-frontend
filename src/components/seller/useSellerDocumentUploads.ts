import { useEffect, useMemo, useRef, useState } from "react";
import { uploadSellerDocument } from "@/services/seller-document-uploads";
import type {
  SellerDocumentField,
  SellerDocumentType,
  SellerDocumentUploadState,
} from "@/types/seller";

const SELLER_DOCUMENT_FIELD_CONFIG: Record<
  SellerDocumentField,
  {
    documentType: SellerDocumentType;
    accept: string;
  }
> = {
  nrcFrontUrl: {
    documentType: "NRC_FRONT",
    accept: "image/jpeg,image/jpg,image/png,image/webp",
  },
  nrcBackUrl: {
    documentType: "NRC_BACK",
    accept: "image/jpeg,image/jpg,image/png,image/webp",
  },
  shopPhotoUrl: {
    documentType: "SHOP_PHOTO",
    accept: "image/jpeg,image/jpg,image/png,image/webp",
  },
  pacraDocumentUrl: {
    documentType: "PACRA_DOCUMENT",
    accept: "image/jpeg,image/jpg,image/png,image/webp,application/pdf",
  },
};

const DOCUMENT_FIELDS = Object.keys(
  SELLER_DOCUMENT_FIELD_CONFIG,
) as SellerDocumentField[];

function getFileKindFromFile(file: File): "image" | "pdf" | null {
  if (file.type === "application/pdf") {
    return "pdf";
  }

  return file.type.startsWith("image/") ? "image" : null;
}

function getFileKindFromUrl(url: string): "image" | "pdf" | null {
  const normalizedUrl = url.toLowerCase();

  if (normalizedUrl.endsWith(".pdf")) {
    return "pdf";
  }

  if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(normalizedUrl)) {
    return "image";
  }

  return null;
}

function createInitialState(url?: string): SellerDocumentUploadState {
  if (!url?.trim()) {
    return {
      status: "idle",
      progress: 0,
      previewUrl: null,
      uploadedUrl: "",
      fileName: null,
      fileKind: null,
    };
  }

  const fileKind = getFileKindFromUrl(url);

  return {
    status: "uploaded",
    progress: 100,
    previewUrl: fileKind === "image" ? url : null,
    uploadedUrl: url,
    fileName: null,
    fileKind,
  };
}

export function useSellerDocumentUploads({
  values,
  onUrlChange,
  ensureApplication,
}: {
  values: Partial<Record<SellerDocumentField, string | undefined>>;
  onUrlChange: (field: SellerDocumentField, value: string) => void;
  ensureApplication: () => Promise<unknown>;
}) {
  const [states, setStates] = useState<Record<SellerDocumentField, SellerDocumentUploadState>>(
    () =>
      DOCUMENT_FIELDS.reduce(
        (accumulator, field) => {
          accumulator[field] = createInitialState(values[field]);
          return accumulator;
        },
        {} as Record<SellerDocumentField, SellerDocumentUploadState>,
      ),
  );
  const statesRef = useRef(states);
  const fileRefs = useRef(new Map<SellerDocumentField, File>());
  const uploadPromisesRef = useRef(new Map<SellerDocumentField, Promise<void>>());
  const objectUrlRefs = useRef(new Map<SellerDocumentField, string>());

  useEffect(() => {
    statesRef.current = states;
  }, [states]);

  useEffect(() => {
    const objectUrlMap = objectUrlRefs.current;
    return () => {
      objectUrlMap.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    setStates((current) => {
      let changed = false;
      const next = { ...current };

      for (const field of DOCUMENT_FIELDS) {
        if (uploadPromisesRef.current.has(field) || fileRefs.current.has(field)) {
          continue;
        }

        const incomingUrl = values[field]?.trim() ?? "";
        const currentState = current[field];

        if (!incomingUrl && currentState.status !== "idle") {
          next[field] = createInitialState("");
          changed = true;
          continue;
        }

        if (incomingUrl && currentState.uploadedUrl !== incomingUrl) {
          next[field] = createInitialState(incomingUrl);
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [values]);

  const hasUploadingDocuments = useMemo(
    () => DOCUMENT_FIELDS.some((field) => states[field].status === "uploading"),
    [states],
  );

  const hasFailedDocuments = useMemo(
    () => DOCUMENT_FIELDS.some((field) => states[field].status === "failed"),
    [states],
  );

  const setFieldState = (
    field: SellerDocumentField,
    updater: (current: SellerDocumentUploadState) => SellerDocumentUploadState,
  ) => {
    setStates((current) => ({
      ...current,
      [field]: updater(current[field]),
    }));
  };

  const revokeObjectUrl = (field: SellerDocumentField) => {
    const existingObjectUrl = objectUrlRefs.current.get(field);
    if (!existingObjectUrl) return;
    URL.revokeObjectURL(existingObjectUrl);
    objectUrlRefs.current.delete(field);
  };

  const uploadField = async (field: SellerDocumentField, file: File) => {
    const existingTask = uploadPromisesRef.current.get(field);
    if (existingTask) {
      return existingTask;
    }

    await ensureApplication();

    revokeObjectUrl(field);
    const fileKind = getFileKindFromFile(file);
    const previewUrl =
      fileKind === "image" ? URL.createObjectURL(file) : null;

    if (previewUrl) {
      objectUrlRefs.current.set(field, previewUrl);
    }

    fileRefs.current.set(field, file);

    setFieldState(field, (current) => ({
      status: "uploading",
      progress: 0,
      error: undefined,
      previewUrl,
      uploadedUrl: current.uploadedUrl,
      fileName: file.name,
      fileKind,
    }));

    const task = (async () => {
      try {
        const uploaded = await uploadSellerDocument(
          file,
          SELLER_DOCUMENT_FIELD_CONFIG[field].documentType,
          (progress) => {
            setFieldState(field, (current) => ({
              ...current,
              status: "uploading",
              progress,
            }));
          },
        );

        onUrlChange(field, uploaded.url);

        setFieldState(field, (current) => ({
          ...current,
          status: "uploaded",
          progress: 100,
          error: undefined,
          uploadedUrl: uploaded.url,
          previewUrl:
            current.previewUrl ||
            (current.fileKind === "image" ? uploaded.url : null),
          fileName: uploaded.originalFilename || current.fileName || file.name,
          fileKind:
            current.fileKind ||
            (uploaded.format === "pdf" ? "pdf" : current.fileKind),
        }));
      } catch (error) {
        setFieldState(field, (current) => ({
          ...current,
          status: "failed",
          progress: 0,
          error: error instanceof Error ? error.message : "Upload failed.",
        }));
      } finally {
        uploadPromisesRef.current.delete(field);
      }
    })();

    uploadPromisesRef.current.set(field, task);
    return task;
  };

  const selectDocument = async (field: SellerDocumentField, file?: File | null) => {
    if (!file) return;
    await uploadField(field, file);
  };

  const retryDocumentUpload = async (field: SellerDocumentField) => {
    const file = fileRefs.current.get(field);
    if (!file) {
      throw new Error("Choose the document again before retrying.");
    }

    await uploadField(field, file);
  };

  const ensureUploadsComplete = async () => {
    await Promise.all(uploadPromisesRef.current.values());

    const failedFields = DOCUMENT_FIELDS.filter(
      (field) => statesRef.current[field].status === "failed",
    );

    if (failedFields.length > 0) {
      throw new Error("Retry failed document uploads before continuing.");
    }
  };

  return {
    states,
    hasUploadingDocuments,
    hasFailedDocuments,
    selectDocument,
    retryDocumentUpload,
    ensureUploadsComplete,
    getAccept: (field: SellerDocumentField) =>
      SELLER_DOCUMENT_FIELD_CONFIG[field].accept,
  };
}
