import { postForm } from './client.js';

export const uploadCocoFile = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return postForm('/api/upload', fd);
};

export const uploadDropBundle = (files, paths) => {
  const fd = new FormData();
  files.forEach((f) => fd.append('files', f));
  paths.forEach((p) => fd.append('paths', p));
  return postForm('/api/upload_drop_bundle', fd);
};
