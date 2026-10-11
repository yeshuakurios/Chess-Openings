export interface Move { san: string; note: string; eval: number }
export interface Variation { id: string; name: string; strategy: string; moves: Move[] }
export interface Opening {
  id: string; name: string; color: 'white' | 'black'; summary: string; status: 'draft' | 'reviewed';
  goal: { title: string; text: string; plans: string[] };
  variations: Variation[];
}
