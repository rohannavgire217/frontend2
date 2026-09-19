const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  "https://backend1-3-zb2a.onrender.com";

// Get JWT token for protected API requests
const getHeaders = () => {
  // First check localStorage for the logged-in user's token
  const token =
    localStorage.getItem("access_token") ||
    process.env.REACT_APP_API_TOKEN;

  return token
    ? {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      }
    : {};
};

// Backend health check
export async function getBackendHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);

  if (!response.ok) {
    throw new Error(
      `Backend health check failed: ${response.status}`
    );
  }

  return response.json();
}

// Protected entities API
export async function getEntities(limit = 50) {
  const response = await fetch(
    `${API_BASE_URL}/v1/entities?limit=${limit}`,
    {
      method: "GET",
      headers: getHeaders(),
    }
  );

  if (response.status === 401) {
    throw new Error("Authentication required. Please login.");
  }

  if (!response.ok) {
    throw new Error(
      `Entity request failed: ${response.status}`
    );
  }

  return response.json();
}

// NASA FIRMS fire/hotspot data
export async function getFirms() {
  const response = await fetch(
    `${API_BASE_URL}/v1/firms`,
    {
      method: "GET",
    }
  );

  if (!response.ok) {
    throw new Error(
      `FIRMS request failed: ${response.status}`
    );
  }

  const data = await response.json();

  return data.fires || [];
}