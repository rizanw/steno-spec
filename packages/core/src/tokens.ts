/**
 * Rough token count. chars/4 lands within about 10% of real BPE tokenizers for English and code,
 * and needs no extra dependency. If we ever need exact counts, swap in a real tokenizer here.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
