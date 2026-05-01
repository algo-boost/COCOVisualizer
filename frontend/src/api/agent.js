import { deleteJSON, getJSON, postForm, postJSON } from './client.js';

export const fetchAgentModules = () => getJSON('/api/agent_modules');
export const fetchAgentSkills = () => getJSON('/api/agent_skills');

export const uploadAgentModule = (file, name, enabled = true) => {
  const fd = new FormData();
  fd.append('file', file);
  if (name) fd.append('name', name);
  fd.append('enabled', enabled ? 'true' : 'false');
  return postForm('/api/agent_modules/upload', fd);
};

export const registerAgentModuleFunctions = (moduleId, functions) =>
  postJSON(`/api/agent_modules/${moduleId}/register_functions`, { functions });

export const importSkillZip = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return postForm('/api/agent_modules/import_skill_zip', fd);
};

export const toggleAgentModule = (moduleId, enabled) =>
  postJSON(`/api/agent_modules/${moduleId}/toggle`, { enabled });

export const deleteAgentModule = (moduleId) =>
  deleteJSON(`/api/agent_modules/${moduleId}`);
