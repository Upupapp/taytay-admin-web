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
export * from './cases/case-event';
export * from './cases/case-note';
export * from './cases/case-task';
export * from './cases/case-workspace';
export * from './cases/social-case';
export * from './dashboard/dashboard-summary';
export * from './disbursements/disbursement';
export * from './families/family';
export * from './families/family-graph';
export * from './families/relationship';
export * from './families/relationship-event';
export * from './geography/barangay';
export * from './households/household';
export * from './households/household-profile';
export * from './households/household-vulnerability';
export * from './households/poverty-threshold';
export * from './notifications/notification';
export * from './ports/access-context';
export * from './ports/repositories';
export * from './programs/program';
export * from './referrals/referral';
export * from './residents/resident';
export * from './residents/resident-disclosure';
export * from './residents/resident-profile';
export * from './views/saved-view';
export * from './shared/audit';
export * from './shared/ids';
export * from './shared/money';
export * from './shared/pagination';
export * from './shared/status';
