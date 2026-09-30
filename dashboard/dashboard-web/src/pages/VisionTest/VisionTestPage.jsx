import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import './visionTest.css';
import RoiEditor from './RoiEditor';
import CameraSource from './CameraSource';

const labels = { NORMAL: '정상 / 판정 대기', WRONG_WAY_CANDIDATE: '역주행 후보', WRONG_WAY: '역주행 감지' };

export default function VisionTestPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    async function poll() {
      try {
        const response = await fetch('/vision-test-api/state', { signal: controller.signal });
        if (!response.ok) throw new Error();
        setData(await response.json());
        setError('');
      } catch {
        if (!controller.signal.aborted) setError('비전 테스트 서비스에 연결할 수 없습니다.');
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(poll, 300);
      }
    }
    poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);
  async function restart(direction, camera = data?.camera || 'camera-1') {
    setBusy(true);
    setSubmitError('');
    try {
      const response = await fetch('/vision-test-api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction, camera }),
      });
      if (!response.ok) throw new Error();
      setData(previous => previous ? { ...previous, camera, frame:0 } : previous);
    } catch { setSubmitError('테스트 설정을 적용하지 못했습니다.'); }
    finally { setBusy(false); }
  }
  return <section className="vision-test">
    <header><h1>비전 역주행 감지</h1><p>SC10 회전교차로 · YOLO11s + ByteTrack</p></header>
    <div className="vision-controls">
      <label>카메라<select disabled={busy || !data || editing} value={data?.camera || 'camera-1'} onChange={e => restart('normal', e.target.value)}>
        {Array.from({length:6},(_,i) => <option key={i} value={`camera-${i+1}`}>카메라 {i+1}</option>)}
      </select></label>
      <button disabled={busy || !data?.frame || editing} onClick={() => setEditing(true)}>ROI 편집</button>
      <span>카메라별 독립 영상 설정</span>
      <div role="group" aria-label="방향 기준">
        <button aria-pressed={data?.direction === 'normal'} disabled={busy || !data} onClick={() => restart('normal')}>정상 방향</button>
        <button aria-pressed={data?.direction === 'reverse'} disabled={busy || !data} onClick={() => restart('reverse')}>역방향</button>
      </div>
      <button title="처음부터 다시 재생" aria-label="처음부터 다시 재생" disabled={busy || !data} onClick={() => restart(data.direction)}><RotateCcw size={18} /></button>
      <span>{data?.active_direction ? (data.active_direction === 'reverse' ? '역방향 기준' : '정상 방향 기준') : '영상 준비 중'}</span>
      <span>{data?.video_seconds ?? 0}초</span>
    </div>
    <CameraSource key={data?.camera || 'camera-1'} camera={data?.camera || 'camera-1'} disabled={busy || editing || !data} onSaved={() => setData(previous => previous ? { ...previous, frame:0 } : previous)}/>
    {editing && <RoiEditor camera={data?.camera || 'camera-1'} onClose={() => setEditing(false)}/>}
    {(error || submitError || data?.error) && <p role="alert">{error || submitError || data.error}</p>}
    <div className="vision-image">{data?.frame > 0 && !error && !data.error
      ? <img src={`/vision-test-api/frame.jpg?v=${data.generation}-${data.frame}`} alt="차량 탐지 박스, 이동 궤적 및 구역별 역주행 감지 영상" />
      : <p>영상 연결 대기</p>}</div>
    <div className="vision-grid">
      <div><h2>현재 감지 객체</h2><table><thead><tr><th>ID</th><th>구역</th><th>상태</th></tr></thead>
        <tbody>{data?.tracks.map(t => <tr key={t.id}><td>{t.id}</td><td>{t.roi || '구역 밖'}</td><td>{labels[t.state]}</td></tr>)}</tbody>
      </table></div>
      <div><h2>역주행 감지 이력</h2><table><thead><tr><th>영상 시점(초)</th><th>ID</th><th>구역</th></tr></thead>
        <tbody>{data?.events.map((event, i) => <tr key={`${event.time}-${i}`}><td>{event.time}</td><td>{event.id}</td><td>{event.roi}</td></tr>)}</tbody>
      </table></div>
    </div>
  </section>;
}
