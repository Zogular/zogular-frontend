/**
 * @file index.ts
 * @module features/admin-disputes
 * @description
 * Public entrypoint for F10 Returns, Claims & Disputes Control Center.
 * Exports domain contracts, metadata mappings, API methods, and primary workspace component.
 */

export * from "./types";
export * from "./api/admin-disputes";
export * from "./hooks/use-admin-disputes";
export { AdminDisputesWorkspace } from "./components/AdminDisputesWorkspace";
export { DisputeQueueTabs } from "./components/DisputeQueueTabs";
export { DisputesTable } from "./components/DisputesTable";
export { DisputesMobileCards } from "./components/DisputesMobileCards";
export { DisputeDetailSheet } from "./components/DisputeDetailSheet";
