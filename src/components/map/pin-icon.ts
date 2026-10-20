/**
 * The FA map pin — a navy disc with the FA sygnet (`/brand/sygnet.png`) — as a Leaflet
 * `divIcon`. One pin for every map: the /trips map (the standard pin, no area) and the
 * single-location map of the v2 page and the offer page (`LocationMap`), which drew an
 * orange drop until FA-1.62 (Figma review 2026-10-20; tj: everywhere `LocationMap` draws).
 *
 * Leaflet touches `window` on import, so this is for client modules that load with
 * `ssr: false` only.
 */

import L from 'leaflet'

export function pinIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 30px; height: 30px;
      background: #0A2E4D;
      border-radius: 50%;
      border: 2.5px solid white;
      box-shadow: 0 2px 10px rgba(10,46,77,0.40);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center; overflow: hidden;
    ">
      <img src="/brand/sygnet.png" style="width:17px;height:17px;object-fit:contain;" draggable="false"/>
    </div>`,
    iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -18],
  })
}
