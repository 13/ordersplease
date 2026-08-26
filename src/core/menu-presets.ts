import type { MenuItem } from './menu';

export interface MenuPreset {
  id: string;
  nameEn: string;
  nameDe: string;
  items: {
    id: string; nameEn: string; nameDe: string;
    priceCents: number; category: 'drink' | 'food';
  }[];
}

export const MENU_PRESETS: MenuPreset[] = [
  {
    id: 'feuerwehrfest',
    nameEn: 'Fire Brigade Festival',
    nameDe: 'Feuerwehrfest',
    items: [
      { id: 'ff-bier', nameEn: 'Beer', nameDe: 'Bier', priceCents: 350, category: 'drink' },
      { id: 'ff-radler', nameEn: 'Radler', nameDe: 'Radler', priceCents: 350, category: 'drink' },
      { id: 'ff-cola', nameEn: 'Cola', nameDe: 'Cola', priceCents: 250, category: 'drink' },
      { id: 'ff-schnaps', nameEn: 'Schnapps', nameDe: 'Schnaps', priceCents: 200, category: 'drink' },
      { id: 'ff-kaffee', nameEn: 'Coffee', nameDe: 'Kaffee', priceCents: 200, category: 'drink' },
      { id: 'ff-bratwurst', nameEn: 'Bratwurst', nameDe: 'Bratwurst', priceCents: 300, category: 'food' },
      { id: 'ff-steckerlfisch', nameEn: 'Grilled Fish on a Stick', nameDe: 'Steckerlfisch', priceCents: 800, category: 'food' },
      { id: 'ff-pommes', nameEn: 'Fries', nameDe: 'Pommes', priceCents: 350, category: 'food' },
    ],
  },
  {
    id: 'dorffest',
    nameEn: 'Village Festival',
    nameDe: 'Dorffest',
    items: [
      { id: 'df-helles', nameEn: 'Lager', nameDe: 'Helles', priceCents: 300, category: 'drink' },
      { id: 'df-weisswein', nameEn: 'White Wine', nameDe: 'Weißwein', priceCents: 350, category: 'drink' },
      { id: 'df-apfelschorle', nameEn: 'Apple Spritzer', nameDe: 'Apfelschorle', priceCents: 250, category: 'drink' },
      { id: 'df-kaffee', nameEn: 'Coffee', nameDe: 'Kaffee', priceCents: 200, category: 'drink' },
      { id: 'df-kaesespaetzle', nameEn: 'Cheese Spätzle', nameDe: 'Käsespätzle', priceCents: 650, category: 'food' },
      { id: 'df-haehnchen', nameEn: 'Half Grilled Chicken', nameDe: 'Grillhähnchen halb', priceCents: 700, category: 'food' },
      { id: 'df-kuchen', nameEn: 'Cake', nameDe: 'Kuchen', priceCents: 250, category: 'food' },
      { id: 'df-langos', nameEn: 'Langos', nameDe: 'Langos', priceCents: 500, category: 'food' },
    ],
  },
  {
    id: 'weihnachtsmarkt',
    nameEn: 'Christmas Market',
    nameDe: 'Weihnachtsmarkt',
    items: [
      { id: 'wm-gluehwein', nameEn: 'Mulled Wine', nameDe: 'Glühwein', priceCents: 400, category: 'drink' },
      { id: 'wm-kinderpunsch', nameEn: "Children's Punch", nameDe: 'Kinderpunsch', priceCents: 300, category: 'drink' },
      { id: 'wm-eierpunsch', nameEn: 'Egg Punch', nameDe: 'Eierpunsch', priceCents: 450, category: 'drink' },
      { id: 'wm-bratwurst', nameEn: 'Bratwurst', nameDe: 'Bratwurst', priceCents: 350, category: 'food' },
      { id: 'wm-reibekuchen', nameEn: 'Potato Fritters', nameDe: 'Reibekuchen', priceCents: 400, category: 'food' },
      { id: 'wm-maronen', nameEn: 'Roasted Chestnuts', nameDe: 'Maronen', priceCents: 350, category: 'food' },
      { id: 'wm-lebkuchen', nameEn: 'Gingerbread', nameDe: 'Lebkuchen', priceCents: 300, category: 'food' },
      { id: 'wm-crepe', nameEn: 'Crêpe', nameDe: 'Crêpe', priceCents: 450, category: 'food' },
    ],
  },
];

export function presetItems(preset: MenuPreset, locale: 'en' | 'de'): MenuItem[] {
  return preset.items.map((i) => ({
    id: i.id,
    name: locale === 'de' ? i.nameDe : i.nameEn,
    priceCents: i.priceCents,
    category: i.category,
  }));
}

export function presetName(preset: MenuPreset, locale: 'en' | 'de'): string {
  return locale === 'de' ? preset.nameDe : preset.nameEn;
}
