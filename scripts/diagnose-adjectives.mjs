import fs from 'node:fs';
import zlib from 'node:zlib';
import readline from 'node:readline';

const gzPath = '.cache/kaikki.org-dictionary-German.jsonl.gz';
const rl = readline.createInterface({
  input: fs.createReadStream(gzPath).pipe(zlib.createGunzip()),
  crlfDelay: Infinity
});

const sampleAdjs = ['gut', 'groß', 'klein', 'schön', 'schnell', 'langsam', 'alt', 'neu', 'wichtig', 'einfach', 'schwer', 'schöne', 'großen'];
const found = [];

rl.on('line', (line) => {
  if (!line.trim()) return;
  try {
    const obj = JSON.parse(line);
    if (sampleAdjs.includes(obj.word)) {
      found.push({
        word: obj.word,
        pos: obj.pos,
        tags: obj.tags,
        senses: (obj.senses || []).map(s => ({ glosses: s.glosses, tags: s.tags, form_of: s.form_of }))
      });
    }
  } catch {}
});

rl.on('close', () => {
  console.log(`Found ${found.length} entries for sample adjectives:`);
  for (const f of found) {
    console.log(`\nWord: ${f.word}, POS: ${f.pos}`);
    console.log(JSON.stringify(f.senses, null, 2));
  }
});
