PDF Language Companion

A privacy-first Chrome extension for learning languages directly from PDF textbooks.

Overview

PDF Language Companion is a lightweight, privacy-focused Chrome Extension designed to help language learners read foreign language PDFs without constant tab-switching.

When reading a German PDF (such as a textbook, article, or Kursbuch):
- Open the document inside the extension's dedicated reader.
- Click or select any German word directly in the text.
- View its English translation, part of speech, and canonical base form (lemma) in a floating tooltip.
- Continue reading smoothly without altering the visual appearance of the original PDF document.

The current MVP focuses on **German → English**.

Key Features

- Dedicated reader interface: Focused reader tab (`viewer.html`) with customizable viewing options.
- File ingestion: Open documents via local file picker or drag-and-drop.
- PDF.js rendering engine: Canvas rendering with high-DPI (Retina) display support and single-page memory management.
- Aligned text layer: PDF.js text layer aligned 1:1 with the rendering canvas across all zoom levels.
- Interactive word detection: Click or drag-select individual words for instant dictionary lookup.
- German character support: Native handling of umlauts and special characters (`ä`, `ö`, `ü`, `Ä`, `Ö`, `Ü`, `ß`).
- Punctuation and token cleaning: Automatic stripping of surrounding punctuation, quotation marks (`„`, `“`, `«`, `»`, `"`, `'`), parentheses, and brackets.
- Hyphenation handling: Internal compound hyphens (such as `Deutsch-Englisch`) are preserved while trailing line-break hyphens are cleaned.
- Case-insensitive matching: Matches words regardless of casing variations (`Schule`, `schule`, `SCHULE`).
- Lemma and inflection resolution: Resolves plurals and conjugated forms to base dictionary entries (for example, `Kaffees` → `Kaffee`, `Bücher` → `Buch`, `Wörter` → `Wort`).
- Floating tooltip UI: Dynamically positioned translation popover with automatic viewport collision detection powered by Floating UI.
- Flexible dismissal: Tooltip closes on outside click, Escape key press, page navigation, zoom adjustments, or document replacement.
- Navigation controls: Previous and next buttons, direct page jump input, and keyboard shortcuts (`←`, `→`, `PageUp`, `PageDown`).
- Zoom controls: Zoom in, zoom out, preset percentages, and responsive Fit to Width mode.
- Native text copying: Standard PDF text selection and copying remain functional.
- Scanned PDF detection: Identifies image-only or scanned PDFs lacking selectable text and displays a clear warning banner.
- Local and offline operation: Bundled local dictionary and offline font and CMap assets. Zero backend, zero network lookups, zero telemetry, and zero account requirements.

How It Works

```text
Local PDF File
      ↓
PDF.js (Worker + Canvas Layer)
      +
PDF.js (1:1 Aligned Text Layer)
      ↓
Word Selection (Click / Drag Tokenizer)
      ↓
Dictionary Provider (Interface: sourceLang, targetLang)
      ↓
Local Dictionary Provider (In-Memory JSON Index)
      ↓
Floating Tooltip (Translation, Lemma, Part of Speech)
```

1. PDF Ingestion and Rendering: PDF.js renders the document page onto an HTML5 canvas while simultaneously generating an invisible, precisely aligned DOM text layer.
2. Word Detection: The `useWordSelection` hook captures click or selection events on the text layer, cleans surrounding typography, and isolates the target word token. Multi-word selections are suppressed to prevent ambiguous lookups.
3. Dictionary Provider: The extracted token is queried against `DictionaryProvider`, an abstraction decoupling the UI from dictionary storage.
4. Local Lookup Pipeline: `LocalDictionaryProvider` performs exact token matching, case-normalized lookup, and lemma mapping fallback. It returns `null` if the word is not in the dictionary.
5. Floating Tooltip: The translation popover displays the queried word, English meanings, part of speech, and root lemma near the selected word.

Current Language Support

Current support: **German → English** (`de` → `en`)

The German → English dictionary is bundled statically inside the extension for offline access.

The lookup pipeline uses a generic `DictionaryProvider` interface, establishing a clean path for adding other language pairs in future releases without modifying core viewer or selection code.

PDF Compatibility

| Document Type | Status | Description |
| --- | --- | --- |
| Digital / text-based PDF | Supported | PDFs containing selectable text generated from word processors, digital publishing software, or export tools. |
| Scanned / image-only PDF | Not supported in MVP v1 | PDFs consisting purely of scanned page images without an embedded text layer. The extension detects these pages and displays a warning banner. |

Optical Character Recognition (OCR) for scanned PDFs is a planned future enhancement and is not included in the current MVP.

Privacy & Offline Design

PDF Language Companion operates entirely locally:

- Local execution: All PDF rendering, text extraction, word detection, and dictionary queries run locally inside the browser.
- Zero data transmission: No document content, selected text, or user interaction data is ever sent over the network.
- Zero external APIs: No third-party translation services, AI models, or cloud backends are used.
- Zero telemetry: No tracking scripts, analytics, or background logging.
- Minimal permissions: The extension manifest requests zero host permissions (`permissions: []`), ensuring it cannot access external websites or monitor browser activity.

Technology Stack

- UI Framework: [React 18](https://react.dev/) (`react`, `react-dom`)
- Language: [TypeScript](https://www.typescriptlang.org/)
- Build Tool: [Vite](https://vitejs.dev/) (`vite`, `@vitejs/plugin-react`)
- PDF Engine: [PDF.js](https://mozilla.github.io/pdf.js/) (`pdfjs-dist` v4.10.38)
- Styling: [Tailwind CSS](https://tailwindcss.com/) (`tailwindcss`, `postcss`, `autoprefixer`)
- Tooltip Positioning: [Floating UI](https://floating-ui.com/) (`@floating-ui/react`)
- Icons: [Lucide React](https://lucide.dev/) (`lucide-react`)
- Extension Format: Chrome Extension Manifest V3

Project Structure

```text
pdfTranslator/
├── public/
│   ├── cmaps/                  # Bundled PDF.js CMap files (offline CID font support)
│   ├── standard_fonts/         # Bundled PDF.js Standard 14 font files
│   ├── icons/                  # Extension icons (16x16, 48x48, 128x128)
│   ├── manifest.json           # Chrome Extension Manifest V3
│   └── pdf.worker.min.mjs      # Local PDF.js Web Worker
├── scripts/
│   ├── diagnose-pdf-text.mjs   # Diagnostic tool for inspecting raw PDF.js text output
│   ├── generate-test-pdfs.mjs  # Generates test PDF fixtures
│   ├── test-text-utils.mjs     # Token cleaning & offset unit tests
│   ├── verify-phase4.mjs       # Text layer & scanned detection test
│   ├── verify-phase5.mjs       # Word detection & token rules test
│   ├── verify-phase6.mjs       # Local dictionary engine test
│   ├── verify-phase7.mjs       # Tooltip contracts test
│   ├── verify-phase8-e2e.mjs   # End-to-end integration test
│   ├── verify-phase9-edge-cases.mjs   # Edge-case & document lifecycle test
│   └── verify-phase91-regression.mjs  # CMap / offline font regression test
├── src/
│   ├── components/
│   │   ├── DictionaryTooltip/  # Floating tooltip component
│   │   ├── EmptyTextWarning.tsx# Scanned PDF notification banner
│   │   ├── ErrorMessage.tsx    # General error display
│   │   ├── FilePicker.tsx      # Welcome / file upload surface
│   │   ├── LoadingSpinner.tsx  # Asynchronous loading indicator
│   │   ├── Navbar.tsx          # Top navigation bar
│   │   ├── PDFControls.tsx     # Page navigation, zoom, and fit-width toolbar
│   │   ├── PDFViewer.tsx       # Canvas viewport & text layer coordinator
│   │   └── TextLayer.tsx       # PDF.js text layer & selection binding
│   ├── data/
│   │   ├── de-en-dictionary.json  # Raw German → English lexical dataset
│   │   └── deEnDictionary.ts      # TypeScript-typed dictionary module
│   ├── hooks/
│   │   ├── useDictionaryTooltip.ts# Tooltip positioning & state management
│   │   └── useWordSelection.ts    # Click & selection detection hook
│   ├── services/
│   │   ├── dictionary/         # DictionaryProvider abstraction & LocalDictionaryProvider
│   │   └── pdfService.ts       # PDF.js lifecycle, rendering, and text extraction
│   ├── styles/
│   │   └── textLayer.css       # Text layer alignment & selection styles
│   ├── types/                  # TypeScript interfaces (dictionary, pdf, selection)
│   ├── utils/                  # Text sanitization & tokenizer utilities
│   ├── App.tsx                 # Main application coordinator
│   ├── background.ts           # Background service worker (launches reader tab)
│   ├── main.tsx                # React root bootstrap
│   └── index.css               # Global Tailwind CSS imports
├── viewer.html                 # Extension reader HTML entry point
├── vite.config.ts              # Vite build & bundle configuration
├── tsconfig.json               # TypeScript compiler configuration
└── package.json                # Dependencies and build scripts
```

Getting Started

#Prerequisites

- Node.js (v18 or higher recommended)
- npm

#Installation

```bash
# Clone repository and install dependencies
npm install
```

#Development

```bash
# Run local Vite development server
npm run dev
```

#Production Build

```bash
# Typecheck and build the Chrome extension
npm run build
```

The compiled extension will be output to the `dist/` directory.

#Loading into Google Chrome

1. Build the extension with `npm run build`.
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Enable Developer mode using the toggle in the top-right corner.
4. Click Load unpacked in the top-left corner.
5. Select the `dist/` directory from this project folder.
6. Click the PDF Language Companion extension icon in your Chrome toolbar to open the reader.

Usage

1. Launch reader: Click the extension icon in Chrome to open the dedicated reader tab.
2. Open a PDF: Drag and drop a German text PDF into the window, or click Choose PDF to browse.
3. Read and navigate: Use the toolbar or arrow keys (`←`, `→`) to change pages; adjust zoom or select Fit Width.
4. Lookup words: Click or select any German word to view its definition:
   - `Schule` → school (noun)
   - `Kaffees` → base `Kaffee` → coffee (noun)
   - `Straße` → street, road (noun)
   - `größer` → bigger, larger, taller (adjective)
5. Dismiss: Click anywhere outside the tooltip or press Escape to dismiss the popover.

Testing & Verification

The project includes an automated test suite verifying all core behaviors without browser dependencies:

```bash
# Run text sanitization & tokenization tests
node scripts/test-text-utils.mjs

# Run text layer extraction & scanned PDF detection tests
node scripts/verify-phase4.mjs

# Run word selection & character handling tests
node scripts/verify-phase5.mjs

# Run local dictionary & lemma fallback tests
node scripts/verify-phase6.mjs

# Run tooltip data & positioning contract tests
node scripts/verify-phase7.mjs

# Run complete end-to-end integration suite
node scripts/verify-phase8-e2e.mjs

# Run edge cases (multi-column, dense text, unicode, lifecycle)
node scripts/verify-phase9-edge-cases.mjs

# Run offline CMap & standard font resource verification
node scripts/verify-phase91-regression.mjs

# Run TypeScript typecheck
npm run typecheck
```

Known Limitations

- Scanned / image-only PDFs: The MVP does not contain OCR. Documents made entirely of scanned page images cannot provide selectable text.
- Document-wide search: Full-text multi-page search is not implemented in MVP v1.
- Dictionary vocabulary: The bundled dictionary contains approximately 483 high-frequency A1/A2 German vocabulary entries and 200 lemma inflection mappings designed for MVP validation. It is not a comprehensive lexicon.

Future Roadmap

- Optical Character Recognition (OCR) support for scanned and image-only PDFs
- Expanded dictionary vocabulary covering intermediate and advanced (B1–C2) German
- Support for additional source and target language pairs (such as Spanish → English, French → English)
- Advanced contextual lemmatization and compound noun decomposition
- Additional reading productivity tools

Architecture: Future Multilingual Support

The dictionary engine uses a decoupled provider pattern:

```typescript
export interface DictionaryProvider {
  lookup(word: string, sourceLang: string, targetLang: string): Promise<DictionaryResult | null>;
  supportsLanguagePair(sourceLang: string, targetLang: string): boolean;
}
```

This abstraction allows future language providers (e.g. Spanish → English, French → English) or alternative storage backends to be plugged in without refactoring the PDF rendering, canvas synchronization, or word selection subsystems.

Dictionary Attribution & Licensing

The initial MVP dictionary dataset is derived from lexical extracts from:
- The FreeDict Project (`deu-eng`): [https://freedict.org/](https://freedict.org/)
- Wiktionary: [https://www.wiktionary.org/](https://www.wiktionary.org/)

Pre-publication note: The bundled dictionary dataset is provided for development, personal evaluation, and MVP testing. Prior to public store distribution, independent verification of the dataset provenance, licensing terms (such as CC-BY-SA / GPL), and attribution compliance is required.

Development Principles

To preserve simplicity and user privacy, PDF Language Companion is developed under the following guidelines:
- No remote dependencies: Core features must run without third-party network services or translation APIs.
- No user accounts: No login walls, account registration, or cloud databases.
- Minimal permissions: Avoid requesting unnecessary browser permissions in `manifest.json`.
- Integrity of the document: The PDF canvas is never altered or visually mutated by the reader.
