import fs from 'node:fs';
import zlib from 'node:zlib';
import readline from 'node:readline';

const gzPath = '.cache/kaikki.org-dictionary-German.jsonl.gz';
const rl = readline.createInterface({
  input: fs.createReadStream(gzPath).pipe(zlib.createGunzip()),
  crlfDelay: Infinity
});

let lineCount = 0;
const testWords = ['Haus', 'gehen', 'Mädchen', 'Straße', 'Bücher', 'machen', 'sein', 'sie', 'Sie', 'ihr', 'Ihr', 'Morgen', 'morgen', 'fragen', 'Frage', 'Fragen', 'antworten', 'Antwort', 'Antworten', 'reisen', 'Reise', 'Reisen'];
const found = {};
const posCounter = {};

rl.on('line', (line) => {
  lineCount++;
  if (!line.trim()) return;
  try {
    const obj = JSON.parse(line);
    const pos = obj.pos || 'unknown';
    posCounter[pos] = (posCounter[pos] || 0) + 1;

    if (testWords.includes(obj.word)) {
      if (!found[obj.word]) found[obj.word] = [];
      found[obj.word].push({
        word: obj.word,
        pos: obj.pos,
        senses: (obj.senses || []).map(s => ({ glosses: s.glosses, tags: s.tags, form_of: s.form_of })),
        forms: (obj.forms || []).map(f => ({ form: f.form, tags: f.tags })).slice(0, 8),
        tags: obj.tags
      });
    }
  } catch (err) {
    // ignore parse errors
  }
});

rl.on('close', () => {
  console.log(`Total lines processed: ${lineCount}`);
  console.log('POS distribution in source:', posCounter);
  console.log('Found test words count:', Object.keys(found).length);

  for (const w of testWords) {
    console.log(`\n=== WORD: ${w} ===`);
    console.log(JSON.stringify(found[w] || 'NOT FOUND', null, 2));
  }
});
