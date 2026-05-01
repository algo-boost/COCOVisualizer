import { postJSON, readNDJSON } from './client.js';

export const exportExperimentDataset = (payload) =>
  postJSON('/api/export_experiment_dataset', payload);

export const exportExperimentDatasetStream = (payload, onLine) =>
  readNDJSON('/api/export_experiment_dataset?stream=1', payload, onLine);
