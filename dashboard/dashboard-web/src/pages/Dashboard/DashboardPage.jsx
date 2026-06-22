// /src/pages/Dashboard/Dashboard.jsx
import { useState, useEffect, useRef } from "react";
import { Card } from "../../shared/components/Card";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Calendar,
  Activity,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Megaphone,
  Siren,
  AlertTriangle,
  X,
} from "lucide-react";

// ------------------------------
// DachboardPage Component
// ------------------------------
// 메인 대시보드 화면을 담당한다.
// 서버 상태, KPI, WebSocket 알림, 차단기/VMS 제어 UI를 한 화면에서 보여준다.
// 현재는 화면 로직이 큰 파일에 모여 있으므로 이후 dashboard/wrongway feature로 점진 분리한다.
export default function DashboardPage({
  onNavigateToEvent,
  onNavigateToVehiclesPassed,
  onNavigateToTotalVehicles,
  onNavigateToUnidentified,
}) {
  const [activeAlert, setActiveAlert] = useState(null); // 긴급 팝업 데이터
  const [alertsEnabled, setAlertsEnabled] = useState(true); // 팝업 허용 토글(ON/OFF)
  const [vmsText, setVmsText] = useState(""); // 전광판 입력
  const [recentLogs, setRecentLogs] = useState([ // 최근 로그 목록
    { msg: "차량 진출로 B 통과", time: "10:42" },
    { msg: "LIDAR_01 동기화 정상", time: "10:41" },
    { msg: "차단기 A 열림", time: "10:38" },
  ]);
  
  const [serverAlive, setServerAlive] = useState(false); // 서버 alive 표시 => /api/health
  const [kpi, setKpi] = useState({ 
    todaysEvents: 0, 
    vehiclesPassed: 0, 
    wrongWayEvents: 0, 
    unidentified: 0 
  }); 

  // kpi 페이지 이동 함수
  const navigate = useNavigate();
  const goEvents = (tab) => navigate(`/events?tab=${tab}`);

  // websocket onmessage의 항상 최신값 유지
  const alertsEnabledRef = useRef(alertsEnabled); 
  useEffect(() => {
    alertsEnabledRef.current = alertsEnabled;
  }, [alertsEnabled]);

  // 팝업 버튼 핸들러
  const handleDismissAlert = () => {
    setActiveAlert(null);
  }; 


  const handleViewAlert = () => { // 즉시 조치화면 보기 -> 추후 구현
    if (activeAlert?.type === "wrong-way" && onNavigateToTotalVehicles) {
      onNavigateToTotalVehicles();
    } else if (activeAlert?.type === "unidentified" && onNavigateToUnidentified) {
      onNavigateToUnidentified();
    }
    setActiveAlert(null);
  };

  const MAX_RECENT_LOGS = 5;

  const pushLog = (msg) => {
    const t = new Date().toLocaleTimeString([], {
      hour: "2-digit", 
      minute: "2-digit"
    });
    setRecentLogs((prev)=> [
      {msg, time:t}, 
      ...prev]);
  };

  // demo start-end 지점
  const videoRef = useRef(null);
  const camVideoRef = useRef(null); 
  const DEMO_START_SEC = 0; // 시작 시점
  const DEMO_END_SEC = 36.5; // 종료 시점
  const CAMERA_VIDEO_SRC = "/wrongway_test.mp4";

  // YOLO 감지 서버 상태
  const API_HOST = import.meta.env.VITE_API_HOST || "localhost";
  const API_PORT = import.meta.env.VITE_API_PORT || "5000";
  const DETECTOR_HOST = import.meta.env.VITE_DETECTOR_HOST || API_HOST;
  const DETECTOR_PORT = import.meta.env.VITE_DETECTOR_PORT || "8888";
  const API_BASE = import.meta.env.VITE_API_BASE_URL || `http://${API_HOST}:${API_PORT}`;
  const WS_URL = import.meta.env.VITE_WS_BASE_URL || `ws://${API_HOST}:${API_PORT}`;
  const DETECTOR_BASE = import.meta.env.VITE_DETECTOR_BASE_URL || `http://${DETECTOR_HOST}:${DETECTOR_PORT}`;
  const [detectorAlive, setDetectorAlive] = useState(false);

  useEffect(() => {
    let timer;
    const pingDetector = async () => {
      try {
        const res = await fetch(`${DETECTOR_BASE}/health`, { cache: "no-store" });
        setDetectorAlive(res.ok);
      } catch {
        setDetectorAlive(false);
      }
    };
    pingDetector();
    timer = setInterval(pingDetector, 3000);
    return () => clearInterval(timer);
  }, []);
  //

  const handleVideoLoad = (e) => {
    e.target.currentTime = DEMO_START_SEC;
  };

  //
  const handleDemoTimeUpdate = () => {
    const v = videoRef.current;
    const v2 = camVideoRef.current;
    
    // 메인 리플레이 영상(라이다) 기준 종료 처리
    if (v && v.currentTime >= DEMO_END_SEC) {
      v.pause();
      v.currentTime = DEMO_START_SEC;
      
      if (v2) {
        v2.pause();
        v2.currentTime = DEMO_START_SEC;
      }
      pushLog("Demo 영상 종료");
    }
  };
  //

  // ------------------------------
  // /api/demo/start
  // ------------------------------
  const startDemo = async () => {
    try {
      pushLog("Demo START 요청");

      // demo 영상 (라이다 & 카메라 동기화)
      const v = videoRef.current;
      const v2 = camVideoRef.current;

      if(v) {
        v.pause();
        v.currentTime = DEMO_START_SEC;
        v.play().catch(()=>{});
      }
      if(v2) {
        v2.pause();
        v2.currentTime = DEMO_START_SEC;
        v2.play().catch(()=>{});
      }

      const r = await fetch(`${API_BASE}/api/demo/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), 
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) throw new Error(data.error || "start failed");
      pushLog("Demo START 성공");
    } catch (e) {
      pushLog(`Demo START 실패: ${String(e.message || e)}`);
    }
  };

  const resetDemo = async () => {
  try {
    pushLog("Demo RESET 요청");

    const r = await fetch(`${API_BASE}/api/demo/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) throw new Error(data.error || "reset failed");

    setActiveAlert(null); // 떠 있던 팝업 닫기
    pushLog("Demo RESET 성공");
  } catch (e) {
    pushLog(`Demo RESET 실패: ${String(e.message || e)}`);
  }
};
  
  // ------------------------------
  // 전광판 차단기 ui용 함수
  // ------------------------------
  const sendVms = () => {
    const text = vmsText.trim();
    if(!text) return;
    pushLog(`전광판 송신: ${text}`);
    setVmsText("");
  };

  const quickVms = (text) => {
    setVmsText(text);
    pushLog(`전광판 문구 선택: ${text}`);
  };

  const openGate = () => pushLog("차단기 열기 요청");
  const closeGate = () => pushLog("차단기 닫기 요청");

  // ------------------------------
  // websocket 수신 로직
  // ------------------------------
  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => pushLog("WS연결됨");
    ws.onclose = () => pushLog("WS 연결 종료");
    ws.onerror = () => pushLog("WS 에러");

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
    

        //Logs/state는 원하면 반영
        if(msg.type === "log" && msg.payload?.msg) {
          setRecentLogs((prev) => [{ msg: msg.payload.msg, time: msg.payload.time || "" }, ...prev].slice(0, 10));
        }
        if (msg.type === "logs" && Array.isArray(msg.payload)) {
        setRecentLogs(msg.payload.slice(0, 10));
      }

      if (msg.type === "state" && msg.payload) {
        setKpi(msg.payload);
      }

      // 팝업은 wrong-way만, 토글 on일 때만
      if(msg.type === "alert") {
        const alert = msg.payload;

        //토글 off면 팝업 금지, 로그만
        if (!alertsEnabledRef.current) {
          if (alert?.subMessage) {
            setRecentLogs((prev) => [{ msg: `(Muted) ${alert.subMessage}`, time:alert.timestamp || "" }, ...prev].slice(0, 10));
          }
          return;
        }

       if (alert?.type === "wrong-way") {
          setActiveAlert(alert); // 여기서 팝업 뜸
        } else {
          // 다른 타입은 로그만
          if (alert?.subMessage) {
            setRecentLogs((prev) => [{ msg: alert.subMessage, time: alert.timestamp || "" }, ...prev].slice(0, 10));
          }
        }
      }
    } catch {
      // ignore
    }
  };

  return () => ws.close();
}, []);

  // ------------------------------
  // stage별 스타일 함수 
  // ------------------------------
  const isCritical = Number(activeAlert?.stage) === 2;

  const alertTheme = isCritical
    ? {
        header: "bg-red-600",
        primaryBtn: "bg-red-600 hover:bg-red-700 focus:ring-red-300",
        stageTitle: "2nd Alert: Wrong-way Detection",
        statusText: "DANGER",
        stageLabel: "역주행 위험 단계",
      }
    : {
        header: "bg-amber-500",
        primaryBtn: "bg-orange-600 hover:bg-orange-700 focus:ring-orange-300",
        stageTitle: "1st Alert: Wrong-way Detection",
        statusText: "WARNING",
        stageLabel: "역주행 경고 단계",
      };


  // ------------------------------
  // 헬스체크
  // ------------------------------
  useEffect(() => {
    let timer;

    const ping = async ()=>{
      try {
        const res = await fetch(`${API_BASE}/api/health`, { cache: "no-store"}); 
        setServerAlive(res.ok);
      }catch {
        setServerAlive(false);
      }
    };

    ping();
    timer=setInterval(ping, 3000); //3초마다
    return () => clearInterval(timer);
  }, []);


  return (
    <div className="p-6 space-y-6 bg-white min-h-screen relative">
      {/* 실시간 알림 오버레이 */}
      {activeAlert && (
      <div
        key={activeAlert.id}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      >
        <div className="relative w-full max-w-[360px] overflow-hidden rounded-md bg-white shadow-2xl animate-in zoom-in-95 duration-300">
          <div className={`${alertTheme.header} relative px-5 py-3 text-center`}>
            <h2 className="text-lg font-black leading-6 text-white">{alertTheme.statusText}</h2>
            <button
              onClick={handleDismissAlert}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-white/80 transition-colors hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/70"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 pb-5 pt-4">
            <div className="mb-3 flex items-start gap-2">
              <Siren className={`mt-0.5 h-4 w-4 shrink-0 ${isCritical ? "text-red-600" : "text-amber-600"}`} />
              <div>
                <h3 className="text-base font-black leading-5 text-gray-900">{alertTheme.stageTitle}</h3>
                <p className="mt-1 text-xs font-semibold text-gray-500">{alertTheme.stageLabel}</p>
              </div>
            </div>

            <div className="mb-3 aspect-[16/9] overflow-hidden border border-gray-200 bg-gray-100" aria-label="실시간 영상 영역" />

            <div className="mb-4 space-y-1 text-sm font-bold text-gray-900">
              <p>
                Location:{" "}
                <span className="font-semibold text-gray-700">
                  {activeAlert.zone_id || "Zone A - Tunnel Entrance"}
                </span>
              </p>
              <p>
                Time:{" "}
                <span className="font-semibold text-gray-700">
                  {activeAlert.timestamp || "실시간"}
                </span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleDismissAlert}
                className="rounded-md border border-gray-200 bg-white px-4 py-3 text-sm font-black text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                무시
              </button>
              <button
                onClick={handleViewAlert}
                className={`rounded-md px-4 py-3 text-sm font-black text-white shadow-sm transition-colors focus:outline-none focus:ring-2 ${alertTheme.primaryBtn}`}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

      {/* 상단 헤더 */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-mono tracking-tight">
            역주행 방지 실시간 관제 대시보드
          </h1>
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              현장-01
            </span>
            <span className="text-gray-300">•</span>
            <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              LIDAR-01
            </span>
          </div>
        </div>

      <div className="flex items-center gap-3">
        {/* ✅ 서버 상태 점 */}
        <div className="flex items-center gap-2 bg-gray-100 border border-gray-300 rounded px-3 h-10">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              serverAlive ? "bg-green-500" : "bg-red-500"
            }`}
            title={serverAlive ? "SERVER OK" : "SERVER DOWN"}
          />
          <span className="font-mono text-xs text-gray-600">
            {serverAlive ? "SERVER" : "OFFLINE"}
          </span>
        </div>
          <button
            onClick={startDemo}
            className="h-10 px-4 rounded bg-gray-900 text-white text-xs font-bold hover:bg-gray-700"
          >
            DEMO START
          </button>
          <button
            onClick={resetDemo}
            className="h-10 px-4 rounded bg-gray-200 text-gray-800 text-xs font-bold hover:bg-gray-300"
          >
            RESET
          </button>
        </div>


            </div>

      {/* 시스템 알림 배너 + 토글 */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-red-100 rounded-full">
            <Siren className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-red-800 tracking-wide">시스템 경보 활성</span>
            <span className="text-xs text-red-600">역주행 감지 모니터링 중</span>
          </div>
        </div>

        <button
          onClick={() => setAlertsEnabled((v) => !v)}
          className="flex items-center space-x-3 bg-white px-3 py-1.5 rounded border border-red-100 shadow-sm"
          aria-label="알림 토글"
        >
          <span className="text-xs font-bold text-gray-600">알림</span>
          <div
            className={`w-10 h-5 rounded-full relative transition-colors ${
              alertsEnabled ? "bg-red-500" : "bg-gray-300"
            }`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                alertsEnabled ? "right-0.5" : "left-0.5"
              }`}
            />
          </div>
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="flex flex-col justify-between h-32 cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-colors group">
          <div className="flex justify-between items-start" onClick={() => goEvents("analytics")}
        >
            <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-blue-500" />
            </div>
            <MoreHorizontal className="text-gray-300 w-5 h-5 group-hover:text-blue-400" />
          </div>
          <div onClick={() => goEvents("analytics")}>
            <div className="font-mono text-sm font-bold text-gray-700 mb-1">오늘 이벤트</div>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-gray-900">{kpi.todaysEvents}</span>
              <span className="text-xs text-green-600 bg-green-100 px-1 rounded">+{kpi.newEvents} 신규</span>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col justify-between h-32 cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-colors group">
          <div className="flex justify-between items-start" onClick={() => goEvents("vehicles")}>
            <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center">
              <Activity className="w-4 h-4 text-gray-600" />
            </div>
            <MoreHorizontal className="text-gray-300 w-5 h-5 group-hover:text-blue-400" />
          </div>
          <div onClick={() => goEvents("vehicles")}>
            <div className="font-mono text-sm font-bold text-gray-700 mb-1">통과 차량 수</div>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-gray-900">{kpi.vehiclesPassed.toLocaleString()}</span>
              <div className="flex items-center text-xs text-green-600 bg-green-100 px-1 rounded">
                <ArrowUpRight className="w-3 h-3 mr-1" />
                <span>12%</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col justify-between h-32 cursor-pointer hover:bg-red-50 hover:border-red-400 transition-colors group">
          <div className="flex justify-between items-start" onClick={() => navigate("/dashboard/wrongway")}>
            <div className="w-8 h-8 rounded bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <MoreHorizontal className="text-gray-300 w-5 h-5 group-hover:text-red-400" />
          </div>
          <div onClick={() => navigate("/dashboard/wrongway")}>
            <div className="font-mono text-sm font-bold text-gray-700 mb-1">역주행 이벤트</div>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-gray-900">{kpi.wrongWayEvents}</span>
              <div className="flex items-center text-xs text-red-600 bg-red-100 px-1 rounded">
                <span className="animate-pulse mr-1">●</span>
                <span>조치 필요</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col justify-between h-32 cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-colors group">
          <div className="flex justify-between items-start" onClick={() => goEvents("unidentified")}>
            <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-gray-600" />
            </div>
            <MoreHorizontal className="text-gray-300 w-5 h-5 group-hover:text-blue-400" />
          </div>
          <div onClick={() => goEvents("unidentified")}>
            <div className="font-mono text-sm font-bold text-gray-700 mb-1">미식별</div>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-gray-900">{kpi.unidentified}</span>
              <div className="flex items-center text-xs text-red-600 bg-red-100 px-1 rounded">
                <ArrowDownRight className="w-3 h-3 mr-1" />
                <span>2%</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 메인 모니터링 */}
        <Card className="lg:col-span-2 h-[28rem]" title="실시간 모니터링">
          <div className="grid grid-cols-2 gap-4 h-[23rem]">
            {/* 카메라 영역 (1칸) */}
            <div className=" bg-gray-200 rounded border border-gray-300 relative overflow-hidden flex items-center justify-center">

              <div className="absolute top-3 left-3 px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded flex items-center z-10">
                <span className="w-1.5 h-1.5 bg-white rounded-full mr-1.5 animate-pulse" />
                실시간 카메라
              </div>

              <img
                src={`${DETECTOR_BASE}/video_feed`}
                alt="YOLO Detection Feed"
                className="w-full h-full object-contain"
              />

              <div className="absolute bottom-2 left-2 text-[10px] text-gray-600 font-mono">
                CAM_01_ENTRANCE
              </div>
            </div>


             {/* 라이다 영역 (2칸) */}
              <div className=" bg-black rounded border border-gray-700 relative overflow-hidden flex">

                <div className="absolute top-3 left-3 px-2 py-0.5 bg-blue-900/80 border border-blue-500/50 text-blue-200 text-[10px] font-bold rounded font-mono z-10">
                  라이다 센서
                </div>

                <img
                  src={`${DETECTOR_BASE}/lidar_feed`}
                  alt="Lidar Point Cloud Feed"
                  className="w-full h-full object-contain"
                />


              </div>

          </div>
        </Card>

        {/* 우측 위젯 */}
        <Card className="h-[28rem] flex flex-col" title="제어 및 활동">
          <div className="flex-1 space-y-6">
            {/* 차단기 제어 */}
            <div>
              <div className="text-xs font-bold text-gray-400 mb-2 tracking-wider">차단기 제어</div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={openGate}
                  className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded hover:bg-green-50 hover:border-green-300 transition-colors group bg-white"
                >
                  <ArrowUp className="w-5 h-5 text-gray-500 group-hover:text-green-600 mb-1" />
                  <span className="text-xs font-bold text-gray-700">열기</span>
                </button>
                <button
                  onClick={closeGate}
                  className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded hover:bg-red-50 hover:border-red-300 transition-colors group bg-white"
                >
                  <ArrowDown className="w-5 h-5 text-gray-500 group-hover:text-red-600 mb-1" />
                  <span className="text-xs font-bold text-gray-700">닫기</span>
                </button>
              </div>
            </div>

            {/* 전광판 문구 */}
            <div>
              <div className="text-xs font-bold text-gray-400 mb-2 tracking-wider">전광판 문구</div>
              <div className="flex space-x-2 mb-2">
                <div className="flex-1 relative">
                  <Megaphone className="w-3 h-3 text-gray-400 absolute left-2 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="text"
                    value={vmsText}
                    onChange={(e) => setVmsText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendVms()}
                    placeholder="문구 입력..."
                    className="w-full bg-gray-50 border border-gray-200 rounded py-1.5 pl-7 pr-2 text-xs font-mono focus:outline-none focus:border-blue-400"
                  />
                </div>
                <button
                  onClick={sendVms}
                  className="bg-gray-800 text-white px-3 rounded text-xs font-bold hover:bg-gray-700 transition-colors"
                >
                  전송
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => quickVms("정지")}
                  className="px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold rounded hover:bg-gray-200 border border-gray-200"
                >
                  정지
                </button>
                <button
                  type="button"
                  onClick={() => quickVms("서행")}
                  className="px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold rounded hover:bg-gray-200 border border-gray-200"
                >
                  서행
                </button>
                <button
                  type="button"
                  onClick={() => quickVms("역주행 주의")}
                  className="px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold rounded hover:bg-gray-200 border border-gray-200"
                >
                  역주행 주의
                </button>
              </div>
            </div>

            {/* 최근 로그 */}
            <div>
              <div className="text-xs font-bold text-gray-400 mb-2 tracking-wider">최근 이벤트</div>
              <div className="space-y-2 bg-gray-50 p-2 rounded border border-gray-100 max-h-[117px] ">

                {recentLogs.slice(0,4).map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs pb-1 border-b border-gray-200 border-dashed last:border-0 last:pb-0"
                  >
                    <span className="text-gray-600 truncate mr-2">{item.msg}</span>
                    <span className="text-gray-400 font-mono text-[10px]">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

