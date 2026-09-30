import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';

export default function CameraSource({ camera, disabled, onSaved }) {
  const [mode, setMode] = useState('test');
  const [url, setUrl] = useState('');
  const [configured, setConfigured] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/vision-test-api/cameras/${camera}/source`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(value => { setMode(value.mode); setConfigured(value.configured); setReady(true); })
      .catch(() => { if (!controller.signal.aborted) setError('영상 설정을 불러오지 못했습니다.'); });
    return () => controller.abort();
  }, [camera]);
  async function save() {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/vision-test-api/cameras/${camera}/source`, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ mode, ...(url.trim() ? {url:url.trim()} : {}) }),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || '저장 실패');
      setConfigured(value.configured); setUrl(''); onSaved();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <section aria-label="카메라 영상 설정">
    <div className="vision-controls">
      <label>영상 입력<select disabled={!ready || disabled || busy} value={mode} onChange={e => setMode(e.target.value)}>
        <option value="test">테스트 영상</option><option value="rtsp">RTSP 카메라</option>
      </select></label>
      <label>RTSP 주소<input type="password" autoComplete="new-password" spellCheck={false}
        disabled={!ready || disabled || busy} value={url} onChange={e => setUrl(e.target.value)}
        placeholder={configured ? '저장됨 · 변경할 때만 입력' : 'rtsp://카메라주소/경로'}/></label>
      <button disabled={!ready || disabled || busy || (mode === 'rtsp' && !configured && !url.trim())} onClick={save}><Save size={16}/>영상 설정 저장</button>
    </div>
    {error && <p role="alert">{error}</p>}
  </section>;
}
