"use client";

// Client-side Mermaid mount for Ops work manuals.
// Source HTML comes from trusted docs/*.md (not end-user input).

import { useEffect, useId, useRef } from "react";

const THEME_VARS = {
  darkMode: false,
  background: "#fff8f4",
  primaryColor: "#fff3eb",
  primaryTextColor: "#1c1c1c",
  primaryBorderColor: "#e65312",
  secondaryColor: "#fff3eb",
  tertiaryColor: "#ffd8c4",
  lineColor: "#e65312",
  textColor: "#2a2a2a",
  mainBkg: "#fff3eb",
  nodeBorder: "#1c1c1c",
  clusterBkg: "#fff8f4",
  titleColor: "#1c1c1c",
  edgeLabelBackground: "#fff8f4",
  fontFamily:
    '"Segoe UI", "Sarabun", ui-sans-serif, system-ui, sans-serif',
  fontSize: "14px",
};

let mermaidReady: Promise<typeof import("mermaid").default> | null = null;

function loadMermaid() {
  if (!mermaidReady) {
    mermaidReady = import("mermaid").then((mod) => {
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        themeVariables: THEME_VARS,
        flowchart: {
          curve: "basis",
          htmlLabels: true,
          padding: 16,
          useMaxWidth: false,
        },
        er: {
          diagramPadding: 24,
          layoutDirection: "TB",
          minEntityWidth: 140,
          minEntityHeight: 80,
          entityPadding: 16,
          useMaxWidth: false,
        },
        sequence: { mirrorActors: false, useMaxWidth: false },
      });
      return mermaid;
    });
  }
  return mermaidReady;
}

function sizeSvgToViewBox(svgEl: SVGSVGElement) {
  svgEl.removeAttribute("height");
  const viewBox = svgEl.getAttribute("viewBox");
  if (viewBox) {
    const parts = viewBox
      .trim()
      .split(/[\s,]+/)
      .map((n) => Number(n));
    if (parts.length === 4 && parts[2]! > 0 && parts[3]! > 0) {
      svgEl.setAttribute("width", String(Math.ceil(parts[2]!)));
      svgEl.setAttribute("height", String(Math.ceil(parts[3]!)));
    }
  }
  svgEl.style.maxWidth = "none";
  svgEl.style.width = svgEl.getAttribute("width")
    ? `${svgEl.getAttribute("width")}px`
    : "auto";
  svgEl.style.height = "auto";
  svgEl.setAttribute("role", "img");
}

/** Pan (drag) + wheel/button zoom for a Mermaid canvas. */
export function attachMermaidPanZoom(
  viewport: HTMLElement,
  stage: HTMLElement,
  toolbar?: ParentNode | null,
): () => void {
  let scale = 1;
  let tx = 0;
  let ty = 0;
  let dragging = false;
  let pointerId: number | null = null;
  let lastX = 0;
  let lastY = 0;

  const label = toolbar?.querySelector<HTMLElement>(".ops-mermaid-zoom-label");
  const btnIn = toolbar?.querySelector<HTMLButtonElement>(".ops-mermaid-zoom-in");
  const btnOut = toolbar?.querySelector<HTMLButtonElement>(
    ".ops-mermaid-zoom-out",
  );
  const btnReset = toolbar?.querySelector<HTMLButtonElement>(
    ".ops-mermaid-zoom-reset",
  );

  const apply = () => {
    stage.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    if (label) label.textContent = `${Math.round(scale * 100)}%`;
  };

  const setScaleAt = (nextScale: number, cx: number, cy: number) => {
    const clamped = Math.min(4, Math.max(0.35, nextScale));
    if (clamped === scale) return;
    // Keep the point under (cx, cy) stable while zooming.
    const relX = (cx - tx) / scale;
    const relY = (cy - ty) / scale;
    scale = clamped;
    tx = cx - relX * scale;
    ty = cy - relY * scale;
    apply();
  };

  const zoomBy = (factor: number) => {
    const rect = viewport.getBoundingClientRect();
    setScaleAt(scale * factor, rect.width / 2, rect.height / 2);
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = viewport.getBoundingClientRect();
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    setScaleAt(scale * factor, cx, cy);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    dragging = true;
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add("cursor-grabbing");
    viewport.classList.remove("cursor-grab");
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging || pointerId !== event.pointerId) return;
    tx += event.clientX - lastX;
    ty += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    apply();
  };

  const endDrag = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;
    dragging = false;
    pointerId = null;
    viewport.classList.remove("cursor-grabbing");
    viewport.classList.add("cursor-grab");
    try {
      viewport.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  };

  const onDblClick = (event: MouseEvent) => {
    event.preventDefault();
    scale = 1;
    tx = 0;
    ty = 0;
    apply();
  };

  const onIn = () => zoomBy(1.2);
  const onOut = () => zoomBy(1 / 1.2);
  const onReset = () => {
    scale = 1;
    tx = 0;
    ty = 0;
    apply();
  };

  viewport.addEventListener("wheel", onWheel, { passive: false });
  viewport.addEventListener("pointerdown", onPointerDown);
  viewport.addEventListener("pointermove", onPointerMove);
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
  viewport.addEventListener("dblclick", onDblClick);
  btnIn?.addEventListener("click", onIn);
  btnOut?.addEventListener("click", onOut);
  btnReset?.addEventListener("click", onReset);

  viewport.classList.add("cursor-grab");
  stage.style.transformOrigin = "0 0";
  stage.style.willChange = "transform";

  // Fit wide diagrams into the viewport on first paint; user can still zoom/pan.
  requestAnimationFrame(() => {
    const svg = stage.querySelector("svg");
    const natural = svg
      ? Number(svg.getAttribute("width")) || svg.getBoundingClientRect().width
      : 0;
    const available = viewport.clientWidth - 24;
    if (natural > available && available > 40) {
      scale = Math.max(0.35, available / natural);
    }
    apply();
  });
  apply();

  return () => {
    viewport.removeEventListener("wheel", onWheel);
    viewport.removeEventListener("pointerdown", onPointerDown);
    viewport.removeEventListener("pointermove", onPointerMove);
    viewport.removeEventListener("pointerup", endDrag);
    viewport.removeEventListener("pointercancel", endDrag);
    viewport.removeEventListener("dblclick", onDblClick);
    btnIn?.removeEventListener("click", onIn);
    btnOut?.removeEventListener("click", onOut);
    btnReset?.removeEventListener("click", onReset);
  };
}

export function OpsMermaidHost({
  root,
  revision,
}: {
  root: HTMLElement | null;
  revision: string;
}) {
  const renderPass = useId();
  const running = useRef(0);
  const cleanups = useRef<Array<() => void>>([]);

  useEffect(() => {
    for (const dispose of cleanups.current.splice(0)) dispose();
    if (!root) return;
    const nodes = Array.from(
      root.querySelectorAll<HTMLElement>('.ops-mermaid[data-rendered="false"]'),
    );
    if (!nodes.length) return;

    const pass = ++running.current;
    let cancelled = false;

    (async () => {
      const mermaid = await loadMermaid();
      if (cancelled || pass !== running.current) return;

      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        if (!node || cancelled) return;

        const sourceEl = node.querySelector(".ops-mermaid-source");
        const viewport = node.querySelector<HTMLElement>(
          ".ops-mermaid-viewport",
        );
        const stage =
          node.querySelector<HTMLElement>(".ops-mermaid-canvas") ||
          node.querySelector<HTMLElement>(".ops-mermaid-stage");
        const fallback = node.querySelector(".ops-mermaid-fallback");
        const source = sourceEl?.textContent?.trim() || "";
        if (!stage || !source) continue;

        const diagramId = `ops-mmd-${renderPass.replace(/:/g, "")}-${i}`;
        try {
          const { svg } = await mermaid.render(diagramId, source);
          if (cancelled || pass !== running.current) return;
          stage.innerHTML = svg;
          const svgEl = stage.querySelector("svg");
          if (svgEl) sizeSvgToViewBox(svgEl);
          node.dataset.rendered = "true";
          if (fallback) {
            fallback.classList.add("hidden");
            fallback.setAttribute("hidden", "");
            fallback.textContent = "";
          }

          const panRoot = viewport || stage.parentElement;
          if (panRoot) {
            const figure = node.closest(".ops-mermaid-figure");
            const dispose = attachMermaidPanZoom(panRoot, stage, figure);
            cleanups.current.push(dispose);
          }
        } catch (err) {
          if (cancelled) return;
          node.dataset.rendered = "error";
          if (fallback) {
            fallback.classList.remove("hidden");
            fallback.removeAttribute("hidden");
            fallback.textContent =
              err instanceof Error
                ? `เรนเดอร์ไดอะแกรมไม่สำเร็จ: ${err.message}`
                : "เรนเดอร์ไดอะแกรมไม่สำเร็จ";
          }
        }
      }
    })().catch(() => {
      /* import failure surfaced per-node above when possible */
    });

    return () => {
      cancelled = true;
      for (const dispose of cleanups.current.splice(0)) dispose();
    };
  }, [root, revision, renderPass]);

  return null;
}
