import { persisted } from './persisted';
import type { DailyRecord } from '../core/daily';

export const daily = persisted<DailyRecord | null>('op.daily', null);
