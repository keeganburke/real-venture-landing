"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { CompProperty, SubjectProperty } from "@/lib/comp-picker/types";

// Google Maps is loaded by injecting the official script tag once; no npm
// loader package. The `google` global has no local typings on purpose
// (no @types/google.maps in this repo), so map objects are typed as `any`.
declare global {
  interface Window {
    google?: any;
    gm_authFailure?: () => void;
  }
}

const SCRIPT_ID = "google-maps-js";
const POLL_MS = 100;
const TIMEOUT_MS = 10_000;

export type JudgedState = "good" | "bad";

type Props = {
  subject: SubjectProperty;
  comps: CompProperty[];
  // comp.id -> judged colour. Absent = not judged yet (gold pin).
  judgedComps?: Record<string, JudgedState | undefined>;
  // Wired to each comp marker's click; the parent decides what to do.
  onCompClick?: (compId: string) => void;
  // Fires on a click on the bare map (not a pin, not the bubble). The parent
  // uses it to close the open bubble.
  onMapClick?: () => void;
  // Which comp the bubble is anchored to. null / undefined = no bubble.
  bubbleCompId?: string | null;
  // Rendered inside the bubble via a portal into the map's float pane.
  bubbleContent?: ReactNode;
};

// Pin colours: gold until judged, then green (good) or red (bad).
const PIN_GOLD = "#facc15";
const PIN_GOOD = "#22c55e";
const PIN_BAD = "#ef4444";
const TEXT_DARK = "#0a0a0a";
const TEXT_LIGHT = "#ffffff";

function pinStyle(state: JudgedState | undefined): { fill: string; text: string } {
  if (state === "good") return { fill: PIN_GOOD, text: TEXT_DARK };
  if (state === "bad") return { fill: PIN_BAD, text: TEXT_LIGHT };
  return { fill: PIN_GOLD, text: TEXT_DARK };
}

function svgDataUrl(svg: string): string {
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

function priceLabel(salePrice: number): string {
  return "$" + Math.round(salePrice / 1000) + "K";
}

// Zillow-style comp pin: 56x24 pill (rx 6) inside a 60x30 box so the drop
// shadow has room, no tail, no outline. Anchored at the pill centre (30, 14)
// so the pin sits on the coord like Zillow's do.
const PIN_W = 60;
const PIN_H = 30;
const PIN_ANCHOR = { x: 30, y: 14 };

function compIcon(salePrice: number, state: JudgedState | undefined): string {
  const { fill, text } = pinStyle(state);
  return svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_W}" height="${PIN_H}" viewBox="0 0 ${PIN_W} ${PIN_H}">` +
      `<defs><filter id="ds" x="-20%" y="-20%" width="140%" height="140%">` +
      `<feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.35"/>` +
      `</filter></defs>` +
      `<rect x="2" y="2" width="56" height="24" rx="6" ry="6" fill="${fill}" filter="url(#ds)"/>` +
      `<text x="30" y="19" text-anchor="middle" fill="${text}" font-family="-apple-system, Segoe UI, Roboto, sans-serif" font-size="12" font-weight="700">${priceLabel(salePrice)}</text>` +
      `</svg>`,
  );
}

// Subject marker is plain HTML in an OverlayView (green price pill above the
// house PNG). A data-URL SVG marker cannot fetch an external <image href>,
// so the PNG would never render through the icon route.
const HOUSE_SRC = "/comp-picker-house.png";
// 72 wide, house base 50px below the top edge: the coord sits under the house.
const SUBJECT_ANCHOR = { x: 36, y: 50 };

// Bubble geometry. The pin's pill top is 14px above the coord and the bubble
// tail is 8px tall, so -24 puts the tail tip just above the pill.
const BUBBLE_OFFSET_Y = -24;
const BUBBLE_W = 320;
const BUBBLE_TAIL = 8;
const BUBBLE_EDGE_PAD = 12;

function buildSubjectElement(salePrice: number): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "comp-picker-subject-marker";
  const pill = document.createElement("div");
  pill.className = "comp-picker-subject-pill";
  pill.textContent = priceLabel(salePrice);
  const house = document.createElement("img");
  house.className = "comp-picker-subject-house";
  house.src = HOUSE_SRC;
  house.alt = "";
  house.width = 28;
  house.height = 28;
  el.appendChild(pill);
  el.appendChild(house);
  return el;
}

// Minimal OverlayView wrapper: mounts `el` into the named pane and calls
// `place` with the projection on every draw. Built as an instance with
// methods assigned (the Google-documented pattern) rather than a subclass,
// because the base class only exists after the script loads.
function makeHtmlOverlay(
  g: any,
  el: HTMLElement,
  paneName: "overlayMouseTarget" | "floatPane",
  place: (proj: any, position: any) => void,
): any {
  const overlay = new g.maps.OverlayView();
  overlay.position = null;
  overlay.onAdd = function onAdd(this: any) {
    const panes = this.getPanes();
    if (panes?.[paneName]) panes[paneName].appendChild(el);
  };
  overlay.draw = function draw(this: any) {
    const proj = this.getProjection();
    if (!proj || !this.position) return;
    place(proj, this.position);
  };
  overlay.onRemove = function onRemove() {
    if (el.parentNode) el.parentNode.removeChild(el);
  };
  return overlay;
}

// Resolves once window.google.maps exists; injects the script if needed.
function loadGoogleMaps(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve();
      return;
    }
    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=marker&v=weekly`;
      script.onerror = () => reject(new Error("script failed to load"));
      document.head.appendChild(script);
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (window.google?.maps) {
        window.clearInterval(timer);
        resolve();
      } else if (Date.now() - started > TIMEOUT_MS) {
        window.clearInterval(timer);
        reject(new Error("timed out waiting for google.maps"));
      }
    }, POLL_MS);
  });
}

export default function CompPickerMap({
  subject,
  comps,
  judgedComps,
  onCompClick,
  onMapClick,
  bubbleCompId,
  bubbleContent,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  // comp.id -> Marker, so judged-state changes can swap icons in place.
  const compMarkersRef = useRef<Map<string, any>>(new Map());
  const subjectOverlayRef = useRef<any>(null);
  const bubbleOverlayRef = useRef<any>(null);
  // Set once per open: the next draw pans the map if the bubble is clipped.
  const bubblePanCheckRef = useRef(false);
  const onCompClickRef = useRef(onCompClick);
  onCompClickRef.current = onCompClick;
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const judgedRef = useRef(judgedComps);
  judgedRef.current = judgedComps;

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorText, setErrorText] = useState("Map failed to load. Check API key.");
  // Portal target for the bubble; created with the map, lives in floatPane.
  const [bubbleEl, setBubbleEl] = useState<HTMLDivElement | null>(null);
  // Under 640px the bubble becomes a full-screen modal instead of an
  // anchored overlay. matchMedia + its change event covers resize/rotate.
  const [isMobile, setIsMobile] = useState(false);
  const isMobileRef = useRef(false);
  isMobileRef.current = isMobile;

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) {
      setErrorText("Map failed to load. NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set.");
      setStatus("error");
      return;
    }

    // Google calls this global when the key is rejected (bad key, referrer
    // restriction, billing). Surface it instead of the grey watermark.
    window.gm_authFailure = () => {
      console.error("[comp-picker map] Google Maps auth failure (key, referrer or billing)");
      setErrorText("Map failed to load. Google rejected the API key (check referrer restrictions and billing).");
      setStatus("error");
    };

    loadGoogleMaps(key)
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const g = window.google;
        const center = { lat: subject.lat, lng: subject.lng };

        const map = new g.maps.Map(containerRef.current, {
          center,
          zoom: 14,
          mapTypeId: "roadmap",
          gestureHandling: "greedy",
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
          zoomControl: true,
          // Zillow-style clean map: hide business / civic POIs and transit.
          // Parks stay visible for orientation.
          styles: [
            { featureType: "poi.business", stylers: [{ visibility: "off" }] },
            { featureType: "poi.attraction", stylers: [{ visibility: "off" }] },
            { featureType: "poi.medical", stylers: [{ visibility: "off" }] },
            { featureType: "poi.place_of_worship", stylers: [{ visibility: "off" }] },
            { featureType: "poi.sports_complex", stylers: [{ visibility: "off" }] },
            { featureType: "poi.school", stylers: [{ visibility: "off" }] },
            { featureType: "poi.government", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        });
        mapRef.current = map;

        // Subject: HTML overlay (pill + house PNG), sits above the comp
        // pins but ignores pointer events so pins under it stay clickable.
        const subjectEl = buildSubjectElement(subject.salePrice);
        const subjectOverlay = makeHtmlOverlay(g, subjectEl, "overlayMouseTarget", (proj, position) => {
          const px = proj.fromLatLngToDivPixel(position);
          if (!px) return;
          subjectEl.style.left = `${px.x - SUBJECT_ANCHOR.x}px`;
          subjectEl.style.top = `${px.y - SUBJECT_ANCHOR.y}px`;
        });
        subjectOverlay.position = new g.maps.LatLng(center.lat, center.lng);
        subjectOverlay.setMap(map);
        subjectOverlayRef.current = subjectOverlay;

        // Bubble: one reusable overlay in floatPane (above everything).
        // Clicks and drags inside it must not reach the map.
        const wrap = document.createElement("div");
        wrap.className = "comp-bubble-wrap";
        if (typeof g.maps.OverlayView.preventMapHitsAndGesturesFrom === "function") {
          g.maps.OverlayView.preventMapHitsAndGesturesFrom(wrap);
        }
        const bubbleOverlay = makeHtmlOverlay(g, wrap, "floatPane", (proj, position) => {
          const px = proj.fromLatLngToDivPixel(position);
          if (!px) return;
          wrap.style.left = `${px.x}px`;
          wrap.style.top = `${px.y + BUBBLE_OFFSET_Y}px`;

          // First draw after opening: nudge the map so the whole bubble is
          // on screen. panBy triggers another draw, which skips this block.
          // Skipped on mobile, where the bubble is a modal, not anchored.
          if (!bubblePanCheckRef.current) return;
          bubblePanCheckRef.current = false;
          if (isMobileRef.current) return;
          const cp = proj.fromLatLngToContainerPixel(position);
          const host = containerRef.current;
          const bubbleH = wrap.offsetHeight;
          if (!cp || !host || !bubbleH) return;
          const top = cp.y + BUBBLE_OFFSET_Y - BUBBLE_TAIL - bubbleH;
          const left = cp.x - BUBBLE_W / 2;
          const right = cp.x + BUBBLE_W / 2;
          let dx = 0;
          let dy = 0;
          if (top < BUBBLE_EDGE_PAD) dy = top - BUBBLE_EDGE_PAD;
          if (left < BUBBLE_EDGE_PAD) dx = left - BUBBLE_EDGE_PAD;
          else if (right > host.clientWidth - BUBBLE_EDGE_PAD) dx = right - (host.clientWidth - BUBBLE_EDGE_PAD);
          if (dx !== 0 || dy !== 0) map.panBy(dx, dy);
        });
        bubbleOverlayRef.current = bubbleOverlay;
        setBubbleEl(wrap);

        // Keep HTML overlays glued to their coords while the map moves.
        // (Google already calls draw() for us; this is belt and braces.)
        const redraw = () => {
          if (subjectOverlay.getMap()) subjectOverlay.draw();
          if (bubbleOverlay.getMap()) bubbleOverlay.draw();
        };
        map.addListener("bounds_changed", redraw);
        map.addListener("zoom_changed", redraw);
        // Bare-map click closes the bubble (pins and the bubble swallow theirs).
        map.addListener("click", () => onMapClickRef.current?.());

        // Price-tag comp pins. Initial colour honours any judged state that
        // already exists (e.g. the map remounted mid-round).
        compMarkersRef.current = new Map();
        const compMarkers = comps.map((comp) => {
          const marker = new g.maps.Marker({
            map,
            position: { lat: comp.lat, lng: comp.lng },
            title: `${comp.address} (${priceLabel(comp.salePrice)})`,
            zIndex: 5,
            icon: {
              url: compIcon(comp.salePrice, judgedRef.current?.[comp.id]),
              scaledSize: new g.maps.Size(PIN_W, PIN_H),
              anchor: new g.maps.Point(PIN_ANCHOR.x, PIN_ANCHOR.y),
            },
          });
          marker.addListener("click", () => onCompClickRef.current?.(comp.id));
          compMarkersRef.current.set(comp.id, marker);
          return marker;
        });

        markersRef.current = compMarkers;
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("[comp-picker map] load failed", err);
        setStatus("error");
      });

    return () => {
      cancelled = true;
      // Google Maps has no destroy method; detach overlays and let the DOM
      // node cleanup take the map instance with it.
      for (const m of markersRef.current) m.setMap(null);
      markersRef.current = [];
      compMarkersRef.current = new Map();
      subjectOverlayRef.current?.setMap(null);
      subjectOverlayRef.current = null;
      bubbleOverlayRef.current?.setMap(null);
      bubbleOverlayRef.current = null;
      setBubbleEl(null);
      mapRef.current = null;
      if (window.gm_authFailure) delete window.gm_authFailure;
    };
    // Subject and comps are module constants for this mockup; re-running
    // the effect on prop identity changes would rebuild the map needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recolour only the affected pins when judged state changes; the map and
  // the other markers are left alone.
  useEffect(() => {
    if (status !== "ready" || !window.google?.maps) return;
    const g = window.google;
    comps.forEach((comp) => {
      const marker = compMarkersRef.current.get(comp.id);
      if (!marker) return;
      marker.setIcon({
        url: compIcon(comp.salePrice, judgedComps?.[comp.id]),
        scaledSize: new g.maps.Size(PIN_W, PIN_H),
        anchor: new g.maps.Point(PIN_ANCHOR.x, PIN_ANCHOR.y),
      });
    });
  }, [judgedComps, comps, status]);

  // Show / move / hide the bubble overlay as the anchored comp changes.
  // On mobile the overlay stays unmounted; the modal portal below takes over.
  useEffect(() => {
    if (status !== "ready" || !window.google?.maps) return;
    const overlay = bubbleOverlayRef.current;
    const map = mapRef.current;
    if (!overlay || !map) return;
    const comp = bubbleCompId && !isMobile ? comps.find((c) => c.id === bubbleCompId) : undefined;
    if (!comp) {
      overlay.position = null;
      if (overlay.getMap()) overlay.setMap(null);
      return;
    }
    overlay.position = new window.google.maps.LatLng(comp.lat, comp.lng);
    bubblePanCheckRef.current = true;
    if (overlay.getMap()) overlay.draw();
    else overlay.setMap(map);
  }, [bubbleCompId, comps, status, isMobile]);

  if (status === "error") {
    return <div className="comp-picker-map-error">{errorText}</div>;
  }

  return (
    <>
      {status === "loading" && <div className="comp-picker-map-loading">Loading map...</div>}
      <div
        ref={containerRef}
        className="comp-picker-map"
        style={status === "loading" ? { height: 0, border: 0, overflow: "hidden" } : undefined}
      />
      {bubbleCompId && bubbleContent
        ? isMobile
          ? createPortal(
              <div className="comp-picker-mobile-modal-backdrop" onClick={() => onMapClickRef.current?.()}>
                <div className="comp-picker-mobile-modal-wrap" onClick={(e) => e.stopPropagation()}>
                  <div className="comp-bubble-wrap">{bubbleContent}</div>
                </div>
              </div>,
              document.body,
            )
          : bubbleEl
            ? createPortal(bubbleContent, bubbleEl)
            : null
        : null}
    </>
  );
}
