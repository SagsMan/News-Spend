/**
 * Wordlist-based objectionable content filter for user-generated text.
 *
 * Exists to satisfy App Store Review Guideline 1.2, which requires apps with
 * user-generated content to provide "a method for filtering objectionable
 * content". Comments that match are rejected at write time, so nothing
 * objectionable is ever persisted or served.
 *
 * The matcher normalizes common evasion tricks (leetspeak, diacritics,
 * character padding, letter separators) before testing, and matches on word
 * boundaries so ordinary words containing a banned substring, such as
 * "class", "assess", or "Scunthorpe", are not flagged.
 */

/** Severe terms: slurs and sexual content involving minors. Always rejected. */
const SEVERE_TERMS = [
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "dyke",
  "tranny",
  "kike",
  "spic",
  "chink",
  "gook",
  "wetback",
  "raghead",
  "coon",
  "paki",
  "retard",
  "retarded",
  "childporn",
  "cp",
  "pedo",
  "pedophile",
  "loli",
];

/** General profanity and harassment terms. Rejected. */
const PROFANITY_TERMS = [
  "fuck",
  "fucker",
  "fucking",
  "motherfucker",
  "shit",
  "bullshit",
  "bitch",
  "bastard",
  "cunt",
  "asshole",
  "dickhead",
  "prick",
  "twat",
  "wanker",
  "slut",
  "whore",
  "hoe",
  "pussy",
  "cock",
  "dick",
  "penis",
  "vagina",
  "boobs",
  "tits",
  "porn",
  "porno",
  "rape",
  "rapist",
  "molest",
  "kys",
  "kill yourself",
  "killyourself",
];

/**
 * Terms that are only objectionable as a standalone word and appear too often
 * inside legitimate words to match loosely. Kept separate so the matcher can
 * require an exact standalone token.
 */
const EXACT_ONLY_TERMS = new Set(["cp", "fag", "hoe", "dick", "coon"]);

/**
 * Legitimate words that begin with a banned term. Checked before matching so
 * "cocktail" and "prickly" don't trip the filter.
 */
const SAFE_WORD_LIST = [
  "cocktail",
  "cocktails",
  "cockpit",
  "cockerel",
  "cockroach",
  "cockroaches",
  "cocky",
  "prickly",
  "rapeseed",
  "shiitake",
  "pussycat",
  "titsup",
];

/**
 * Includes each safe word's run-collapsed form ("shiitake" → "shitake") so it
 * still matches after the aggressive normalization pass.
 */
const SAFE_WORDS = new Set([
  ...SAFE_WORD_LIST,
  ...SAFE_WORD_LIST.map((word) => word.replace(/(.)\1+/g, "$1")),
]);

const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  $: "s",
  "!": "i",
  "|": "i",
  "+": "t",
};

const ALPHANUMERIC = /[a-z0-9]/;

/** Lowercases and strips diacritics. */
function fold(input: string): string {
  return input.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Folds leetspeak and collapses padded characters so evasions normalize onto
 * the wordlist. Two collapse strengths are produced because neither alone is
 * sufficient: keeping doubles preserves genuine ones ("assess"), while
 * collapsing to a single character is what turns "fuuuuck" into "fuck".
 */
function normalize(input: string, collapseTo: 1 | 2): string {
  const unleeted = fold(input).replace(
    /[0134578@$!|+]/g,
    (char) => LEET_MAP[char] ?? char
  );

  return collapseTo === 1
    ? unleeted.replace(/(.)\1+/g, "$1")
    : unleeted.replace(/(.)\1{2,}/g, "$1$1");
}

/**
 * Rewrites a normalized string into space-separated word tokens, and also
 * rejoins sequences of single letters ("f u c k", "f.u.c.k" → "fuck") so
 * separator-based evasion collapses back to a matchable token.
 */
function tokenize(normalized: string): string {
  const spaced = normalized.replace(/[^a-z0-9]+/g, " ").trim();

  return spaced.replace(/\b(?:[a-z] ){1,}[a-z]\b/g, (run) =>
    run.replace(/ /g, "")
  );
}

export type ContentFilterResult =
  | { ok: true }
  | { ok: false; severity: "severe" | "profanity"; matched: string };

function findMatch(haystack: string, terms: string[]): string | undefined {
  const tokens = haystack.split(" ").filter(Boolean);
  // Multi-word terms ("kill yourself") survive any spacing once condensed.
  const condensed = haystack.replace(/ /g, "");

  for (const term of terms) {
    const needle = term.replace(/ /g, "");

    if (term.includes(" ")) {
      if (condensed.includes(needle)) {
        return term;
      }
      continue;
    }

    for (const token of tokens) {
      if (SAFE_WORDS.has(token)) {
        continue;
      }

      // Exact-only terms are too short or too common as substrings to match
      // by prefix; everything else matches the start of a token so that
      // inflections ("fucking") are caught while "assess" is not.
      const hit = EXACT_ONLY_TERMS.has(term)
        ? token === needle
        : token.startsWith(needle);

      if (hit) {
        return term;
      }
    }
  }

  return;
}

/**
 * Catches symbol-for-letter substitution ("f@ck", "sh*t"), which plain
 * leetspeak folding cannot resolve because the same symbol stands in for
 * different letters. Each interior symbol becomes a single-character wildcard
 * and the *token* is used as the pattern, tested against each term.
 *
 * Scoped tightly to only word-shaped tokens carrying one or two interior
 * symbols, so ordinary punctuation never reaches it.
 */
function findWildcardMatch(text: string, terms: string[]): string | undefined {
  const candidates = fold(text).split(/\s+/).filter(Boolean);

  for (const candidate of candidates) {
    const symbols = candidate.match(/[^a-z0-9]/g);
    if (!symbols || symbols.length > 2 || candidate.length < 4) {
      continue;
    }

    // Alphanumerics are regex-safe as-is; every symbol becomes a wildcard.
    const pattern = new RegExp(
      `^${Array.from(candidate)
        .map((char) => (ALPHANUMERIC.test(char) ? char : "."))
        .join("")}`
    );

    for (const term of terms) {
      if (!EXACT_ONLY_TERMS.has(term) && pattern.test(term)) {
        return term;
      }
    }
  }

  return;
}

/**
 * Screens user-submitted text against the wordlist.
 *
 * Returns `{ ok: true }` when the text is clean, otherwise the severity and
 * the term that matched (for logging; never surface the term to the author,
 * since that just teaches the filter's contents).
 */
export function screenText(text: string): ContentFilterResult {
  const haystacks = [
    tokenize(normalize(text, 2)),
    tokenize(normalize(text, 1)),
  ].filter(Boolean);

  if (haystacks.length === 0) {
    return { ok: true };
  }

  for (const [severity, terms] of [
    ["severe", SEVERE_TERMS],
    ["profanity", PROFANITY_TERMS],
  ] as const) {
    for (const haystack of haystacks) {
      const matched = findMatch(haystack, terms);
      if (matched) {
        return { ok: false, severity, matched };
      }
    }

    const wildcard = findWildcardMatch(text, terms);
    if (wildcard) {
      return { ok: false, severity, matched: wildcard };
    }
  }

  return { ok: true };
}

/** User-facing rejection copy. Deliberately does not name the matched term. */
export const CONTENT_FILTER_MESSAGE =
  "Your comment couldn't be posted because it appears to violate our community guidelines. Please revise it and try again.";
