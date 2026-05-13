import { QRCodeCanvas } from "qrcode.react";

interface KuponTemplateProps {
  id: string;
  nomor_kupon: string | null;
  nama: string;
  kategori: string;
  qr_data: string | null;
  jenis_hewan?: "sapi" | "kambing" | null;
}

const detectJenisHewan = (nomor: string | null): "sapi" | "kambing" | null => {
  if (!nomor) return null;
  if (nomor.toUpperCase().startsWith("S")) return "sapi";
  if (nomor.toUpperCase().startsWith("K")) return "kambing";
  return null;
};

const KambingSVG = ({ color }: { color: string }) => (
  <svg width="70" height="55" viewBox="0 0 70 55" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="38" cy="30" rx="18" ry="13" fill={color} opacity="0.85" />
    <circle cx="22" cy="22" r="9" fill={color} opacity="0.9" />
    <ellipse cx="22" cy="18" rx="3" ry="6" fill={color} />
    <circle cx="20" cy="20" r="1.5" fill="#fff" />
    <circle cx="24" cy="20" r="1.5" fill="#fff" />
    <circle cx="20" cy="20" r="0.7" fill="#333" />
    <circle cx="24" cy="20" r="0.7" fill="#333" />
    <path d="M16 14 Q14 6 12 4" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M28 14 Q30 6 32 4" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    <rect x="30" y="40" width="3" height="10" rx="1" fill={color} opacity="0.8" />
    <rect x="38" y="40" width="3" height="10" rx="1" fill={color} opacity="0.8" />
    <rect x="44" y="40" width="3" height="10" rx="1" fill={color} opacity="0.8" />
    <rect x="50" y="40" width="3" height="10" rx="1" fill={color} opacity="0.8" />
    <path d="M56 30 Q62 30 60 28" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    <ellipse cx="22" cy="26" rx="2" ry="1.5" fill={color} opacity="0.7" />
  </svg>
);

const SapiSVG = ({ color }: { color: string }) => (
  <svg width="70" height="55" viewBox="0 0 70 55" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="38" cy="28" rx="20" ry="14" fill={color} opacity="0.85" />
    <circle cx="20" cy="20" r="10" fill={color} opacity="0.9" />
    <circle cx="17" cy="18" r="1.5" fill="#fff" />
    <circle cx="23" cy="18" r="1.5" fill="#fff" />
    <circle cx="17" cy="18" r="0.7" fill="#333" />
    <circle cx="23" cy="18" r="0.7" fill="#333" />
    <ellipse cx="20" cy="24" rx="4" ry="2.5" fill={color} opacity="0.6" />
    <path d="M10 14 Q6 8 4 10" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <path d="M30 14 Q34 8 36 10" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <circle cx="12" cy="12" r="3" fill={color} opacity="0.5" />
    <circle cx="28" cy="12" r="3" fill={color} opacity="0.5" />
    <rect x="28" y="38" width="4" height="12" rx="1.5" fill={color} opacity="0.8" />
    <rect x="36" y="38" width="4" height="12" rx="1.5" fill={color} opacity="0.8" />
    <rect x="44" y="38" width="4" height="12" rx="1.5" fill={color} opacity="0.8" />
    <rect x="52" y="38" width="4" height="12" rx="1.5" fill={color} opacity="0.8" />
    <path d="M58 28 Q66 30 64 26" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);

const THEMES = {
  kambing: { border: "#c8a96e", bg: "#fffdf5", accent: "#7a5c2e", animalColor: "#c8974e" },
  sapi: { border: "#5b8a5c", bg: "#f5fdf5", accent: "#2e5c30", animalColor: "#6b9b6b" },
  default: { border: "#999", bg: "#fafafa", accent: "#555", animalColor: "#888" },
};

const KuponTemplate = ({ id, nomor_kupon, nama, kategori, qr_data, jenis_hewan }: KuponTemplateProps) => {
  const detected = jenis_hewan ?? detectJenisHewan(nomor_kupon);
  const theme = detected ? THEMES[detected] : THEMES.default;

  return (
    <div
      id={`kupon-${id}`}
      style={{
        display: "none",
        width: "420px",
        height: "160px",
        padding: "10px 12px",
        border: `2px solid ${theme.border}`,
        borderRadius: "8px",
        fontFamily: "sans-serif",
        backgroundColor: theme.bg,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", height: "100%" }}>
        {/* Left area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingRight: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
            <span style={{ fontSize: "11px" }}>🕌</span>
            <span style={{ fontSize: "9px", color: theme.accent, fontWeight: 600 }}>
              Masjid At-Tauhid Pangkalpinang
            </span>
          </div>
          <div style={{ fontSize: "11px", fontWeight: "bold", color: "#1a1a1a", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            KUPON DAGING QURBAN
          </div>
          <div style={{ fontSize: "8px", color: "#888", marginBottom: "4px" }}>1447 H</div>
          <div style={{ height: "1.5px", background: theme.border, width: "40px", marginBottom: "5px", borderRadius: "1px" }} />
          <div style={{ fontFamily: "monospace", fontSize: "11px", fontWeight: "bold", color: theme.accent, marginBottom: "2px" }}>
            {nomor_kupon ?? "-"}
          </div>
          <div style={{ fontSize: "10px", color: "#333", marginBottom: "4px" }}>{nama}</div>
          <div>
            <span style={{
              display: "inline-block",
              background: "#f0f0f0",
              padding: "1px 6px",
              borderRadius: "3px",
              fontSize: "8px",
              color: "#555",
              textTransform: "capitalize",
            }}>
              {kategori?.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        {/* Separator */}
        <div style={{ width: "1px", background: theme.border, opacity: 0.4, margin: "4px 0" }} />

        {/* Right area */}
        <div style={{ width: "100px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingLeft: "10px" }}>
          {detected === "kambing" ? (
            <KambingSVG color={theme.animalColor} />
          ) : detected === "sapi" ? (
            <SapiSVG color={theme.animalColor} />
          ) : (
            <div style={{ width: "40px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>🐄</div>
          )}
          <div style={{ marginTop: "4px" }}>
            <QRCodeCanvas value={qr_data ?? nomor_kupon ?? id} size={65} level="M" includeMargin={false} style={{ display: "block" }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default KuponTemplate;
