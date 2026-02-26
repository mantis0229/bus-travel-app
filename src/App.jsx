import { useState, useEffect, useRef } from "react";
import { searchBus, getBusStops } from "./api";

const COLORS = ["#FF6B35", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD"];

const RouteCard = ({ segment, index, onRemove, color }) => {
  return (
    <div style={{ background: "rgba(255,255,255,0.05)", border: `2px solid ${color}`, borderRadius: 16, padding: "20px 24px", position: "relative", backdropFilter: "blur(10px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, color: "#000" }}>{index + 1}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{segment.bus ? `${segment.bus.number}번 버스` : "버스 선택 필요"}</div>
          {segment.bus && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{segment.bus.name}</div>}
        </div>
        {onRemove && (
          <button onClick={onRemove} style={{ background: "rgba(255,100,100,0.2)", border: "1px solid rgba(255,100,100,0.4)", borderRadius: 8, padding: "4px 10px", color: "#ff8080", cursor: "pointer", fontSize: 13 }}>제거</button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>출발 정류장</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: segment.from ? color : "rgba(255,255,255,0.3)" }}>{segment.from || "—"}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>도착 정류장</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: segment.to ? color : "rgba(255,255,255,0.3)" }}>{segment.to || "—"}</div>
        </div>
      </div>
    </div>
  );
};

const MapView = ({ segments }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!window.kakao || !mapRef.current) return;
    window.kakao.maps.load(() => {
      const container = mapRef.current;
      const options = {
        center: new window.kakao.maps.LatLng(35.1595, 126.8526),
        level: 8,
      };
      mapInstanceRef.current = new window.kakao.maps.Map(container, options);
    });
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.kakao) return;
    const completed = segments.filter(s => s.bus && s.from && s.to);
    if (completed.length === 0) return;

    completed.forEach(async (seg, i) => {
      const color = COLORS[i % COLORS.length];
      try {
        const res = await fetch("/.netlify/functions/route", {
          method: "POST",
          body: JSON.stringify({ origin: seg.from, destination: seg.to })
        });
        const data = await res.json();
        if (!data.routeData || !data.routeData.routes) return;
        const route = data.routeData.routes[0];
        const path = [];
        route.sections[0].roads.forEach(road => {
          for (let j = 0; j < road.vertexes.length; j += 2) {
            path.push(new window.kakao.maps.LatLng(road.vertexes[j + 1], road.vertexes[j]));
          }
        });
        const polyline = new window.kakao.maps.Polyline({
          path,
          strokeWeight: 5,
          strokeColor: color,
          strokeOpacity: 0.9,
          strokeStyle: "solid",
        });
        polyline.setMap(mapInstanceRef.current);
        new window.kakao.maps.Marker({
          position: new window.kakao.maps.LatLng(data.originCoord.y, data.originCoord.x),
          map: mapInstanceRef.current
        });
        new window.kakao.maps.Marker({
          position: new window.kakao.maps.LatLng(data.destCoord.y, data.destCoord.x),
          map: mapInstanceRef.current
        });
        mapInstanceRef.current.setCenter(
          new window.kakao.maps.LatLng(data.originCoord.y, data.originCoord.x)
        );
      } catch (e) {
        console.error("경로 조회 실패:", e);
      }
    });
  }, [segments]);

  return (
    <div style={{ borderRadius: 20, overflow: "hidden", position: "relative", height: "100%", minHeight: 400 }}>
      <div ref={mapRef} style={{ width: "100%", height: 400 }} />
      {segments.filter(s => s.bus && s.from && s.to).length > 0 && (
        <div style={{ position: "absolute", bottom: 16, left: 16, background: "rgba(0,0,0,0.7)", borderRadius: 12, padding: "10px 14px", backdropFilter: "blur(10px)" }}>
          {segments.filter(s => s.bus && s.from && s.to).map((seg, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: i < segments.length - 1 ? 6 : 0 }}>
              <div style={{ width: 20, height: 4, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
              <span style={{ fontSize: 12, color: "#fff" }}>{seg.bus?.number}번 · {seg.from} → {seg.to}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const EditModal = ({ segment, segIndex, onSave, onClose }) => {
  const [search, setSearch] = useState("");
  const [busResults, setBusResults] = useState([]);
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(segment.bus ? 2 : 1);
  const [draft, setDraft] = useState({ ...segment });

  const handleSearch = async (keyword) => {
    setSearch(keyword);
    if (keyword.length < 1) { setBusResults([]); return; }
    setLoading(true);
    const results = await searchBus(keyword);
    setBusResults(results);
    setLoading(false);
  };

  const handleBusSelect = async (bus) => {
    setLoading(true);
    const stopList = await getBusStops(bus.number);
    setStops(stopList);
    setDraft({ ...draft, bus, from: "", to: "" });
    setLoading(false);
    setStep(2);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div style={{ background: "#111827", borderRadius: 24, width: "100%", maxWidth: 500, padding: 28, border: "1px solid rgba(255,255,255,0.1)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>구간 {segIndex + 1} 설정</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{step === 1 ? "버스 선택" : "정류장 선택"}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {["버스", "정류장"].map((label, i) => (
            <div key={i} onClick={() => { if (step > i + 1) setStep(i + 1); }} style={{ flex: 1, padding: "8px 0", textAlign: "center", borderRadius: 10, fontSize: 13, fontWeight: 600, background: step === i + 1 ? COLORS[segIndex % COLORS.length] : "rgba(255,255,255,0.06)", color: step === i + 1 ? "#000" : step > i + 1 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)", cursor: step > i + 1 ? "pointer" : "default" }}>{step > i + 1 ? "✓ " : ""}{label}</div>
          ))}
        </div>

        {step === 1 && (
          <div>
            <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="버스 번호 검색 (예: 좌석02, 순환01...)" style={{ width: "100%", padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 15, outline: "none", boxSizing: "border-box", marginBottom: 14 }} />
            {loading && <div style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", padding: 20 }}>검색 중...</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {busResults.map(bus => (
                <button key={bus.number} onClick={() => handleBusSelect(bus)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "14px 18px", cursor: "pointer", textAlign: "left", color: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 18, fontWeight: 800 }}>{bus.number}번</span>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{bus.name}</span>
                  </div>
                </button>
              ))}
              {!loading && search.length > 0 && busResults.length === 0 && (
                <div style={{ color: "rgba(255,255,255,0.3)", textAlign: "center", padding: 20 }}>검색 결과가 없어요</div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            {loading && <div style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", padding: 20 }}>정류장 불러오는 중...</div>}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>출발 정류장</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {stops.map(stop => (
                  <button key={stop} onClick={() => setDraft({ ...draft, from: stop, to: "" })} style={{ padding: "8px 14px", borderRadius: 20, cursor: "pointer", fontSize: 13, background: draft.from === stop ? COLORS[segIndex % COLORS.length] : "rgba(255,255,255,0.07)", border: `1px solid ${draft.from === stop ? COLORS[segIndex % COLORS.length] : "rgba(255,255,255,0.12)"}`, color: draft.from === stop ? "#000" : "#fff", fontWeight: draft.from === stop ? 700 : 400 }}>{stop}</button>
                ))}
              </div>
            </div>
            {draft.from && (
              <div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>도착 정류장</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {stops.filter((s, i) => i > stops.indexOf(draft.from)).map(stop => (
                    <button key={stop} onClick={() => setDraft({ ...draft, to: stop })} style={{ padding: "8px 14px", borderRadius: 20, cursor: "pointer", fontSize: 13, background: draft.to === stop ? COLORS[segIndex % COLORS.length] : "rgba(255,255,255,0.07)", border: `1px solid ${draft.to === stop ? COLORS[segIndex % COLORS.length] : "rgba(255,255,255,0.12)"}`, color: draft.to === stop ? "#000" : "#fff", fontWeight: draft.to === stop ? 700 : 400 }}>{stop}</button>
                  ))}
                </div>
              </div>
            )}
            {draft.from && draft.to && (
              <button onClick={() => onSave(draft)} style={{ marginTop: 20, width: "100%", padding: "14px 0", background: COLORS[segIndex % COLORS.length], borderRadius: 12, border: "none", color: "#000", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>구간 저장 ✓</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [segments, setSegments] = useState([{ bus: null, from: "", to: "" }]);
  const [editing, setEditing] = useState(null);

  const addSegment = () => { setSegments([...segments, { bus: null, from: "", to: "" }]); setEditing(segments.length); };
  const removeSegment = (i) => setSegments(segments.filter((_, idx) => idx !== i));
  const saveSegment = (i, data) => { const updated = [...segments]; updated[i] = data; setSegments(updated); setEditing(null); };
  const completedCount = segments.filter(s => s.bus && s.from && s.to).length;

  return (
    <div style={{ minHeight: "100vh", background: "#060d1a", fontFamily: "'Noto Sans KR', 'Malgun Gothic', sans-serif", color: "#fff", padding: "0 0 40px 0" }}>
      <div style={{ background: "linear-gradient(135deg, #0d1f3c 0%, #0a1628 100%)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "20px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>🚌 광주 버스 여행 플래너</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>광주 · 화순 · 담양 · 나주 버스 여행 루트</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "8px 16px", fontSize: 14, color: "rgba(255,255,255,0.6)" }}>{completedCount}/{segments.length} 구간 완성</div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 24px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 14, textTransform: "uppercase", letterSpacing: 1 }}>내 루트</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {segments.map((seg, i) => (
                <div key={i}>
                  {i > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>환승</div>
                      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                    </div>
                  )}
                  <div onClick={() => setEditing(i)} style={{ cursor: "pointer" }}>
                    <RouteCard segment={seg} index={i} color={COLORS[i % COLORS.length]} onRemove={segments.length > 1 ? (e) => { e.stopPropagation(); removeSegment(i); } : null} />
                  </div>
                </div>
              ))}
              <button onClick={addSegment} style={{ padding: "14px 0", borderRadius: 16, border: "2px dashed rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>+</span> 환승 구간 추가
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1 }}>경로 지도</div>
            <MapView segments={segments} />
            {completedCount > 0 && (
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5 }}>루트 요약</div>
                {segments.filter(s => s.bus && s.from && s.to).map((seg, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: COLORS[i % COLORS.length], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#000", flexShrink: 0 }}>{seg.bus?.number}</div>
                    <div style={{ fontSize: 14, color: "#fff" }}>{seg.from} <span style={{ color: COLORS[i % COLORS.length] }}>→</span> {seg.to}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {editing !== null && (
        <EditModal segment={segments[editing]} segIndex={editing} onSave={(data) => saveSegment(editing, data)} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}