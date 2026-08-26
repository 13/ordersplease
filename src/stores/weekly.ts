import { persisted } from './persisted';
import type { WeeklyRecord } from '../core/weekly';

export const weekly = persisted<WeeklyRecord | null>('op.weekly', null);
