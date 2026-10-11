import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Alt { san: string; reply: string; eval: number }
export interface Move { san: string; note: string; eval?: number; why?: Record<string, string>; caps?: Alt[] }
export interface Variation { id: string; name: string; strategy: string; moves: Move[] }
export interface Opening {
  id: string; name: string; color: 'white' | 'black'; summary: string;
  status: 'draft' | 'reviewed';
  goal: { title: string; text: string; plans: string[] };
  variations: Variation[];
}

export const CONTENT_DIR = join(import.meta.dirname, '..', 'content');

export function listContentFiles(): string[] {
  return readdirSync(CONTENT_DIR).filter(f => f.endsWith('.json')).map(f => join(CONTENT_DIR, f));
}
export function loadOpening(file: string): Opening {
  return JSON.parse(readFileSync(file, 'utf8')) as Opening;
}
