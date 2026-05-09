export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = sessionStorage.getItem("accessToken");
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  } else {
    delete headers["Content-Type"];
  }

  const res = await fetch(`/api${endpoint}`, { ...options, headers });
  
  if (res.status === 401 && endpoint !== "/auth/login") {
    sessionStorage.removeItem("accessToken");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "API Request Failed");
  }
  
  const contentType = res.headers.get("content-type");
  if (contentType && !contentType.includes("application/json")) {
    return res.blob();
  }
  
  return res.json();
}
