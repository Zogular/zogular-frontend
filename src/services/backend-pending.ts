export const BACKEND_INTEGRATION_PENDING_MESSAGE =
  "This action is not available yet.";

export const OPERATIONS_PREVIEW_MESSAGE =
  "This page is a preview. Actions will become available in a future update.";

export class BackendIntegrationPendingError extends Error {
  constructor(featureName: string) {
    super(`${featureName}: ${BACKEND_INTEGRATION_PENDING_MESSAGE}`);
    this.name = "BackendIntegrationPendingError";
  }
}

export function throwBackendPendingFeature(featureName: string): never {
  throw new BackendIntegrationPendingError(featureName);
}
