/**
 * Shared UI barrel — the primitives every feature is expected to build from.
 * Adding a new cross-feature primitive means exporting it here so the next TAB
 * finds it instead of re-inventing it.
 */
export * from './state/view-state';
export * from './brand/app-image';
export * from './brand/asset-manifest';
export * from './brand/brand-mark';
export * from './brand/brand-palette';
export * from './brand/brand.copy';
export * from './brand/contrast';
export * from './brand/municipal-seal';
export * from './pipes/barangay-name.pipe';
export * from './pipes/person-name.pipe';
export * from './pipes/peso.pipe';
export * from './pipes/relative-time.pipe';
export * from './ui/async-content/async-content';
export * from './ui/data-table/data-table';
export * from './ui/data-table/table-column';
export * from './ui/drawer/drawer';
export * from './ui/empty-state/empty-state';
export * from './ui/loading/loading-indicator';
export * from './ui/loading/skeleton';
export * from './ui/modal/modal';
export * from './ui/overlay/overlay.behavior';
export * from './ui/overlay/overlay.service';
export * from './ui/page-header/page-header';
export * from './ui/route-progress/route-progress';
export * from './ui/status-badge/status-badge';
export * from './ui/toast-host/toast-host';
