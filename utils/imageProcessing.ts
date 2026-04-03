const DEFAULT_MAX_EDGE = 1280;
const DEFAULT_THUMB_EDGE = 256;
const DEFAULT_QUALITY = 0.72;

type ImageAsset = {
  savedDataUrl: string;
  thumbDataUrl: string;
  previewUrl: string;
};

type ProcessImageOptions = {
  maxEdge?: number;
  thumbEdge?: number;
  quality?: number;
};

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image blob'));
    reader.readAsDataURL(blob);
  });

const loadImageElement = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to decode image file'));
    };
    image.src = objectUrl;
  });

const getCanvasSize = (width: number, height: number, maxEdge: number) => {
  const longestEdge = Math.max(width, height);
  if (longestEdge <= maxEdge) {
    return { width, height };
  }
  const scale = maxEdge / longestEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
};

const canvasToBlob = (canvas: HTMLCanvasElement, mimeType: string, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('Failed to export image blob'));
        return;
      }
      resolve(blob);
    }, mimeType, quality);
  });

const renderCanvas = async (
  image: HTMLImageElement,
  maxEdge: number,
  quality: number,
  mimeType: string
) => {
  const { width, height } = getCanvasSize(image.naturalWidth, image.naturalHeight, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is unavailable');
  }

  context.drawImage(image, 0, 0, width, height);
  const blob = await canvasToBlob(canvas, mimeType, quality);
  const dataUrl = await readAsDataUrl(blob);

  context.clearRect(0, 0, width, height);
  canvas.width = 0;
  canvas.height = 0;

  return {
    blob,
    dataUrl
  };
};

export const revokeImagePreview = (url?: string) => {
  if (!url || !url.startsWith('blob:')) return;
  URL.revokeObjectURL(url);
};

export const processImageFile = async (
  file: File,
  options: ProcessImageOptions = {}
): Promise<ImageAsset> => {
  const image = await loadImageElement(file);
  const maxEdge = options.maxEdge ?? DEFAULT_MAX_EDGE;
  const thumbEdge = options.thumbEdge ?? DEFAULT_THUMB_EDGE;
  const quality = options.quality ?? DEFAULT_QUALITY;
  const mimeType = file.type === 'image/png' ? 'image/jpeg' : 'image/webp';

  try {
    const saved = await renderCanvas(image, maxEdge, quality, mimeType);
    const thumb = await renderCanvas(image, thumbEdge, quality, mimeType);

    return {
      savedDataUrl: saved.dataUrl,
      thumbDataUrl: thumb.dataUrl,
      previewUrl: URL.createObjectURL(thumb.blob)
    };
  } finally {
    image.src = '';
  }
};
