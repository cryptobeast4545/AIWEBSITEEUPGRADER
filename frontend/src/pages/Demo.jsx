import { Link } from "react-router-dom";
import { useWidget } from "@/lib/useWidget";

const PRODUCTS = [
  ["https://images.unsplash.com/photo-1758910536889-43ce7b3199fd?crop=entropy&cs=srgb&fm=jpg&q=80&w=900", "Assorted Mithai Box", "₹649"],
  ["https://images.unsplash.com/photo-1760263217152-009971f0bccc?crop=entropy&cs=srgb&fm=jpg&q=80&w=900", "Fresh Jalebi (500g)", "₹220"],
  ["https://images.unsplash.com/photo-1649140041688-0f75446e707e?crop=entropy&cs=srgb&fm=jpg&q=80&w=900", "Festive Snack Platter", "₹899"],
];

/* Intentionally inaccessible demo store: missing alt, unlabeled inputs, div buttons, low contrast. */
export default function Demo() {
  useWidget("demo");
  return (
    <div style={{ background: "#fffaf0", color: "#3a2a1a", minHeight: "100vh", fontFamily: "Georgia, serif" }} data-testid="demo-page">
      <div style={{ background: "#0B0F19", color: "#fff", padding: "10px 20px", fontFamily: "sans-serif", fontSize: 14, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
        <span><b>AccessLayer demo:</b> this store is deliberately broken. Click the green button bottom-right (or press Alt+A).</span>
        <Link to="/" style={{ color: "#34D399" }} data-testid="demo-back-link">← Back to AccessLayer</Link>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 32px", borderBottom: "1px solid #eadfcf" }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: "#b45309" }}>Sharma Sweets</div>
        <div style={{ display: "flex", gap: 20 }}>
          <a href="#shop" style={{ color: "#c9b8a0" }}>Shop</a>
          <a href="#about" style={{ color: "#c9b8a0" }}>About</a>
          <a href="#contact" style={{ color: "#c9b8a0" }}>Contact</a>
          <a href="#cart"><svg width="22" height="22" viewBox="0 0 24 24"><path d="M3 3h2l2 12h11l2-8H7" stroke="#b45309" strokeWidth="2" fill="none" /></svg></a>
        </div>
      </div>
      <div style={{ padding: "48px 32px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ fontSize: 44, fontWeight: 700 }}>Diwali specials are here</div>
        <p style={{ color: "#d8c9b4", fontSize: 18, maxWidth: 560 }}>Hand-made in Jaipur since 1962. Order before 5pm for same-day delivery across the city.</p>
        <div id="shop" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 24, marginTop: 36 }}>
          {PRODUCTS.map(([src, name, price]) => (
            <div key={name} style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 6px 24px rgba(0,0,0,.06)" }}>
              <img src={src} style={{ width: "100%", height: 220, objectFit: "cover" }} crossOrigin="anonymous" />
              <div style={{ padding: 18 }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{name}</div>
                <div style={{ color: "#cdbb9f", margin: "6px 0 14px" }}>{price}</div>
                <div onClick={() => alert(`${name} added to cart`)} style={{ background: "#f6c56f", color: "#fff", padding: "10px 16px", borderRadius: 10, display: "inline-block", cursor: "pointer" }}>Add to cart</div>
              </div>
            </div>
          ))}
        </div>
        <div id="about" style={{ marginTop: 56, fontSize: 26, fontWeight: 700 }}>Our story</div>
        <p style={{ lineHeight: 1.4, maxWidth: 720 }}>Three generations of halwais have perfected recipes for kaju katli, motichoor laddoo and rasmalai. We use pure desi ghee, saffron from Kashmir and no artificial colours.</p>
        <div id="contact" style={{ marginTop: 48, background: "#fff", padding: 28, borderRadius: 16, maxWidth: 520 }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 14 }}>Bulk order enquiry</div>
          <input placeholder="Your name" style={{ display: "block", width: "100%", padding: 12, marginBottom: 10, border: "1px solid #eee", borderRadius: 8 }} />
          <input placeholder="Phone number" name="phone" style={{ display: "block", width: "100%", padding: 12, marginBottom: 10, border: "1px solid #eee", borderRadius: 8 }} />
          <textarea placeholder="What would you like?" style={{ display: "block", width: "100%", padding: 12, marginBottom: 14, border: "1px solid #eee", borderRadius: 8 }} />
          <div onClick={() => alert("Enquiry sent!")} style={{ background: "#b45309", color: "#fff", padding: "12px 20px", borderRadius: 10, display: "inline-block", cursor: "pointer" }}>Send enquiry</div>
        </div>
      </div>
      <div style={{ padding: 32, color: "#d8c9b4", borderTop: "1px solid #eadfcf", textAlign: "center" }}>© Sharma Sweets, Johari Bazaar, Jaipur</div>
    </div>
  );
}
