import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { SOURCE_CONFIG, computeFileSha256 } from './fetch-dictionary-source.mjs';

export function cleanContractionGloss(rawGloss) {
  if (!rawGloss || typeof rawGloss !== 'string') return [];
  let text = rawGloss.trim();

  // Replace unicode quotes with standard ascii quotes
  let cleaned = text.replace(/[“”]/g, '"');

  // 1. Check for explicit translation in literal quote: e.g. literally "to the; for the"
  const literalMatch = cleaned.match(/literally\s+"([^"]+)"/i);
  if (literalMatch) {
    const parts = literalMatch[1].split(/[;,]\s*/).map(s => s.replace(/\s*\([^)]*\)\s*/g, '').trim()).filter(Boolean);
    if (parts.length > 0) return parts;
  }

  // 2. Check for explicit trailing translations after bracket / semicolon / colon
  // e.g. "... [with accusative] on the, upon the, onto the"
  // e.g. "contraction of in + dem; in the"
  // e.g. "contraction of bei + dem: at the, by the, etc."
  const trailingMatch = cleaned.match(/(?:;\s*|:\s*|\]\s*)([a-z\s,]+)$/i);
  if (trailingMatch) {
    const parts = trailingMatch[1]
      .split(/,\s*/)
      .map(s => s.replace(/\betc\.?\b/gi, '').replace(/\s*\([^)]*\)\s*/g, '').trim())
      .filter(s => s.length >= 2);
    if (parts.length > 0) return parts;
  }

  // 3. Extract component meanings from ("...") quotes: e.g. contraction of in ("(in)to") + das ("the")
  const compMatch = cleaned.match(/contraction of\s+([^\s"(]+)\s*(?:\("([^"]+)"\))?\s*\+\s*([^\s"(]+)\s*(?:\("([^"]+)"\))?/i);
  if (compMatch) {
    const p1MeaningsRaw = compMatch[2]; // e.g. "(in)to" or "at/on"
    const p2MeaningsRaw = compMatch[4]; // e.g. "the"

    let p1Meanings = [];
    if (p1MeaningsRaw) {
      p1Meanings = p1MeaningsRaw
        .replace(/\(in\)to/gi, 'into, in')
        .replace(/[()]/g, '')
        .split(/[\/,]\s*/)
        .map(s => s.trim())
        .filter(Boolean);
    }

    let p2Meaning = 'the';
    if (p2MeaningsRaw) {
      p2Meaning = p2MeaningsRaw.split(/[,;]/)[0].replace(/[()]/g, '').trim();
    }

    if (p1Meanings.length > 0) {
      const res = [];
      for (const m of p1Meanings) {
        const combined = `${m} ${p2Meaning}`.trim();
        if (!res.includes(combined)) res.push(combined);
      }
      if (res.length > 0) return res;
    }
  }

  // 4. Pattern: contraction of X + Y fallback
  const simpleComp = cleaned.match(/contraction of\s+([a-zäöüß]+)\s*\+\s*([a-zäöüß]+)/i);
  if (simpleComp) {
    const prep = simpleComp[1].toLowerCase();
    const prepMap = {
      in: ['into the', 'in the'],
      an: ['at the', 'to the', 'on the'],
      zu: ['to the', 'for the'],
      von: ['from the', 'of the'],
      bei: ['at the', 'by the'],
      auf: ['onto the', 'on the'],
      für: ['for the'],
      um: ['around the'],
      durch: ['through the'],
      hinter: ['behind the'],
      unter: ['under the'],
      über: ['over the', 'above the'],
      vor: ['in front of the', 'before the']
    };
    if (prepMap[prep]) {
      return prepMap[prep];
    }
  }

  return [];
}

/**
 * Clean and normalize English glosses from Wiktionary into concise, learner-friendly translations.
 */
export function cleanGloss(rawGloss) {
  if (!rawGloss || typeof rawGloss !== 'string') return [];

  let text = rawGloss.trim();

  // If this is a contraction gloss, extract the English prepositional phrase
  if (/^contraction of /i.test(text)) {
    const cMeanings = cleanContractionGloss(text);
    if (cMeanings.length > 0) return cMeanings;
  }

  // Strip Wiktionary formatting headers / notes
  text = text.replace(/^As (?:an? )?(?:intransitive|transitive|copulative|reflexive|auxiliary) verb:\s*/i, '');
  text = text.replace(/^In (?:general|particular):\s*/i, '');
  text = text.replace(/^Used to\s+/i, '');
  text = text.replace(/^forms the present perfect and past perfect tenses.*$/i, '');
  text = text.replace(/\[with [^\]]+\]/g, ''); // Strip grammatical brackets like [with dative ...]
  text = text.replace(/\(often translated idiomatically with [^\)]+\)/gi, '');
  text = text.replace(/\(often not translated literally\)/gi, '');
  text = text.replace(/\(in various phrases\)/gi, '');

  if (!text || text.length < 2) return [];

  // Split on semicolons
  const parts = text.split(/;\s*/);
  const results = [];

  for (let part of parts) {
    part = part.trim();
    if (!part) continue;

    // Strip parenthetical explanation clauses (including nested and unbalanced parentheses from Wiktextract nested lists)
    let candidate = part;
    while (/\([^()]*\)/.test(candidate)) {
      candidate = candidate.replace(/\([^()]*\)/g, ' ');
    }
    candidate = candidate.replace(/\s*\([^)]*$/, '');
    candidate = candidate.replace(/^[^(]*\)\s*/, '');
    candidate = candidate.replace(/\s+/g, ' ').trim();

    if (!candidate || candidate.length < 2) continue;

    // If candidate has comma-separated list of short synonyms, split them
    // e.g. "house, building" -> "house", "building"
    if (candidate.includes(',')) {
      const subParts = candidate.split(/,\s*/);
      for (const sp of subParts) {
        const sClean = sp.trim();
        if (sClean.length >= 2 && !results.includes(sClean)) {
          results.push(sClean);
        }
      }
    } else {
      if (!results.includes(candidate)) {
        results.push(candidate);
      }
    }
  }

  // Deduplicate and filter noise
  return results.filter(r => {
    if (!r) return false;
    if (/^(?:plural|singular|past|participle|dative|genitive|accusative|nominative) of /i.test(r)) return false;
    if (/^alternative form of /i.test(r)) return false;
    if (/^misspelling of /i.test(r)) return false;
    if (/^inflection of /i.test(r)) return false;
    return true;
  }).slice(0, 4); // Keep top 4 concise meanings per sense
}

/**
 * Normalizes POS tags to standard learner categories.
 */
export function normalizePos(rawPos) {
  switch (rawPos) {
    case 'noun': return 'noun';
    case 'verb': return 'verb';
    case 'adj': return 'adj';
    case 'adv': return 'adv';
    case 'pron': return 'pron';
    case 'det': return 'det';
    case 'prep': return 'prep';
    case 'conj': return 'conj';
    case 'num': return 'num';
    case 'article': return 'art';
    case 'intj': return 'interj';
    case 'particle': return 'part';
    case 'phrase': return 'phrase';
    case 'contraction': return 'prep+art';
    default: return null;
  }
}

/**
 * Extracts grammatical gender ('m' | 'f' | 'n') from tags.
 */
export function extractGender(tags = [], senses = []) {
  const allTags = new Set([...tags]);
  for (const s of senses) {
    if (s.tags) s.tags.forEach(t => allTags.add(t));
  }

  if (allTags.has('masculine') || allTags.has('m')) return 'm';
  if (allTags.has('feminine') || allTags.has('f')) return 'f';
  if (allTags.has('neuter') || allTags.has('n')) return 'n';
  return undefined;
}

/**
 * Extracts standard nominative plural from forms array.
 */
export function extractPlural(forms = []) {
  for (const f of forms) {
    if (!f || !f.form || typeof f.form !== 'string') continue;
    const formStr = f.form.trim();
    if (!formStr || formStr.includes(' ') || formStr.includes('-tags') || formStr.startsWith('de-')) continue;

    const tags = f.tags || [];
    if (tags.includes('plural') && (tags.includes('nominative') || tags.includes('definite') || tags.length <= 2)) {
      return formStr;
    }
  }
  // Fallback: any plural tag
  for (const f of forms) {
    if (!f || !f.form || typeof f.form !== 'string') continue;
    const formStr = f.form.trim();
    if (!formStr || formStr.includes(' ') || formStr.includes('-tags') || formStr.startsWith('de-')) continue;
    if ((f.tags || []).includes('plural')) {
      return formStr;
    }
  }
  return undefined;
}

/**
 * Main build pipeline function.
 */
export async function buildDictionary(options = {}) {
  const targetHeadwordLimit = options.targetHeadwordLimit || 15000;
  const sourceArchive = path.join(SOURCE_CONFIG.cacheDir, SOURCE_CONFIG.fileName);

  if (!fs.existsSync(sourceArchive)) {
    throw new Error(`Source archive not found at ${sourceArchive}. Run fetch-dictionary-source.mjs first.`);
  }

  console.log(`[build-dictionary] Verifying source archive SHA-256...`);
  const actualSha = await computeFileSha256(sourceArchive);
  console.log(`[build-dictionary] SHA-256: ${actualSha}`);

  console.log(`[build-dictionary] Streaming and parsing Wiktextract JSONL...`);
  const rl = readline.createInterface({
    input: fs.createReadStream(sourceArchive).pipe(zlib.createGunzip()),
    crlfDelay: Infinity
  });

  let rawLineCount = 0;
  let rejectedCount = 0;

  // Headwords grouped by exact surface word string
  // Map<word, { word, senses: LexicalSense[], score: number, primaryPos: string }>
  const headwordsMap = new Map();
  const rawInflectionPairs = []; // [ { inflected, lemma } ]
  const etymologyComponentLinks = []; // [ { compound, root } ]

  const NOISE_TAGS = new Set(['archaic', 'obsolete', 'historical', 'nonstandard', 'slang', 'rare', 'proper-noun']);

  for await (const line of rl) {
    rawLineCount++;
    if (!line.trim()) continue;

    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      rejectedCount++;
      continue;
    }

    if (entry.lang_code !== 'de' && entry.lang !== 'German') {
      rejectedCount++;
      continue;
    }

    const rawPos = entry.pos;
    if (!rawPos || rawPos === 'name' || rawPos === 'symbol' || rawPos === 'character' || rawPos === 'punct' || rawPos === 'prefix' || rawPos === 'suffix') {
      rejectedCount++;
      continue;
    }

    const pos = normalizePos(rawPos);
    if (!pos) {
      rejectedCount++;
      continue;
    }

    const word = entry.word ? entry.word.trim() : '';
    if (!word || word.length < 2 || word.length > 50 || /[\d_#$]/.test(word)) {
      rejectedCount++;
      continue;
    }

    // Filter all-caps acronyms like RAM, DVD, LED, BTW, EU
    if (word.length >= 2 && word === word.toUpperCase() && !/^[ÄÖÜ][a-zäöüß]+$/.test(word)) {
      rejectedCount++;
      continue;
    }

    // Filter mixed internal caps like iPhone, eBay, etc.
    if (/^[a-zäöüß]+[A-ZÄÖÜ]/.test(word)) {
      rejectedCount++;
      continue;
    }

    const entryTags = entry.tags || [];
    const isObsoleteEntry = entryTags.some(t => NOISE_TAGS.has(t));
    if (isObsoleteEntry) {
      rejectedCount++;
      continue;
    }

    const senses = entry.senses || [];
    const validTranslations = [];
    let isPureFormOf = true;

    for (const sense of senses) {
      const sTags = sense.tags || [];
      if (sTags.some(t => NOISE_TAGS.has(t))) continue;

      // Check if sense is purely a grammatical pointer (form-of)
      if (sTags.includes('form-of') || sense.form_of) {
        if (sense.form_of && sense.form_of.length > 0 && sense.form_of[0].word) {
          const targetLemma = sense.form_of[0].word.trim();
          if (targetLemma && targetLemma !== word) {
            rawInflectionPairs.push({ inflected: word, lemma: targetLemma });
          }
        }
        continue;
      }

      const glosses = sense.glosses || [];
      for (const g of glosses) {
        const cleaned = cleanGloss(g);
        for (const c of cleaned) {
          if (!validTranslations.includes(c)) {
            validTranslations.push(c);
            isPureFormOf = false;
          }
        }
      }
    }

    // Extract inflections from entry.forms
    if (entry.forms && Array.isArray(entry.forms)) {
      for (const f of entry.forms) {
        if (!f || !f.form || typeof f.form !== 'string') continue;
        const fStr = f.form.trim();
        if (!fStr || fStr.includes(' ') || fStr.includes('-tags') || fStr.startsWith('de-')) continue;
        if (fStr !== word) {
          rawInflectionPairs.push({ inflected: fStr, lemma: word });
        }
      }
    }

    // Extract root components from etymology compound/affix templates for centrality scoring
    if (entry.etymology_templates && Array.isArray(entry.etymology_templates)) {
      for (const et of entry.etymology_templates) {
        if (et.args && typeof et.args === 'object') {
          for (const key of Object.keys(et.args)) {
            const val = et.args[key];
            if (typeof val === 'string' && val.length >= 2 && !val.includes(':') && !val.startsWith('-') && !val.endsWith('-')) {
              const cleanVal = val.replace(/<[^>]+>/g, '').trim();
              if (cleanVal && cleanVal !== word && /^[A-Za-zÄÖÜäöüß]+$/.test(cleanVal)) {
                etymologyComponentLinks.push({ compound: word, root: cleanVal });
              }
            }
          }
        }
      }
    }

    // If entry is pure form-of or has no valid translations, don't store as headword
    if (isPureFormOf || validTranslations.length === 0) {
      rejectedCount++;
      continue;
    }

    // Quality / Importance Score Calculation
    let score = 100;
    // 1. Closed grammatical classes get absolute maximum priority
    if (['pron', 'det', 'prep', 'conj', 'art', 'num', 'interj', 'part', 'prep+art'].includes(pos)) {
      score += 50000;
    } else if (pos === 'verb') {
      score += 8000;
    } else if (pos === 'adj') {
      score += 7000;
    } else if (pos === 'adv') {
      score += 6000;
    } else if (pos === 'noun') {
      score += 5000;
    }

    const gender = pos === 'noun' ? extractGender(entryTags, senses) : undefined;
    const plural = pos === 'noun' ? extractPlural(entry.forms) : undefined;

    // 2. POS-aware root-word bonus (balanced for core roots and learner-relevant compounds)
    const isVerb = pos === 'verb';
    const len = word.length;
    if (isVerb) {
      if (len <= 11) score += 6000;
      else if (len <= 14) score += 4000;
      else if (len <= 17) score += 2000;
      else score -= 2000;
    } else {
      if (len <= 5) score += 7000;
      else if (len <= 7) score += 6000;
      else if (len <= 10) score += 5500;
      else if (len <= 13) score += 4500;
      else if (len <= 16) score += 3500;
      else if (len <= 19) score += 1500;
      else score -= 2000;
    }

    if (gender) score += 400;
    if (plural) score += 500;
    if (isVerb && entry.forms && entry.forms.length >= 8) score += 3000;

    // 3. Audio presence (huge indicator of authentic spoken German)
    const audioCount = entry.sounds ? entry.sounds.filter(s => s.audio || s.ogg_url || s.mp3_url).length : 0;
    if (audioCount >= 3) score += 5500;
    else if (audioCount >= 1) score += 4000;
    else if (entry.sounds && entry.sounds.length > 0) score += 1000;

    // 4. Etymology & historical root depth
    const hasCompoundEtym = entry.etymology_templates && entry.etymology_templates.some(t =>
      t.name && ['compound', 'com', 'af', 'prefix', 'suffix'].includes(t.name.toLowerCase())
    );
    if (entry.etymology_text || (entry.etymology_templates && entry.etymology_templates.length > 0)) score += 1500;
    if (hasCompoundEtym) score += 1500;
    if (entry.descendants && entry.descendants.length > 0) score += 800;

    // 5. Compound prefix boost for productive German learner vocabulary
    if (pos === 'noun') {
      const COMMON_COMPOUND_PREFIXES = [
        'Lieblings', 'Geburts', 'Telefon', 'Haupt', 'Haus', 'Wohn', 'Sprach',
        'Kurs', 'Fahr', 'Flug', 'Arbeits', 'Familien', 'Post', 'Kranken',
        'Kinder', 'Wörter', 'Tages', 'Jahres', 'Schul', 'Stadt', 'Reise',
        'Sport', 'Auto', 'Bahn', 'Bus', 'Zug', 'Geld', 'Kauf', 'Sommer',
        'Winter', 'Wochen', 'Monats', 'Vor', 'Nach', 'Geburt'
      ];
      if (COMMON_COMPOUND_PREFIXES.some(prefix => word.startsWith(prefix) && word.length >= prefix.length + 3)) {
        score += 2500;
      }
    }

    // 6. Derived words & compounds count (found either at entry.derived, entry.related, or senses[].derived)
    let derivedCount = (entry.derived || []).length + (entry.related || []).length;
    for (const s of senses) {
      if (s.derived) derivedCount += s.derived.length;
      if (s.hyponyms) derivedCount += s.hyponyms.length;
    }
    if (derivedCount > 0) score += Math.min(derivedCount * 50, 1500);

    // 7. Examples / Synonyms / Topical Categories / Head templates
    if (senses.some(s => s.examples && s.examples.length > 0)) score += 800;
    if (senses.some(s => s.synonyms && s.synonyms.length > 0)) score += 400;
    if (entry.categories && entry.categories.some(c => c.orig && c.orig.startsWith('de:'))) score += 600;
    if (entry.head_templates && entry.head_templates.length > 0) score += 800;

    score += Math.min(validTranslations.length * 80, 400);

    const senseObj = {
      pos,
      translations: validTranslations.slice(0, 4)
    };
    if (gender) senseObj.gender = gender;
    if (plural) senseObj.plural = plural;

    if (!headwordsMap.has(word)) {
      headwordsMap.set(word, {
        word,
        primaryPos: pos,
        senses: [senseObj],
        score
      });
    } else {
      // Append sense to existing headword (preserving homographs)
      const existing = headwordsMap.get(word);
      const duplicateSense = existing.senses.find(s => s.pos === pos && s.gender === gender);
      if (duplicateSense) {
        for (const t of validTranslations) {
          if (!duplicateSense.translations.includes(t) && duplicateSense.translations.length < 6) {
            duplicateSense.translations.push(t);
          }
        }
      } else {
        existing.senses.push(senseObj);
      }
      existing.score = Math.max(existing.score, score);
    }
  }

  console.log(`[build-dictionary] Raw lines: ${rawLineCount}, Unique raw headwords: ${headwordsMap.size}, Raw inflection links: ${rawInflectionPairs.length}`);

  // Count inbound inflection links and compound root pointers per lemma (morphological centrality score)
  const inboundCount = new Map();
  for (const pair of rawInflectionPairs) {
    const lemma = pair.lemma;
    inboundCount.set(lemma, (inboundCount.get(lemma) || 0) + 1);
  }
  for (const link of etymologyComponentLinks) {
    const root = link.root;
    inboundCount.set(root, (inboundCount.get(root) || 0) + 1);
  }

  // Apply morphological centrality boost to headword scores (core roots with many inflected forms & compound pointers)
  for (const h of headwordsMap.values()) {
    const inbounds = inboundCount.get(h.word) || 0;
    h.score += Math.min(inbounds * 150, 6000);
  }

  // Balanced Category Quotas to ensure a comprehensive learner dictionary
  const closedClassCandidates = [];
  const adjectiveCandidates = [];
  const adverbCandidates = [];
  const nounCandidates = [];
  const verbCandidates = [];
  const otherCandidates = [];

  for (const h of headwordsMap.values()) {
    const p = h.primaryPos;
    if (['pron', 'det', 'prep', 'conj', 'art', 'num', 'interj', 'part', 'prep+art'].includes(p)) {
      closedClassCandidates.push(h);
    } else if (p === 'adj') {
      adjectiveCandidates.push(h);
    } else if (p === 'adv') {
      adverbCandidates.push(h);
    } else if (p === 'noun') {
      nounCandidates.push(h);
    } else if (p === 'verb') {
      verbCandidates.push(h);
    } else {
      otherCandidates.push(h);
    }
  }

  const sortDesc = (arr) => arr.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.word.localeCompare(b.word);
  });

  sortDesc(closedClassCandidates);
  sortDesc(adjectiveCandidates);
  sortDesc(adverbCandidates);
  sortDesc(nounCandidates);
  sortDesc(verbCandidates);
  sortDesc(otherCandidates);

  console.log(`[build-dictionary] Candidate pools: Closed=${closedClassCandidates.length}, Adj=${adjectiveCandidates.length}, Adv=${adverbCandidates.length}, Noun=${nounCandidates.length}, Verb=${verbCandidates.length}`);

  // Balanced Selection Strategy targeting ~15,000 headwords
  const acceptedList = [];
  const addCandidates = (pool, limit) => {
    const toAdd = pool.slice(0, limit);
    for (const item of toAdd) {
      acceptedList.push(item);
    }
  };

  // 1. 100% of closed class words (~800-1,000 words)
  addCandidates(closedClassCandidates, closedClassCandidates.length);
  // 2. Top ~9,000 Nouns
  addCandidates(nounCandidates, 9000);
  // 3. Top ~3,800 Verbs
  addCandidates(verbCandidates, 3800);
  // 4. Top ~1,000 Adjectives
  addCandidates(adjectiveCandidates, 1000);
  // 5. Top ~350 Adverbs
  addCandidates(adverbCandidates, 350);

  // Fill remainder up to target limit from remaining best candidates across all pools
  const acceptedSet = new Set(acceptedList.map(h => h.word));
  const remaining = [];
  for (const pool of [nounCandidates, verbCandidates, adjectiveCandidates, adverbCandidates, otherCandidates]) {
    for (const item of pool) {
      if (!acceptedSet.has(item.word)) {
        remaining.push(item);
      }
    }
  }
  sortDesc(remaining);

  const needed = Math.max(0, targetHeadwordLimit - acceptedList.length);
  for (let i = 0; i < needed && i < remaining.length; i++) {
    acceptedList.push(remaining[i]);
  }

  // Sort final accepted headwords alphabetically for 100% deterministic ordering
  acceptedList.sort((a, b) => a.word.localeCompare(b.word));

  const acceptedHeadwordsSet = new Set(acceptedList.map(h => h.word));

  // Build final dictionary JSON structure
  const finalEntries = {};
  const posDistribution = {};
  let nounsWithGender = 0;
  let nounsWithPlural = 0;

  for (const h of acceptedList) {
    finalEntries[h.word] = {
      senses: h.senses
    };

    for (const s of h.senses) {
      posDistribution[s.pos] = (posDistribution[s.pos] || 0) + 1;
      if (s.pos === 'noun' && s.gender) nounsWithGender++;
      if (s.pos === 'noun' && s.plural) nounsWithPlural++;
    }
  }

  // Compile final inflection index: lower(inflected) -> canonicalLemma
  const finalInflections = {};
  let validInflectionCount = 0;

  // 1. Add raw extracted inflection pairs
  for (const pair of rawInflectionPairs) {
    const infLower = pair.inflected.toLowerCase();
    const lemma = pair.lemma;

    if (acceptedHeadwordsSet.has(lemma)) {
      if (!finalInflections[infLower] && infLower !== lemma.toLowerCase()) {
        finalInflections[infLower] = lemma;
        validInflectionCount++;
      }
    }
  }

  // 2. Add lowercase mappings for capitalized headwords if distinct
  for (const h of acceptedList) {
    const lower = h.word.toLowerCase();
    if (lower !== h.word && !finalEntries[lower] && !finalInflections[lower]) {
      finalInflections[lower] = h.word;
      validInflectionCount++;
    }
  }

  console.log(`[build-dictionary] Final accepted headwords: ${acceptedList.length}`);
  console.log(`[build-dictionary] Final accepted inflection keys: ${Object.keys(finalInflections).length}`);
  console.log(`[build-dictionary] POS distribution:`, posDistribution);
  console.log(`[build-dictionary] Nouns with gender: ${nounsWithGender}, with plural: ${nounsWithPlural}`);

  // Prepare metadata
  const metadata = {
    source: SOURCE_CONFIG.name,
    snapshotDate: SOURCE_CONFIG.snapshotDate,
    sourceUrl: SOURCE_CONFIG.url,
    sourceSha256: actualSha,
    generatorVersion: '1.0.0',
    rawLinesProcessed: rawLineCount,
    acceptedHeadwordsCount: acceptedList.length,
    inflectionKeysCount: Object.keys(finalInflections).length,
    rejectedEntriesCount: rejectedCount,
    posDistribution,
    nounsWithGender,
    nounsWithPlural,
    license: 'CC-BY-SA 4.0 / GFDL',
    attribution: 'Derived from Wiktionary data via Kaikki.org (Wiktextract by Tatu Ylonen)'
  };

  const dataDir = path.resolve(process.cwd(), 'public', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Write dictionary files
  const dictPath = path.join(dataDir, 'de-en-dictionary.json');
  const inflPath = path.join(dataDir, 'de-en-inflections.json');
  const metaPath = path.join(dataDir, 'de-en-metadata.json');

  fs.writeFileSync(dictPath, JSON.stringify(finalEntries, null, 2), 'utf-8');
  fs.writeFileSync(inflPath, JSON.stringify(finalInflections, null, 2), 'utf-8');
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');

  console.log(`[build-dictionary] Written ${dictPath} (${(fs.statSync(dictPath).size / 1048576).toFixed(2)} MB)`);
  console.log(`[build-dictionary] Written ${inflPath} (${(fs.statSync(inflPath).size / 1048576).toFixed(2)} MB)`);
  console.log(`[build-dictionary] Written ${metaPath}`);

  return {
    dictPath,
    inflPath,
    metaPath,
    metadata
  };
}

if (process.argv[1] && process.argv[1].endsWith('build-dictionary.mjs')) {
  buildDictionary()
    .then(() => {
      console.log('[build-dictionary] Dictionary build completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[build-dictionary] Build failed:', err);
      process.exit(1);
    });
}
