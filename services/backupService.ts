import JSZip from 'jszip';
import { Item } from '../types';
import { exportCSV, importCSV } from './storageService';

type ExportZipResult = {
  fileName: string;
  blob: Blob;
  base64: string;
};

const DATA_JSON = 'data.json';
const DATA_CSV = 'data.csv';
const IMAGES_DIR = 'images';

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

const EXT_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif'
};

const uint8ToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const base64ToUint8 = (base64: string) => {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const parseDataUrl = (dataUrl: string) => {
  const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) return null;
  const mime = match[1];
  const base64 = match[2];
  return { mime, bytes: base64ToUint8(base64) };
};

const inferMimeFromPath = (path: string) => {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return EXT_TO_MIME[ext] || 'application/octet-stream';
};

const normalizeItem = (raw: any): Item => {
  const item: any = { ...raw };
  item.id = item.id || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  item.type = item.type === 'wishlist' ? 'wishlist' : 'owned';
  item.price = typeof item.price === 'number' ? item.price : parseFloat(String(item.price || '')) || 0;
  item.msrp = typeof item.msrp === 'number' ? item.msrp : parseFloat(String(item.msrp || '')) || 0;
  item.quantity = typeof item.quantity === 'number' ? item.quantity : parseFloat(String(item.quantity || '')) || 1;
  item.avgPrice = typeof item.avgPrice === 'number' ? item.avgPrice : Number((item.price / (item.quantity || 1)).toFixed(2));
  item.usageCount = typeof item.usageCount === 'number' ? item.usageCount : parseFloat(String(item.usageCount || '')) || 0;
  item.priceHistory = Array.isArray(item.priceHistory) ? item.priceHistory : [];
  item.category = item.category || 'other';
  if (!item.storeName) item.storeName = '';
  if (!item.image) item.image = undefined;
  return item as Item;
};

export const buildExportZip = async (items: Item[], csvContent?: string): Promise<ExportZipResult> => {
  const zip = new JSZip();
  const csv = csvContent || `\ufeff${exportCSV(items)}`;
  zip.file(DATA_CSV, csv);

  const exportItems: any[] = [];
  for (const item of items) {
    const { image, ...rest } = item;
    if (image) {
      const parsed = parseDataUrl(image);
      if (parsed) {
        const ext = MIME_TO_EXT[parsed.mime] || 'png';
        const imageFile = `${IMAGES_DIR}/${item.id}.${ext}`;
        zip.file(imageFile, parsed.bytes, { binary: true });
        exportItems.push({ ...rest, imageFile });
      } else {
        exportItems.push({ ...rest, image });
      }
    } else {
      exportItems.push({ ...rest });
    }
  }

  zip.file(DATA_JSON, JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    items: exportItems
  }, null, 2));

  const data = await zip.generateAsync({ type: 'uint8array' });
  const blob = new Blob([data], { type: 'application/zip' });
  const base64 = uint8ToBase64(data);
  const fileName = `tracker_backup_${new Date().toISOString().split('T')[0]}.zip`;

  return { fileName, blob, base64 };
};

export const importBackupFile = async (file: File): Promise<Item[]> => {
  if (file.name.toLowerCase().endsWith('.zip')) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    let items: any[] = [];

    const dataJson = zip.file(DATA_JSON);
    if (dataJson) {
      const jsonText = await dataJson.async('string');
      const parsed = JSON.parse(jsonText);
      items = Array.isArray(parsed) ? parsed : (parsed?.items || []);
    } else {
      const dataCsv = zip.file(DATA_CSV);
      if (!dataCsv) return [];
      const csvText = await dataCsv.async('string');
      items = importCSV(csvText);
    }

    const hydrated = await Promise.all(items.map(async (raw) => {
      const item: any = { ...raw };
      if (!item.image && item.imageFile) {
        const entry = zip.file(item.imageFile) || zip.file(item.imageFile.replace(/^\/+/, ''));
        if (entry) {
          const bytes = await entry.async('uint8array');
          const mime = inferMimeFromPath(item.imageFile);
          item.image = `data:${mime};base64,${uint8ToBase64(bytes)}`;
        }
      }
      delete item.imageFile;
      return normalizeItem(item);
    }));

    return hydrated;
  }

  const text = await file.text();
  return importCSV(text);
};
