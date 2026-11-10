import type { NotificationSeverity } from '@domain/index';

import type { IconName } from './icons';

/**
 * Each notification severity has its own shape, not only its own colour, so a
 * warning and an error can be told apart on a monochrome screen. Used by the
 * toasts and by the notification inbox, so the two never disagree.
 */
export const SEVERITY_ICONS: Readonly<Record<NotificationSeverity, IconName>> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
};
