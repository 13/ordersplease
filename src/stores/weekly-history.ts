import { persisted } from './persisted';

export const weeklyHistory = persisted<Record<string, number>>('op.weekly-history', {});
