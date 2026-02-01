import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeWebdavPlugin {
  upload(options: { serverUrl: string; username: string; password: string; filename: string; base64: string }): Promise<void>;
  download(options: { serverUrl: string; username: string; password: string; filename: string }): Promise<{ base64: string }>;
  delete(options: { serverUrl: string; username: string; password: string; filename: string }): Promise<void>;
  exists(options: { serverUrl: string; username: string; password: string; filename: string }): Promise<{ exists: boolean }>;
}

const NativeWebdav = registerPlugin<NativeWebdavPlugin>('WebdavPlugin');

export type WebDavConfig = {
  serverUrl: string;
  username: string;
  password: string;
};

const createWebOnlyError = () => {
  const error: any = new Error('webdav_native_only');
  error.code = 'webdav_native_only';
  return error;
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

const blobToBase64 = async (blob: Blob) => {
  const buffer = await blob.arrayBuffer();
  return uint8ToBase64(new Uint8Array(buffer));
};

const normalizeBaseUrl = (url: string) => {
  const trimmed = url.trim();
  if (!trimmed) return '';
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
};

const encodePath = (path: string) =>
  path
    .split('/')
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join('/');

const toBase64 = (value: string) => {
  try {
    return btoa(unescape(encodeURIComponent(value)));
  } catch {
    return btoa(value);
  }
};

const getContentType = (data: Blob) => data.type || 'application/octet-stream';

const buildAuthHeader = (username: string, password: string) =>
  `Basic ${toBase64(`${username}:${password}`)}`;

export const buildWebDavUrl = (baseUrl: string, filename: string) => {
  const base = normalizeBaseUrl(baseUrl);
  const safeName = encodePath(filename || '');
  return `${base}${safeName}`;
};

export const uploadWebDav = async (config: WebDavConfig, filename: string, data: Blob) => {
  if (!Capacitor.isNativePlatform()) {
    throw createWebOnlyError();
  }
  if (Capacitor.isNativePlatform()) {
    const base64 = await blobToBase64(data);
    await NativeWebdav.upload({
      serverUrl: config.serverUrl,
      username: config.username,
      password: config.password,
      filename,
      base64
    });
    return;
  }

  const url = buildWebDavUrl(config.serverUrl, filename);
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: buildAuthHeader(config.username, config.password),
      'Content-Type': getContentType(data),
      Accept: '*/*'
    },
    body: data,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const error = new Error(`WebDAV upload failed: ${response.status}`);
    (error as any).status = response.status;
    (error as any).body = errorText;
    throw error;
  }
};

export const downloadWebDav = async (config: WebDavConfig, filename: string): Promise<Blob> => {
  if (!Capacitor.isNativePlatform()) {
    throw createWebOnlyError();
  }
  if (Capacitor.isNativePlatform()) {
    const { base64 } = await NativeWebdav.download({
      serverUrl: config.serverUrl,
      username: config.username,
      password: config.password,
      filename
    });
    const bytes = base64ToUint8(base64);
    return new Blob([bytes], { type: 'application/zip' });
  }

  const url = buildWebDavUrl(config.serverUrl, filename);
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: buildAuthHeader(config.username, config.password),
      Accept: '*/*'
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const error = new Error(`WebDAV download failed: ${response.status}`);
    (error as any).status = response.status;
    (error as any).body = errorText;
    throw error;
  }

  return response.blob();
};

export const existsWebDav = async (config: WebDavConfig, filename: string): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) {
    throw createWebOnlyError();
  }
  if (Capacitor.isNativePlatform()) {
    const result = await NativeWebdav.exists({
      serverUrl: config.serverUrl,
      username: config.username,
      password: config.password,
      filename
    });
    return Boolean(result?.exists);
  }

  const url = buildWebDavUrl(config.serverUrl, filename);
  const response = await fetch(url, {
    method: 'HEAD',
    headers: {
      Authorization: buildAuthHeader(config.username, config.password),
      Accept: '*/*'
    }
  });

  if (response.status === 404) return false;
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const error = new Error(`WebDAV exists failed: ${response.status}`);
    (error as any).status = response.status;
    (error as any).body = errorText;
    throw error;
  }
  return true;
};

export const deleteWebDav = async (config: WebDavConfig, filename: string): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    throw createWebOnlyError();
  }
  if (Capacitor.isNativePlatform()) {
    await NativeWebdav.delete({
      serverUrl: config.serverUrl,
      username: config.username,
      password: config.password,
      filename
    });
    return;
  }

  const url = buildWebDavUrl(config.serverUrl, filename);
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: buildAuthHeader(config.username, config.password),
      Accept: '*/*'
    }
  });

  if (response.status === 404) return;
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const error = new Error(`WebDAV delete failed: ${response.status}`);
    (error as any).status = response.status;
    (error as any).body = errorText;
    throw error;
  }
};
