const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  "https://backend1-3-zb2a.onrender.com";

const getHeaders = () => {
  const token = process.env.REACT_APP_API_TOKEN;

  return token
    ? { Authorization: `Bearer ${token}` }
    : {};
};

export async function getBackendHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);

  if (!response.ok) {
    throw new Error(
      `Backend health check failed: ${response.status}`
    );
  }

  return response.json();
}

export async function getEntities(limit = 50) {
  const response = await fetch(
    `${API_BASE_URL}/v1/entities?limit=${limit}`,
    {
      headers: getHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Entity request failed: ${response.status}`
    );
  }

  return response.json();
}

export async function getFirms() {
  const response = await fetch(
    `${API_BASE_URL}/v1/firms`
  );

  if (!response.ok) {
    throw new Error(
      `FIRMS request failed: ${response.status}`
    );
  }

  const data = await response.json();

  return data.fires;
}