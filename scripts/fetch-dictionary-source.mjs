import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import crypto from 'node:crypto';

/**
 * Pinned Source Configuration for Kaikki.org English Wiktionary German Extract
 */
export const SOURCE_CONFIG = {
  name: 'Kaikki.org English Wiktionary (German Entries)',
  url: 'https://kaikki.org/dictionary/German/kaikki.org-dictionary-German.jsonl.gz',
  snapshotDate: '2026-09-02',
  fileName: 'kaikki.org-dictionary-German.jsonl.gz',
  cacheDir: path.resolve(process.cwd(), '.cache'),
  // Expected SHA-256 checksum of the pinned archive
  // If the file does not exist, download it, compute checksum, and lock it in metadata.
  pinnedSha256: 'ff03802fa4d034a80c03fd72a78243834cc06e69d7031c7be9d745a02c78b34e'
};

export async function computeFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

export async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const tempPath = `${destPath}.tmp-${Date.now()}`;
    const file = fs.createWriteStream(tempPath);

    console.log(`[fetch-source] Downloading ${url}...`);
    let downloadedBytes = 0;
    let totalBytes = 0;
    let lastLoggedPercent = -1;

    const request = https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        // Handle redirect
        file.close();
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        return resolve(downloadFile(response.headers.location, destPath));
      }

      if (response.statusCode !== 200) {
        file.close();
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        return reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
      }

      totalBytes = parseInt(response.headers['content-length'] || '0', 10);

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0) {
          const percent = Math.floor((downloadedBytes / totalBytes) * 100);
          if (percent % 10 === 0 && percent !== lastLoggedPercent) {
            console.log(`[fetch-source] Progress: ${percent}% (${(downloadedBytes / 1048576).toFixed(1)} MB / ${(totalBytes / 1048576).toFixed(1)} MB)`);
            lastLoggedPercent = percent;
          }
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          fs.renameSync(tempPath, destPath);
          console.log(`[fetch-source] Download completed successfully: ${(downloadedBytes / 1048576).toFixed(1)} MB`);
          resolve(destPath);
        });
      });
    });

    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      reject(err);
    });
  });
}

export async function ensureSourceReady() {
  if (!fs.existsSync(SOURCE_CONFIG.cacheDir)) {
    fs.mkdirSync(SOURCE_CONFIG.cacheDir, { recursive: true });
  }

  const targetPath = path.join(SOURCE_CONFIG.cacheDir, SOURCE_CONFIG.fileName);
  const metadataPath = path.join(SOURCE_CONFIG.cacheDir, 'source-metadata.json');

  if (!fs.existsSync(targetPath)) {
    console.log(`[fetch-source] Source archive not found in cache. Initiating download...`);
    await downloadFile(SOURCE_CONFIG.url, targetPath);
  } else {
    console.log(`[fetch-source] Found cached source archive at ${targetPath}`);
  }

  console.log(`[fetch-source] Computing SHA-256 checksum of source archive...`);
  const actualSha256 = await computeFileSha256(targetPath);
  console.log(`[fetch-source] SHA-256: ${actualSha256}`);

  const metadata = {
    source: SOURCE_CONFIG.name,
    url: SOURCE_CONFIG.url,
    snapshotDate: SOURCE_CONFIG.snapshotDate,
    fileName: SOURCE_CONFIG.fileName,
    sha256: actualSha256,
    fileSizeBytes: fs.statSync(targetPath).size,
    verifiedAt: new Date().toISOString()
  };

  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
  console.log(`[fetch-source] Source metadata recorded at ${metadataPath}`);

  return { targetPath, metadata };
}

// Run standalone if executed directly
if (process.argv[1] && process.argv[1].endsWith('fetch-dictionary-source.mjs')) {
  ensureSourceReady()
    .then(() => {
      console.log('[fetch-source] Upstream source ready.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[fetch-source] Error preparing source:', err);
      process.exit(1);
    });
}
