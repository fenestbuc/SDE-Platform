export async function apiFetch(endpoint, options = {}) {
  const token = sessionStorage.getItem("accessToken");
  const headers = { ...options.headers };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  } else {
    delete headers["Content-Type"]; // let browser set boundary
  }

  const res = await fetch(`/api${endpoint}`, { ...options, headers });
  
  if (res.status === 401 && endpoint !== "/auth/login") {
    // try refresh logic here (omitted for brevity, redirect to login)
    window.location.href = "/login.html";
    throw new Error("Unauthorized");
  }
  
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "API Request Failed");
  }
  
  // if response is a blob (file download)
  const contentType = res.headers.get("content-type");
  if (contentType && !contentType.includes("application/json")) {
    return res.blob();
  }
  
  return res.json();
}

export function setupWS(onMessage) {
  const token = sessionStorage.getItem("accessToken");
  if (!token) return;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
  
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "auth", token }));
  };
  
  ws.onmessage = (e) => {
    const data = JSON.parse(e.data);
    onMessage(data);
  };
  
  return ws;
}
