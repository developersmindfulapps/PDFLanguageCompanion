import type { OCRBoundingBox } from './ocrTypes.ts';

export interface NormalizedBoundingBox {
  normX: number;
  normY: number;
  normWidth: number;
  normHeight: number;
}

export interface ViewportBoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Normalizes an OCR bounding box (in source-image pixels) into unit coordinates [0, 1].
 */
export function normalizeBoundingBox(
  bbox: OCRBoundingBox,
  imageWidth: number,
  imageHeight: number
): NormalizedBoundingBox {
  const safeW = imageWidth > 0 ? imageWidth : 1;
  const safeH = imageHeight > 0 ? imageHeight : 1;

  const minX = Math.min(bbox.x0, bbox.x1);
  const maxX = Math.max(bbox.x0, bbox.x1);
  const minY = Math.min(bbox.y0, bbox.y1);
  const maxY = Math.max(bbox.y0, bbox.y1);

  const normX = minX / safeW;
  const normY = minY / safeH;
  const normWidth = (maxX - minX) / safeW;
  const normHeight = (maxY - minY) / safeH;

  return {
    normX: Math.max(0, Math.min(normX, 1)),
    normY: Math.max(0, Math.min(normY, 1)),
    normWidth: Math.max(0, Math.min(normWidth, 1)),
    normHeight: Math.max(0, Math.min(normHeight, 1)),
  };
}

/**
 * Projects normalized unit coordinates [0, 1] onto current CSS viewport pixel dimensions.
 */
export function projectToViewport(
  norm: NormalizedBoundingBox,
  viewportWidth: number,
  viewportHeight: number
): ViewportBoundingBox {
  const left = norm.normX * viewportWidth;
  const top = norm.normY * viewportHeight;
  const width = Math.max(norm.normWidth * viewportWidth, 1);
  const height = Math.max(norm.normHeight * viewportHeight, 1);

  return {
    left: Math.round(left * 100) / 100,
    top: Math.round(top * 100) / 100,
    width: Math.round(width * 100) / 100,
    height: Math.round(height * 100) / 100,
  };
}
