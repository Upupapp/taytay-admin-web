/**
 * Domain barrel. Import models from `@domain/index` (or a specific file) —
 * never reach into `@data/...` from a feature.
 */
export * from './access/access-policy';
export * from './access/credentials';
export * from './access/permission';
export * from './access/permission-matrix';
export * from './access/staff-user';
export * from './assistance/assistance-request';
export * from './assistance/transition-permissions';
export * from './dashboard/dashboard-summary';
export * from './disbursements/disbursement';
export * from './geography/barangay';
export * from './notifications/notification';
export * from './ports/access-context';
export * from './ports/repositories';
export * from './programs/program';
export * from './referrals/referral';
export * from './residents/resident';
export * from './shared/audit';
export * from './shared/ids';
export * from './shared/money';
export * from './shared/pagination';
export * from './shared/status';
