import raw from './answers.json';

/** An answer written by the daily review. */
export interface Answer { a: string; t: number }
/** Answers by question id. `src/answers.json` is edited by the daily review (a pull request), never by the app. */
export const answers = raw as Record<string, Answer>;
