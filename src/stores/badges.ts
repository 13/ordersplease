import { persisted } from './persisted';

export const badges = persisted<string[]>('op.badges', []);
