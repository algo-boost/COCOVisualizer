import { postJSON } from './client.js';

export const scanFolder = (rootPath) => postJSON('/api/scan_folder', { root_path: rootPath });
export const getLoaderRecord = (cocoDir) => postJSON('/api/get_loader_record', { coco_dir: cocoDir });
export const loadDataset = (payload) => postJSON('/api/load_dataset', payload);
export const loadDatasetMerged = (payload) => postJSON('/api/load_dataset_merged', payload);
export const listServerPaths = (basePath) => postJSON('/api/list_server_paths', { base_path: basePath });
