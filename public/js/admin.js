import { apiFetch } from "./api.js";

async function loadStats() {
  const stats = await apiFetch("/admin/stats");
  document.body.innerHTML = `
    <div class="p-8">
      <h1 class="text-3xl font-bold mb-4">Admin Dashboard</h1>
      <div class="grid grid-cols-3 gap-4 mb-8">
        <div class="bg-blue-100 p-4 rounded shadow">Users: ${stats.users}</div>
        <div class="bg-green-100 p-4 rounded shadow">Messages: ${stats.messages}</div>
        <div class="bg-yellow-100 p-4 rounded shadow">Storage: ${(stats.storageBytes / 1024 / 1024).toFixed(2)} MB</div>
      </div>
    </div>
  `;
}
loadStats().catch(e => document.body.innerHTML = `<p class="p-8 text-red-500">${e.message}</p>`);
