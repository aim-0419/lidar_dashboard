import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Save, X } from 'lucide-react';

export default function RoiEditor({ camera, onClose }) {
  const [rois, setRois] = useState([]);
  const [selected, setSelected] = useState(0);
  const [image, setImage] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [streamError, setStreamError] = useState('');
  const [aspect, setAspect] = useState(16/9);
  const svg = useRef(null);
  const drag = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    let url, timer;
    async function refreshFrame() {
      try {
        const response = await fetch(`/vision-test-api/frame.jpg?raw=1&camera=${camera}`, { signal:controller.signal });
        if (!response.ok) throw new Error();
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        const next = URL.createObjectURL(blob);
        const previous = url;
        url = next;
        setImage(next); setStreamError('');
        if (previous) URL.revokeObjectURL(previous);
      } catch {
        if (!controller.signal.aborted) { setStreamError('영상 연결 대기 중'); setImage(''); }
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refreshFrame, 200);
      }
    }
    async function load() {
      try {
        const response = await fetch(`/vision-test-api/cameras/${camera}/rois`, { signal: controller.signal });
        if (!response.ok) throw new Error();
        const settings = await response.json();
        if (controller.signal.aborted) return;
        setRois(settings.rois);
        setReady(true);
      } catch {
        if (!controller.signal.aborted) setError('영상과 설정을 불러오지 못했습니다. 닫은 후 다시 시도하세요.');
      }
    }
    load();
    refreshFrame();
    return () => { controller.abort(); clearTimeout(timer); if (url) URL.revokeObjectURL(url); };
  }, [camera]);
  const roi = rois[selected];
  const center = roi ? roi.polygon.reduce((a,p) => [a[0]+p[0]/roi.polygon.length,a[1]+p[1]/roi.polygon.length], [0,0]) : [0,0];
  function change(update) {
    setRois(old => old.map((r,i) => i === selected ? { ...r, ...update } : r));
  }
  function move(event) {
    if (!drag.current || !roi || busy) return;
    const rect = svg.current.getBoundingClientRect();
    const p = [Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))];
    if (drag.current.kind === 'direction') change({ direction: [p[0]-center[0],p[1]-center[1]] });
    else change({ polygon: roi.polygon.map((v,i) => i === drag.current.index ? p : v) });
  }
  async function save() {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/vision-test-api/cameras/${camera}/rois`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rois }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '저장에 실패했습니다.');
      onClose();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function defaults() {
    try {
      const response = await fetch('/vision-test-api/reference-rois');
      if (!response.ok) throw new Error();
      setRois((await response.json()).rois); setSelected(0);
    } catch { setError('예시 설정을 불러오지 못했습니다.'); }
  }
  return <div className="roi-editor" role="dialog" aria-modal="true" aria-label="ROI 편집">
    <h2>{camera} · ROI 편집</h2>
    {error && <p role="alert">{error}</p>}
    {streamError && <p role="status">{streamError}</p>}
    <div className="vision-controls">
      <select aria-label="편집할 영역" disabled={!ready || busy} value={roi ? selected : ''} onChange={e => setSelected(Number(e.target.value))}>
        {!rois.length && <option value="">영역 없음</option>}
        {rois.map((r,i) => <option key={i} value={i}>{r.name}</option>)}
      </select>
      <button title="영역 추가" aria-label="영역 추가" disabled={!ready || busy || rois.length >= 16} onClick={() => {
        setSelected(rois.length); setRois([...rois,{ name: `ROI-${Date.now()}`, polygon: [[.3,.3],[.6,.3],[.6,.6],[.3,.6]], direction: [.15,0] }]);
      }}><Plus size={18}/></button>
      <button title="영역 삭제" aria-label="영역 삭제" disabled={!roi || busy} onClick={() => { setRois(rois.filter((_,i) => i !== selected)); setSelected(0); }}><Trash2 size={18}/></button>
      <button disabled={!ready || busy} onClick={defaults}>SC10 예시 불러오기</button>
      <button disabled={!ready || busy} onClick={save}><Save size={18}/>저장 및 적용</button>
      <button disabled={busy} onClick={onClose}><X size={18}/>취소</button>
    </div>
    {roi && <label>영역 이름 <input maxLength={40} disabled={busy} value={roi.name} onChange={e => change({ name:e.target.value })}/></label>}
    <div className="roi-stage" style={{aspectRatio:aspect}}>
      {image && <img src={image} alt="ROI 편집용 실시간 영상" onLoad={e => setAspect(e.currentTarget.naturalWidth/e.currentTarget.naturalHeight)}/>}
      <svg ref={svg} viewBox="0 0 1000 1000" preserveAspectRatio="none" onPointerMove={move} onPointerUp={() => { drag.current=null; }} onPointerCancel={() => { drag.current=null; }}>
        <defs><marker id="roi-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#16a34a"/></marker></defs>
        {rois.map((r,i) => <polygon key={i} points={r.polygon.map(p => p.map(v => v*1000).join(',')).join(' ')} fill={i === selected ? '#2563eb33' : '#2563eb11'} stroke="#2563eb" strokeWidth="3" onClick={() => !busy && setSelected(i)}/>)}
        {roi && <>
          <line x1={center[0]*1000} y1={center[1]*1000} x2={(center[0]+roi.direction[0])*1000} y2={(center[1]+roi.direction[1])*1000} stroke="#16a34a" strokeWidth="4" markerEnd="url(#roi-arrow)"/>
          {roi.polygon.map((p,i) => <circle key={i} cx={p[0]*1000} cy={p[1]*1000} r="9" fill="white" stroke="#2563eb" strokeWidth="3" onPointerDown={e => { if(busy)return; e.currentTarget.setPointerCapture(e.pointerId); drag.current={kind:'vertex',index:i}; }}/>)}
          <circle cx={(center[0]+roi.direction[0])*1000} cy={(center[1]+roi.direction[1])*1000} r="12" fill="#16a34a" onPointerDown={e => { if(busy)return; e.currentTarget.setPointerCapture(e.pointerId); drag.current={kind:'direction'}; }}/>
        </>}
      </svg>
    </div>
  </div>;
}
