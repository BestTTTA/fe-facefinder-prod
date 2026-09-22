import { ImageResponse } from "next/og";

export const alt = "FaceFinder — Face Recognition API";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#1a1d33";
const ORANGE = "#f59209";
const BG = "#f5f5f4";
const MUTED = "#6b6f80";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: BG,
          color: NAVY,
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* large brand mark in the corner, echoing the logo */}
        <div style={{ position: "absolute", right: -30, top: -30, display: "flex", flexDirection: "column", opacity: 0.9 }}>
          <div style={{ display: "flex" }}>
            <div style={{ width: 130, height: 130 }} />
            <div style={{ width: 130, height: 130, background: NAVY, borderRadius: 24 }} />
          </div>
          <div style={{ display: "flex" }}>
            <div style={{ width: 130, height: 130, background: ORANGE, borderRadius: 24 }} />
            <div style={{ width: 130, height: 130 }} />
          </div>
        </div>

        {/* logo lockup */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex" }}>
              <div style={{ width: 22, height: 22 }} />
              <div style={{ width: 22, height: 22, background: NAVY }} />
            </div>
            <div style={{ display: "flex" }}>
              <div style={{ width: 22, height: 22, background: ORANGE }} />
              <div style={{ width: 22, height: 22 }} />
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
            <span>Face</span>
            <span style={{ color: ORANGE }}>Finder</span>
          </div>
        </div>

        {/* headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 900, position: "relative" }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 88, fontWeight: 700, lineHeight: 1.02, letterSpacing: -3 }}>
            <span>Register a face.</span>
            <span style={{ display: "flex" }}>
              Find the person&nbsp;<span style={{ color: ORANGE }}>instantly.</span>
            </span>
          </div>
          <div style={{ fontSize: 30, color: MUTED, lineHeight: 1.35 }}>
            Face Recognition API with scoped keys, monthly quotas and audit logs built in.
          </div>
        </div>

        {/* footer stats */}
        <div style={{ display: "flex", gap: 48, fontSize: 24, color: MUTED }}>
          <div style={{ display: "flex", gap: 10 }}>
            <span style={{ color: NAVY, fontWeight: 700 }}>~400 ms</span>
            <span>search</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <span style={{ color: NAVY, fontWeight: 700 }}>512-d</span>
            <span>ArcFace embeddings</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <span style={{ color: NAVY, fontWeight: 700 }}>Free tier</span>
            <span>100 searches / month</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
