import { postJSON } from './client.js';

export const getFilteredData = (datasetId, selectedCategories) =>
  postJSON('/api/get_filtered_data', {
    dataset_id: datasetId,
    selected_categories: selectedCategories || [],
  });

export const getImagesByCategory = (payload) =>
  postJSON('/api/get_images_by_category', payload);

export const buildImageURL = (datasetId, fileName, sourcePath) => {
  const params = new URLSearchParams({ dataset_id: datasetId, file_name: fileName });
  if (sourcePath) params.set('source_path', sourcePath);
  return `/api/get_image?${params.toString()}`;
};
