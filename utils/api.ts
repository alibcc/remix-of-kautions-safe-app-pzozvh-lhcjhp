
import Constants from "expo-constants";
import { supabase } from "@/app/integrations/supabase/client";

const API_URL = Constants.expoConfig?.extra?.backendUrl || "https://rtcsrhamfbtmv77fdyw7wqbktr6af39m.app.specular.dev";

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.access_token) {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    };
  }
  
  return {
    "Content-Type": "application/json",
  };
}

export async function apiGet<T = any>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function apiPost<T = any>(endpoint: string, body: any): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function authenticatedGet<T = any>(endpoint: string): Promise<T> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function authenticatedPost<T = any>(endpoint: string, body: any): Promise<T> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function authenticatedPut<T = any>(endpoint: string, body: any): Promise<T> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function authenticatedDelete<T = any>(endpoint: string): Promise<T> {
  const headers = await getAuthHeaders();
  
  // Remove Content-Type for DELETE requests without body
  const deleteHeaders: HeadersInit = {};
  if (headers.Authorization) {
    deleteHeaders.Authorization = headers.Authorization;
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: "DELETE",
    headers: deleteHeaders,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function uploadImage(file: { uri: string; name: string; type: string }): Promise<{ url: string }> {
  const headers = await getAuthHeaders();
  
  const formData = new FormData();
  formData.append('image', {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as any);

  const response = await fetch(`${API_URL}/api/upload/image`, {
    method: "POST",
    headers: {
      Authorization: headers.Authorization || "",
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  return response.json();
}
