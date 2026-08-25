"use client";

import { TILES } from "../hub-copy";
import NextLiveRow from "./NextLiveRow";

export default function TileList() {
  return (
    <>
      {TILES.map((tile) => (
        <span key={tile.id} style={{ display: "contents" }}>
          <a
            className={`tile t-${tile.accent}`}
            href={tile.href}
            {...(tile.external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
          >
            <div className="tile-icn">
              <svg
                className="ico"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                dangerouslySetInnerHTML={{ __html: tile.icon }}
              />
            </div>
            <div className="tile-body">
              <div className="tile-title">{tile.title}</div>
              <div className="tile-sub">
                {tile.id === "community" && <span className="tile-dot" />}
                {tile.sub}
              </div>
            </div>
            <div className="tile-arw">{"→"}</div>
          </a>
          {tile.id === "livestreams" && <NextLiveRow />}
        </span>
      ))}
    </>
  );
}
