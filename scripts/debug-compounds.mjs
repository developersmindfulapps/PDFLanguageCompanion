import fs from 'node:fs';
import zlib from 'node:zlib';
import readline from 'node:readline';

const targetWords = new Set([
  'Telefonnummer', 'Lieblingsmusik', 'Lieblingsfilm',
  'Vorname', 'Nachname', 'Geburtsdatum', 'Wohnort',
  'Interessen', 'Interesse', 'Telefon', 'Nummer',
  'Liebling', 'Musik', 'Film', 'Geburtstag', 'Wohnung'
]);

const rl = readline.createInterface({
  input: fs.createReadStream('.cache/kaikki.org-dictionary-German.jsonl.gz').pipe(zlib.createGunzip()),
  crlfDelay: Infinity
});

const foundInSource = new Map();

for await (const line of rl) {
  if (!line.trim()) continue;
  let entry;
  try { entry = JSON.parse(line); } catch { continue; }
  if (entry.lang_code !== 'de' && entry.lang !== 'German') continue;
  
  const w = entry.word ? entry.word.trim() : '';
  if (targetWords.has(w)) {
    if (!foundInSource.has(w)) foundInSource.set(w, []);
    foundInSource.get(w).push({
      pos: entry.pos,
      senses: entry.senses?.map(s => ({ glosses: s.glosses, tags: s.tags, form_of: s.form_of })),
      sounds: entry.sounds?.length,
      forms: entry.forms?.length,
      etymology: entry.etymology_text ? true : false,
      tags: entry.tags
    });
  }
}

console.log('=== SOURCE SEARCH RESULTS ===');
for (const word of targetWords) {
  const entries = foundInSource.get(word);
  if (entries) {
    console.log(`\n✓ "${word}": ${entries.length} entry/entries found:`);
    entries.forEach((e, idx) => {
      console.log(`   [${idx+1}] POS: ${e.pos}, sounds: ${e.sounds}, forms: ${e.forms}, etym: ${e.etymology}`);
      console.log(`       Senses:`, JSON.stringify(e.senses));
    });
  } else {
    console.log(`\n✗ "${word}": NOT IN RAW WIKTIONARY SOURCE`);
  }
}
