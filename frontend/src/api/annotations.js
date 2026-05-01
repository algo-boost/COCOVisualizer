import { postJSON } from './client.js';

export const saveAnnotations = (datasetId, images) =>
  postJSON('/api/save_annotations', { dataset_id: datasetId, images });

export const renameCategory = (datasetId, oldName, newName) =>
  postJSON('/api/rename_category', { dataset_id: datasetId, old_name: oldName, new_name: newName });

export const saveImageMetadata = (datasetId, images, opts = {}) =>
  postJSON('/api/save_image_metadata', {
    dataset_id: datasetId,
    images,
    skip_version: !!opts.skipVersion,
    image_category_definitions: opts.imageCategoryDefinitions || null,
    version_comment: opts.versionComment || '',
  });
