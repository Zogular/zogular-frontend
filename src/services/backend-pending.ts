export const BACKEND_INTEGRATION_PENDING_MESSAGE =
  "This action is disabled until backend support is implemented.";

export const OPERATIONS_PREVIEW_MESSAGE =
  "Operations-only preview. Backend integration pending.";

export class BackendIntegrationPendingError extends Error {
  constructor(featureName: string) {
    super(`${featureName}: ${BACKEND_INTEGRATION_PENDING_MESSAGE}`);
    this.name = "BackendIntegrationPendingError";
  }
}

export function throwBackendPendingFeature(featureName: string): never {
  throw new BackendIntegrationPendingError(featureName);
}
