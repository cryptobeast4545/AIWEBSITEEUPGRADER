import { useEffect } from "react";
import { WIDGET_SRC } from "@/lib/api";

export function useWidget(siteId = "demo") {
  useEffect(() => {
    const s = document.createElement("script");
    s.src = WIDGET_SRC;
    s.async = true;
    s.dataset.siteId = siteId;
    s.dataset.autofix = "true";
    s.dataset.sarvamVoice = "enabled";
    s.id = "accesslayer-loader";
    document.body.appendChild(s);
    return () => {
      window.AccessLayer?.destroy?.();
      s.remove();
    };
  }, [siteId]);
}
