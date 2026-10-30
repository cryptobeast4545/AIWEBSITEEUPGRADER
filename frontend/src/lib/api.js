import { useCallback } from "react";
import axios from "axios";
import { useAuth } from "@clerk/react";

export const BACKEND = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND}/api`;
export const WIDGET_SRC = `${API}/widget.js`;

export const errMsg = (e) => e?.response?.data?.detail || e?.message || "Something went wrong";

export function useApi() {
  const { getToken } = useAuth();
  return useCallback(async (method, path, data) => {
    const token = await getToken();
    const res = await axios({ method, url: `${API}${path}`, data, headers: { Authorization: `Bearer ${token}` } });
    return res.data;
  }, [getToken]);
}

export const embedSnippet = (siteId) => {
  // The snippet is pasted into *external* websites, so the script src MUST be
  // absolute. When the dashboard is served same-origin as the backend (Render
  // build with REACT_APP_BACKEND_URL=""), derive the origin at runtime; when
  // deployed separately, use the configured REACT_APP_BACKEND_URL.
  const base = BACKEND || (typeof window !== "undefined" ? window.location.origin : "");
  const src = `${base}/api/widget.js`;
  return `<!-- AccessLayer: paste into your website <head> -->\n<script src="${src}"\n  data-site-id="${siteId}"\n  data-autofix="true"\n  data-sarvam-voice="enabled" async></script>`;
};
