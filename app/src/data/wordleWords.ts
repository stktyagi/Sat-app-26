import wordleWordsRaw from './wordleWords.json';
import validWordsRaw from './validWords.json';

export interface WordleWordEntry {
  word: string;
  message: string;
  category?: string;
  related_event?: string;
  day?: string;
  difficulty?: string;
  source_type?: string;
}

export const WORDLE_TARGETS: WordleWordEntry[] = (wordleWordsRaw as WordleWordEntry[]).map((entry) => ({
  ...entry,
  word: entry.word.toUpperCase().trim(),
}));

export const VALID_GUESS_WORDS: string[] = (validWordsRaw as string[]).map((w) => w.toUpperCase().trim());

export const DEFAULT_WORD_MESSAGE = "🎉 Enjoying Saturnalia? Check out all the exciting events in the Events tab!";
