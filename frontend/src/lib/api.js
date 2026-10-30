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

export const embedSnippet = (siteId) =>
  `<!-- AccessLayer: paste into your website <head> -->\n<script src="${WIDGET_SRC}"\n  data-site-id="${siteId}"\n  data-autofix="true"\n  data-sarvam-voice="enabled" async></script>`;
