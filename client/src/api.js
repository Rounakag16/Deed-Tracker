const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Returns { workspaces, total, page, limit }
  listWorkspaces: (page = 1, limit = 20) =>
    request(`/workspaces?page=${page}&limit=${limit}`),
  getWorkspace: (id) => request(`/workspaces/${id}`),
  createWorkspace: (name, description) =>
    request("/workspaces", { method: "POST", body: JSON.stringify({ name, description }) }),
  updateWorkspace: (id, data) =>
    request(`/workspaces/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteWorkspace: (id) => request(`/workspaces/${id}`, { method: "DELETE" }),

  listDeeds: (workspaceId) => request(`/workspaces/${workspaceId}/deeds`),
  createDeeds: (workspaceId, deeds) =>
    request(`/workspaces/${workspaceId}/deeds`, {
      method: "POST",
      body: JSON.stringify({ deeds }),
    }),
  updateDeed: (workspaceId, deedId, data) =>
    request(`/workspaces/${workspaceId}/deeds/${deedId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteDeed: (workspaceId, deedId) =>
    request(`/workspaces/${workspaceId}/deeds/${deedId}`, { method: "DELETE" }),

  listRelationships: (workspaceId) => request(`/workspaces/${workspaceId}/relationships`),
  createRelationships: (workspaceId, relationships) =>
    request(`/workspaces/${workspaceId}/relationships`, {
      method: "POST",
      body: JSON.stringify({ relationships }),
    }),
  deleteRelationship: (workspaceId, relationshipId) =>
    request(`/workspaces/${workspaceId}/relationships/${relationshipId}`, {
      method: "DELETE",
    }),

  // Returns { results, total, page, limit }
  search: (q, topic, workspaceId, page = 1, limit = 25) => {
    const params = new URLSearchParams({ q, topic, page, limit });
    if (workspaceId) params.set("workspaceId", workspaceId);
    return request(`/search?${params.toString()}`);
  },

  exportWorkspaceUrl: (workspaceId) => `${BASE}/workspaces/${workspaceId}/export`,
};
