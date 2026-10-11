import type { Opening } from './types.ts';

const files = import.meta.glob<Opening>('../content/*.json', { eager: true, import: 'default' });
export const openings: Opening[] = Object.values(files).sort((a, b) => a.name.localeCompare(b.name));

export const findOpening = (id: string) => openings.find(o => o.id === id);
export const findVariation = (o: Opening, id: string) => o.variations.find(v => v.id === id);
export const key = (o: Opening, v: { id: string }) => `${o.id}/${v.id}`;
