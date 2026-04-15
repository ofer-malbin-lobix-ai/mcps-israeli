/**
 * Cross-chain product fingerprinting.
 *
 * Israeli supermarket chains name the same product differently:
 *   "קוקה קולה מוגז 1.5 ל"   (Rami Levy)
 *   "קוקה קולה 1.5 ליטר"     (Tiv Taam, Shufersal)
 *   "קוקה קולה 1.5 ל"        (Keshet)
 *
 * Rami Levy also truncates ItemName to ~20 chars. The ManufacturerName and
 * structured Quantity fields are too inconsistent to fingerprint on (verified
 * empirically). So the signature comes from the name itself: normalized
 * Hebrew punctuation, quantity+unit regex, keyword extraction.
 *
 * Two items are considered "the same product" across chains if they share
 * (brand, qty, unit) AND have at least 2 overlapping content keywords.
 */

export interface ProductSignature {
  brand: string;
  qty: number;
  unit: string; // canonical: ליטר | מ"ל | גרם | ק"ג | יחידה
  keywords: string[]; // lowercase content tokens, minus brand
  source: string; // original (normalized) name, for debugging
}

const UNIT_ALIASES: Record<string, string> = {
  "ליטר": "ליטר",
  "ל": "ליטר",
  "ל'": "ליטר",
  "מל": 'מ"ל',
  "מ\"ל": 'מ"ל',
  "מל'": 'מ"ל',
  "גרם": "גרם",
  "גר": "גרם",
  "ג": "גרם",
  "ג'": "גרם",
  "קג": 'ק"ג',
  "ק\"ג": 'ק"ג',
  "ק'ג": 'ק"ג',
  "קילו": 'ק"ג',
};

// Words that describe packaging or variant but don't change product identity.
// Stripping them gives a cleaner keyword list for cross-chain match.
const FILLER_WORDS = new Set([
  "מוגז", "בבקבוק", "בקבוק", "בפחית", "פחית",
  "פלסטיק", "זכוכית", "זכוכ", "קלאסי", "מגוון",
  "חטיף", "פרוס", "אחיד", "ארוז",
  "טעמים", "טעם",
  "-", "+", "*", "&", ",",
]);

// Keywords whose presence (or absence) identifies a DIFFERENT product. If one
// side has any of these and the other doesn't, don't match. Covers the common
// "regular vs diet/zero/light" cases where everything else looks identical.
const DISTINCTIVE_KEYWORDS = new Set([
  "זירו", "דיאט", "לייט", "ללא", "מופחת",
  "אורגני", "אורגנית",
  "3%", "1%", "5%", "0%", // milk fat content matters
]);

function normalize(s: string): string {
  return s
    .replace(/[\u2018\u2019\u05F3]/g, "'") // variants of apostrophe
    .replace(/[\u201C\u201D\u05F4]/g, '"') // variants of quote
    .replace(/[()\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract (qty, unit, nameWithoutQty) from a name. Returns nulls if no match. */
function extractQtyUnit(name: string): { qty: number | null; unit: string; rest: string } {
  // Match numbers (with optional . or ,) followed by optional whitespace and a unit.
  // Order matters: longer/more-specific units first so we don't match "ל" inside "ליטר".
  // Hebrew letters aren't part of \w in JS regex so \b doesn't work here.
  // End the alternation with (?=\s|$|[^\u0590-\u05FF\w]) to require a non-Hebrew
  // boundary after the unit so "ל" won't match the middle of "חלב".
  const re = /(\d+(?:[.,]\d+)?)\s*(ליטר|מ"ל|מל|ק"ג|קג|קילו|גרם|גר|ג'|ג|ל'|ל)(?=$|[^\u0590-\u05FF])/;
  const m = name.match(re);
  if (!m) return { qty: null, unit: "", rest: name };
  const qty = Number(m[1].replace(",", "."));
  const rawUnit = m[2];
  const unit = UNIT_ALIASES[rawUnit] ?? rawUnit;
  const rest = (name.slice(0, m.index!) + " " + name.slice(m.index! + m[0].length)).trim();
  return { qty: Number.isFinite(qty) ? qty : null, unit, rest };
}

export function productSignature(rawName: string): ProductSignature | null {
  if (!rawName) return null;
  const name = normalize(rawName);
  const { qty, unit, rest } = extractQtyUnit(name);
  if (qty === null || !unit) {
    // No quantity → can't reliably compare across chains.
    return null;
  }
  const tokens = rest
    .split(/[\s,-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !FILLER_WORDS.has(t) && !/^\d+$/.test(t));

  if (tokens.length < 1) return null;

  const brand = tokens[0];
  const keywords = tokens.slice(0, 4); // brand + up to 3 more

  return { brand, qty, unit, keywords, source: name };
}

/**
 * Two signatures describe the same cross-chain product iff they have the same
 * brand, same (qty, unit), and share at least 2 keywords (brand counts as one).
 */
export function signaturesMatch(a: ProductSignature, b: ProductSignature): boolean {
  if (a.brand !== b.brand) return false;
  if (a.unit !== b.unit) return false;
  if (Math.abs(a.qty - b.qty) > 0.01) return false;
  // Distinctive keywords must agree: if one side has "זירו" and the other
  // doesn't, it's a different product (e.g. regular Coke vs Zero Coke).
  const aSet = new Set(a.keywords);
  const bSet = new Set(b.keywords);
  for (const k of a.keywords) {
    if (DISTINCTIVE_KEYWORDS.has(k) && !bSet.has(k)) return false;
  }
  for (const k of b.keywords) {
    if (DISTINCTIVE_KEYWORDS.has(k) && !aSet.has(k)) return false;
  }
  let shared = 0;
  for (const k of b.keywords) if (aSet.has(k)) shared++;
  // Require 2 keyword overlap, but if either side only produced one keyword
  // (single-token brand like "במבה") one match is sufficient.
  const threshold = Math.min(2, a.keywords.length, b.keywords.length);
  return shared >= threshold;
}

/** Stable key for indexing signatures in a Map. Items sharing this key are
 *  guaranteed same-product candidates (still verify with signaturesMatch for
 *  the keyword overlap check). */
export function signatureKey(s: ProductSignature): string {
  return `${s.brand}|${s.qty}|${s.unit}`;
}
