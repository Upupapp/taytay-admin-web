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
export * from './cases/case-timeline';
export * from './cases/case.copy';
export * from './cases/status-transition';
export * from './families/relationship-graph';
export * from './families/relationship.copy';
export * from './households/vulnerability-snapshot';
export * from './households/vulnerability.copy';
export * from './residents/person-picker';
export * from './residents/resident-summary-card';
export * from './pipes/barangay-name.pipe';
export * from './pipes/person-name.pipe';
export * from './pipes/peso.pipe';
export * from './pipes/relative-time.pipe';
export * from './ui/async-content/async-content';
export * from './ui/chart-table/chart-table';
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
export * from './ui/saved-views/saved-views-bar';
export * from './ui/status-badge/status-badge';
export * from './ui/toast-host/toast-host';
