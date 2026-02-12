export interface GeneratedImage {
  imageUrl: string;
  originalUrl: string;
  prompt: string;
}

export enum AppState {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  GENERATING = 'GENERATING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface FileData {
  id: string; // Unique ID for tracking
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
}

export interface ProcessingItem extends FileData {
  status: 'IDLE' | 'GENERATING' | 'SUCCESS' | 'ERROR';
  results?: string[]; // Store multiple generated URLs
  error?: string;
}

export type EditMode = 'background' | 'custom' | 'banner';

export type AspectRatio = '1:1' | '16:9' | '9:16';