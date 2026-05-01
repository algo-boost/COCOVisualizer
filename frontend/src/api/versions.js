import { postJSON } from './client.js';

export const listVersions = (datasetId) => postJSON('/api/list_versions', { dataset_id: datasetId });
export const rollbackVersion = (datasetId, versionId) =>
  postJSON('/api/rollback_version', { dataset_id: datasetId, version_id: versionId });
