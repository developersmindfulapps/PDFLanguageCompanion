import { createWorker, OEM, PSM, type Worker, type ImageLike } from 'tesseract.js';
import {
  type OCRBoundingBox,
  type OCRWord,
  type OCRPageResult,
  type OCRProgress,
  type OCRStatus,
  type RecognizeOptions,
  OCRCancelledError,
} from './ocrTypes.ts';

/**
 * Resolves the Tesseract worker script URL for the current environment.
 * In a Chrome Extension MV3, this loads from the local extension bundle.
 */
function resolveWorkerPath(): string | undefined {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    try {
      return chrome.runtime.getURL('tesseract/worker.min.js');
    } catch {
      // Fallback to relative URL
    }
  }
  if (typeof window !== 'undefined') {
    return '/tesseract/worker.min.js';
  }
  return undefined;
}

/**
 * Resolves the Tesseract core WASM directory URL for the current environment.
 */
function resolveCorePath(): string | undefined {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    try {
      return chrome.runtime.getURL('tesseract/');
    } catch {
      // Fallback to relative URL
    }
  }
  if (typeof window !== 'undefined') {
    return '/tesseract/';
  }
  return undefined;
}

/**
 * Resolves the traineddata language directory URL for the current environment.
 */
function resolveLangPath(): string {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    try {
      return chrome.runtime.getURL('tessdata');
    } catch {
      // Fallback to relative URL
    }
  }
  if (typeof window !== 'undefined') {
    return '/tessdata';
  }
  return 'public/tessdata';
}

interface ActiveJob {
  id: number;
  abortReject: (err: OCRCancelledError) => void;
  onProgress?: (progress: OCRProgress) => void;
}

export class OCRService {
  private static instance: OCRService;
  private worker: Worker | null = null;
  private initPromise: Promise<Worker> | null = null;
  private status: OCRStatus = 'idle';
  private activeJob: ActiveJob | null = null;
  private jobCounter = 0;

  // Custom path overrides for Node.js / testing environments
  private customWorkerPath?: string;
  private customCorePath?: string;
  private customLangPath?: string;

  private constructor() {}

  public static getInstance(): OCRService {
    if (!OCRService.instance) {
      OCRService.instance = new OCRService();
    }
    return OCRService.instance;
  }

  /**
   * Configures custom local path overrides (primarily for Node.js automated test environments).
   */
  public configurePaths(paths: { workerPath?: string; corePath?: string; langPath?: string }): void {
    if (paths.workerPath) this.customWorkerPath = paths.workerPath;
    if (paths.corePath) this.customCorePath = paths.corePath;
    if (paths.langPath) this.customLangPath = paths.langPath;
  }

  /**
   * Returns whether an OCR worker is currently initialized and ready.
   */
  public isInitialized(): boolean {
    return this.worker !== null;
  }

  /**
   * Returns current lifecycle status.
   */
  public getStatus(): OCRStatus {
    return this.status;
  }

  /**
   * Initializes the Tesseract OCR worker for German ('deu') using local assets.
   * Concurrent initialization calls share the same promise.
   */
  public async initialize(): Promise<Worker> {
    if (this.worker) {
      return this.worker;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.status = 'initializing';

    this.initPromise = (async () => {
      try {
        const workerPath = this.customWorkerPath || resolveWorkerPath();
        const corePath = this.customCorePath || resolveCorePath();
        const langPath = this.customLangPath || resolveLangPath();

        const workerOptions: Record<string, unknown> = {
          langPath,
          gzip: true,
          workerBlobURL: false,
          logger: (msg: { status?: string; progress?: number }) => {
            if (this.activeJob?.onProgress && msg.progress !== undefined) {
              this.activeJob.onProgress({
                status: msg.status || 'processing',
                progress: typeof msg.progress === 'number' ? Math.min(Math.max(msg.progress, 0), 1) : 0,
              });
            }
          },
        };

        if (workerPath) {
          workerOptions.workerPath = workerPath;
        }
        if (corePath) {
          workerOptions.corePath = corePath;
        }

        const worker = await createWorker(
          'deu',
          OEM.LSTM_ONLY,
          workerOptions
        );

        // Configure Page Segmentation Mode (PSM.AUTO is ideal for multi-element textbook pages)
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.AUTO,
        });

        this.worker = worker;
        this.status = 'idle';
        return worker;
      } catch (err) {
        this.status = 'error';
        this.worker = null;
        console.error('Failed to initialize OCR worker:', err);
        throw err;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Runs OCR on a single page image source.
   * Returns structured word tokens with bounding boxes and confidence metrics.
   */
  public async recognize(
    imageSource: ImageLike,
    pageNumber = 1,
    options: RecognizeOptions = {}
  ): Promise<OCRPageResult> {
    // Check if cancellation was pre-requested via AbortSignal
    if (options.signal?.aborted) {
      throw new OCRCancelledError();
    }

    // Cancel any previous in-flight job before starting a new one
    if (this.activeJob) {
      this.cancel();
    }

    const jobId = ++this.jobCounter;
    this.status = 'recognizing';

    let abortRejectHandler!: (err: OCRCancelledError) => void;
    const cancelPromise = new Promise<never>((_, reject) => {
      abortRejectHandler = reject;
    });

    const activeJobInfo: ActiveJob = {
      id: jobId,
      abortReject: abortRejectHandler,
      onProgress: options.onProgress,
    };
    this.activeJob = activeJobInfo;

    // Listen to optional AbortSignal
    const abortListener = () => {
      this.cancel();
    };
    if (options.signal) {
      options.signal.addEventListener('abort', abortListener, { once: true });
    }

    try {
      const recognitionPromise = (async () => {
        const worker = await this.initialize();

        // Check if job was cancelled while initializing worker
        if (this.activeJob?.id !== jobId) {
          throw new OCRCancelledError();
        }

        // Request structured blocks & text format
        let result;
        try {
          result = await worker.recognize(
            imageSource,
            {},
            { blocks: true, text: true }
          );
        } catch (recognizeErr) {
          if (this.activeJob?.id !== jobId || this.status === 'cancelled') {
            throw new OCRCancelledError();
          }
          throw recognizeErr;
        }

        // Check if job was cancelled while recognition was running
        if (this.activeJob?.id !== jobId) {
          throw new OCRCancelledError();
        }

        const data = result.data;
        const words: OCRWord[] = [];

        // Extract word tokens from hierarchical blocks -> paragraphs -> lines -> words
        if (data.blocks) {
          for (const block of data.blocks) {
            if (block.paragraphs) {
              for (const paragraph of block.paragraphs) {
                if (paragraph.lines) {
                  for (const line of paragraph.lines) {
                    if (line.words) {
                      for (const word of line.words) {
                        const rawText = word.text ? word.text.trim() : '';
                        if (rawText.length > 0 && word.bbox) {
                          words.push({
                            text: rawText,
                            bbox: {
                              x0: Math.round(word.bbox.x0),
                              y0: Math.round(word.bbox.y0),
                              x1: Math.round(word.bbox.x1),
                              y1: Math.round(word.bbox.y1),
                            },
                            confidence: typeof word.confidence === 'number' ? Math.round(word.confidence) : 0,
                          });
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // Fallback: check if words array exists directly on result.data
        if (words.length === 0 && Array.isArray((data as unknown as { words?: Array<{ text: string; bbox: OCRBoundingBox; confidence: number }> }).words)) {
          const directWords = (data as unknown as { words: Array<{ text: string; bbox: OCRBoundingBox; confidence: number }> }).words;
          for (const word of directWords) {
            const rawText = word.text ? word.text.trim() : '';
            if (rawText.length > 0 && word.bbox) {
              words.push({
                text: rawText,
                bbox: {
                  x0: Math.round(word.bbox.x0),
                  y0: Math.round(word.bbox.y0),
                  x1: Math.round(word.bbox.x1),
                  y1: Math.round(word.bbox.y1),
                },
                confidence: typeof word.confidence === 'number' ? Math.round(word.confidence) : 0,
              });
            }
          }
        }

        // Determine source image dimensions
        let imageWidth = 0;
        let imageHeight = 0;

        if (typeof imageSource === 'object' && imageSource !== null) {
          if ('width' in imageSource && typeof (imageSource as { width: unknown }).width === 'number') {
            imageWidth = (imageSource as { width: number }).width;
          }
          if ('height' in imageSource && typeof (imageSource as { height: unknown }).height === 'number') {
            imageHeight = (imageSource as { height: number }).height;
          }
        }

        // Fallback dimension calculation from bounding boxes
        if (imageWidth === 0 || imageHeight === 0) {
          let maxX = 0;
          let maxY = 0;
          for (const word of words) {
            if (word.bbox.x1 > maxX) maxX = word.bbox.x1;
            if (word.bbox.y1 > maxY) maxY = word.bbox.y1;
          }
          imageWidth = imageWidth || maxX;
          imageHeight = imageHeight || maxY;
        }

        const pageResult: OCRPageResult = {
          pageNumber,
          text: data.text ? data.text.trim() : '',
          words,
          confidence: typeof data.confidence === 'number' ? Math.round(data.confidence) : 0,
          imageWidth,
          imageHeight,
        };

        return pageResult;
      })();

      // Catch and swallow background worker termination errors if the job was cancelled
      const safeRecognitionPromise = recognitionPromise.catch((err) => {
        if (this.activeJob?.id !== jobId || this.status === 'cancelled') {
          // Return a pending promise that never resolves/rejects so cancelPromise wins the race cleanly
          return new Promise<never>(() => {});
        }
        throw err;
      });

      // Race recognition against cancellation
      const pageResult = await Promise.race([safeRecognitionPromise, cancelPromise]);

      this.status = 'completed';
      return pageResult;
    } catch (err) {
      if (err instanceof OCRCancelledError) {
        this.status = 'cancelled';
      } else {
        this.status = 'error';
      }
      throw err;
    } finally {
      if (options.signal) {
        options.signal.removeEventListener('abort', abortListener);
      }
      if (this.activeJob?.id === jobId) {
        this.activeJob = null;
      }
    }
  }

  /**
   * Cancels the currently running OCR operation immediately.
   * If a job is active, terminates the active worker thread so in-flight Wasm
   * processing stops immediately and resets the worker reference for subsequent calls.
   */
  public cancel(): void {
    if (this.activeJob) {
      const job = this.activeJob;
      this.activeJob = null;
      this.status = 'cancelled';

      // Terminate running worker to immediately halt background processing
      if (this.worker) {
        const workerToTerminate = this.worker;
        this.worker = null;
        workerToTerminate.terminate().catch((err) => {
          console.warn('Error during OCR worker cancellation termination:', err);
        });
      }

      job.abortReject(new OCRCancelledError());
    }
  }

  /**
   * Terminates the OCR worker and releases all resources.
   */
  public async terminate(): Promise<void> {
    this.cancel();

    if (this.initPromise) {
      try {
        const worker = await this.initPromise;
        await worker.terminate();
      } catch {
        // Ignore initialization error during termination
      }
      this.initPromise = null;
    }

    if (this.worker) {
      const worker = this.worker;
      this.worker = null;
      try {
        await worker.terminate();
      } catch (err) {
        console.warn('Error terminating OCR worker:', err);
      }
    }

    this.status = 'idle';
    this.activeJob = null;
  }
}

export const ocrService = OCRService.getInstance();
