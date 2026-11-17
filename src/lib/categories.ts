import type { CategoryId, CustomCategory } from '@/lib/types';

export interface CategoryDefinition {
  id: CategoryId;
  label: string;
  /** Accent hue used for the category chip, in CSS `oklch` lightness-safe hue. */
  hue: number;
}

export const BUILT_IN_CATEGORIES: CategoryDefinition[] = [
  { id: 'social', label: 'Ijtimoiy tarmoq', hue: 265 },
  { id: 'email', label: 'Elektron pochta', hue: 220 },
  { id: 'banking', label: 'Bank va to‘lov', hue: 150 },
  { id: 'work', label: 'Ish', hue: 35 },
  { id: 'shopping', label: 'Xarid', hue: 320 },
  { id: 'entertainment', label: 'Ko‘ngilochar', hue: 10 },
  { id: 'development', label: 'Dasturlash', hue: 195 },
  { id: 'other', label: 'Boshqa', hue: 250 },
];

export const BUILT_IN_CATEGORY_IDS = new Set(BUILT_IN_CATEGORIES.map((c) => c.id));

export function allCategories(custom: CustomCategory[]): CategoryDefinition[] {
  return [
    ...BUILT_IN_CATEGORIES,
    ...custom.map((category, index) => ({
      id: category.id,
      label: category.label,
      hue: (index * 47 + 285) % 360,
    })),
  ];
}

export function categoryLabel(id: CategoryId, custom: CustomCategory[]): string {
  const found = allCategories(custom).find((category) => category.id === id);
  return found?.label ?? 'Boshqa';
}

export function categoryHue(id: CategoryId, custom: CustomCategory[]): number {
  return allCategories(custom).find((category) => category.id === id)?.hue ?? 250;
}

/** Slugify a user-typed category name into a stable id. */
export function toCategoryId(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/['‘’]/gu, '')
    .replace(/[^a-z0-9Ѐ-ӿ]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  return base.length > 0 ? `custom-${base}` : `custom-${Date.now().toString(36)}`;
}
