import { persisted } from './persisted';

export interface Career { walletCents: number; upgrades: string[] }

export const career = persisted<Career>('op.career', { walletCents: 0, upgrades: [] });
