import { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/dashboard/Card";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle,
  Info,
  XSquare,
  Crosshair,
  Calendar,
  Activity,
  Eye,
  Megaphone,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* -----------------------------
   목업 데이터
------------------------------ */

const MOCK_LOGS = [
  {
    id: "EVT-001",
    type: "warning",
    category: "역주행",
    message: "진출로 B에서 차량이 감지되었습니다.",
    time: "10:42",
    status: "pending",
  },
  {
    id: "EVT-002",
    type: "warning",
    category: "미식별",
    message: "게이트 A에서 미확인 감지가 발생했습니다.",
    time: "10:15",
    status: "pending",
  },
  {
    id: "EVT-003",
    type: "error",
    category: "연결",
    message: "LIDAR_02 연결이 끊겼습니다.",
    time: "09:42",
    status: "resolved",
    user: "관리자",
  },
  {
    id: "EVT-004",
    type: "success",
    category: "시스템",
    message: "시스템 백업이 완료되었습니다.",
    time: "09:00",
    status: "resolved",
  },
  {
    id: "EVT-005",
    type: "info",
    category: "접근",
    message: "admin 계정 로그인",
    time: "08:55",
    status: "resolved",
  },
  {
    id: "EVT-006",
    type: "warning",
    category: "네트워크",
    message: "CAM_01 지연 시간이 높습니다.",
    time: "08:30",
    status: "dismissed",
    user: "시스템",
  },
  {
    id: "EVT-007",
    type: "warning",
    category: "미식별",
    message: "Zone C에서 낮은 신뢰도 객체가 감지되었습니다.",
    time: "08:15",
    status: "pending",
  },
  {
    id: "EVT-008",
    type: "success",
    category: "점검",
    message: "일일 점검 스크립트 실행 완료",
    time: "04:00",
    status: "resolved",
  },
];

const INITIAL_HOURLY_DATA = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, "0")}:00`,
  events: 0,
}));

const MOCK_UNCONFIRMED = [
  {
    id: "unc-001",
    timestamp: "오늘 10:45:12",
    location: "Zone B - 서비스 차로",
    confidence: 68.5,
    status: "pending",
  },
  {
    id: "unc-002",
    timestamp: "오늘 10:48:33",
    location: "Gate A - 접근 구간",
    confidence: 52.1,
    status: "pending",
  },
  {
    id: "unc-003",
    timestamp: "오늘 10:55:01",
    location: "Exit Ramp C",
    confidence: 71.0,
    status: "pending",
  },
];

/* -----------------------------
   내부 뷰 컴포넌트
------------------------------ */

function AnalyticsView({ kpi }) {
  const hourlyData =
    kpi?.hourlyEvents && kpi.hourlyEvents.length > 0
      ? kpi.hourlyEvents
      : INITIAL_HOURLY_DATA;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-4 bg-blue-50 border-blue-100">
          <div className="text-sm font-bold text-blue-800 mb-1">오늘 이벤트</div>
          <div className="text-3xl font-bold text-gray-900">
            {kpi?.todaysEvents ?? 0}
          </div>
          <div className="text-xs text-blue-600 mt-1">어제 대비 +0</div>
        </Card>

        <Card className="p-4 bg-red-50 border-red-100">
          <div className="text-sm font-bold text-red-800 mb-1">활성 경보</div>
          <div className="text-3xl font-bold text-red-600">
            {kpi?.wrongWayEvents ?? 0}
          </div>
          <div className="text-xs text-red-400 mt-1">조치 필요</div>
        </Card>

        <Card className="p-4 bg-green-50 border-green-100">
          <div className="text-sm font-bold text-green-800 mb-1">시스템 가동률</div>
          <div className="text-3xl font-bold text-gray-900">99.9%</div>
          <div className="text-xs text-green-600 mt-1">센서 정상</div>
        </Card>
      </div>

      <Card title="시간대별 이벤트 분포" className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={hourlyData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="hour"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11 }}
            />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Area type="monotone" dataKey="events" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

function VehiclesView() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between bg-white p-2 rounded border border-gray-200">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-bold text-gray-600">필터:</span>
              <span className="px-2 py-1 bg-gray-100 rounded text-xs font-mono cursor-pointer hover:bg-gray-200">
                시간 범위
              </span>
              <span className="px-2 py-1 bg-gray-100 rounded text-xs font-mono cursor-pointer hover:bg-gray-200">
                게이트
              </span>
            </div>
            <div className="text-sm text-gray-500">50 / 12,842 표시</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-mono text-xs uppercase border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">시간</th>
                  <th className="px-4 py-3">차종</th>
                  <th className="px-4 py-3">번호판(OCR)</th>
                  <th className="px-4 py-3">속도</th>
                  <th className="px-4 py-3">게이트</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <tr key={i} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-3 font-mono text-gray-600">10:4{i}</td>
                    <td className="px-4 py-3">승용차</td>
                    <td className="px-4 py-3 font-mono font-bold">ABC-123{i}</td>
                    <td className="px-4 py-3 font-bold">45 km/h</td>
                    <td className="px-4 py-3 text-gray-500">Gate A</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <Card title="교통량(예시)">
            <div className="flex items-end space-x-1 h-32 mt-2">
              {[40, 60, 45, 70, 80, 50, 60, 75, 90, 60, 50, 40].map((h, i) => (
                <div key={i} className="flex-1 bg-gray-800 rounded-t opacity-80" style={{ height: `${h}%` }} />
              ))}
            </div>
          </Card>

          <Card title="차종 비율(예시)">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">승용차</span> <span className="font-bold">65%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className="h-1.5 rounded-full" style={{ width: "65%" }} />
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-gray-600">트럭</span> <span className="font-bold">20%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className="h-1.5 rounded-full" style={{ width: "20%" }} />
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-gray-600">오토바이</span> <span className="font-bold">15%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className="h-1.5 rounded-full" style={{ width: "15%" }} />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function UnidentifiedView() {
  const [selectedId, setSelectedId] = useState(MOCK_UNCONFIRMED[0]?.id);
  const selected = MOCK_UNCONFIRMED.find((u) => u.id === selectedId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-280px)]">
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
        <div className="p-3 bg-gray-50 border-b border-gray-200 font-bold text-xs text-gray-500 uppercase">
          검토 대기 목록
        </div>
        <div className="overflow-y-auto flex-1 p-2 space-y-2">
          {MOCK_UNCONFIRMED.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              className={`p-3 rounded border cursor-pointer transition-colors ${
                selectedId === item.id
                  ? "bg-orange-50 border-orange-300 ring-1 ring-orange-200"
                  : "bg-white border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex justify-between mb-1">
                <span className="font-mono text-xs font-bold text-gray-700">{item.id}</span>
                <span className="text-xs text-red-600 font-bold">{item.confidence}%</span>
              </div>
              <div className="text-sm text-gray-800">{item.location}</div>
              <div className="text-xs text-gray-400 mt-1">{item.timestamp}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2 flex flex-col space-y-4">
        <Card className="flex-1 flex flex-col relative overflow-hidden bg-gray-900 border-gray-800">
          <div className="absolute top-4 left-4 z-10 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
            미확정 객체
          </div>

          <div className="flex-1 flex items-center justify-center opacity-40 relative">
            <div className="w-full h-full bg-[radial-gradient(circle,_var(--tw-gradient-stops))] from-gray-700 to-black" />
            <Crosshair className="w-32 h-32 text-white/20 absolute" />
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
            <div className="flex justify-between items-end text-white">
              <div>
                <div className="font-mono text-lg font-bold">{selected?.location || "-"}</div>
                <div className="font-mono text-xs text-gray-400">
                  CAM_02_FEED • {selected?.timestamp || "-"}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex space-x-3">
          <button
            className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded shadow-sm flex items-center justify-center"
            onClick={() => {
              /* TODO: 확정 처리 */
            }}
          >
            <CheckCircle className="w-4 h-4 mr-2" /> 사건 확정
          </button>
          <button
            className="flex-1 py-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold rounded flex items-center justify-center"
            onClick={() => {
              /* TODO: 오탐 처리 */
            }}
          >
            <XSquare className="w-4 h-4 mr-2" /> 오탐/무시
          </button>
        </div>
      </div>
    </div>
  );
}

/* -----------------------------
   메인 페이지 컴포넌트
------------------------------ */
export default function EventLogPage() {
  const [searchParams] = useSearchParams();

  // URL 쿼리에서 tab 읽기
  const tabParam = (searchParams.get("tab") || "all").toLowerCase();

  // 허용된 탭만 통과
  const safeTab = ["all", "analytics", "vehicles", "unidentified"].includes(tabParam)
    ? tabParam
    : "all";

  const [activeTab, setActiveTab] = useState(safeTab);
  const [selectedLog, setSelectedLog] = useState(null);
  const [query, setQuery] = useState("");

  const [kpi, setKpi] = useState({
    todaysEvents: 0,
    wrongWayEvents: 0,
    hourlyEvents: INITIAL_HOURLY_DATA,
  });

  // WebSocket 연결
  useEffect(() => {
    const WS_URL = `ws://${window.location.hostname}:5000`;
    const ws = new WebSocket(WS_URL);

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "state" && msg.payload) {
          setKpi(msg.payload);
        }
      } catch (err) {
        // ignore
      }
    };

    return () => ws.close();
  }, []);

  // URL tab 변경 시 탭 동기화
  useEffect(() => {
    setActiveTab(safeTab);
  }, [safeTab]);

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MOCK_LOGS;
    return MOCK_LOGS.filter((log) => {
      return (
        log.id.toLowerCase().includes(q) ||
        log.category.toLowerCase().includes(q) ||
        log.message.toLowerCase().includes(q) ||
        (log.status || "").toLowerCase().includes(q)
      );
    });
  }, [query]);

  const statusLabel = (status) => {
    if (status === "pending") return "대기";
    if (status === "resolved") return "해결";
    if (status === "dismissed") return "무시";
    return status;
  };

  const statusBadgeClass = (status) => {
    if (status === "pending") return "bg-orange-50 text-orange-700 border-orange-200";
    if (status === "resolved") return "bg-green-50 text-green-700 border-green-200";
    if (status === "dismissed") return "bg-gray-50 text-gray-600 border-gray-200";
    return "bg-gray-50 text-gray-600 border-gray-200";
  };

  const iconByType = (type) => {
    if (type === "error" || type === "warning") return <AlertTriangle className="w-4 h-4" />;
    if (type === "success") return <CheckCircle className="w-4 h-4" />;
    return <Info className="w-4 h-4" />;
  };

  const iconWrapClass = (type) => {
    if (type === "error") return "bg-red-100 text-red-600";
    if (type === "warning") return "bg-orange-100 text-orange-600";
    if (type === "success") return "bg-green-100 text-green-600";
    return "bg-blue-100 text-blue-600";
  };

  return (
    <div className="p-6 space-y-6 bg-white min-h-screen font-sans">
      {/* 헤더 */}
      <div className="flex flex-col space-y-6 mb-2">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">시스템 활동 로그</h1>
            <div className="text-sm text-gray-500">통합 모니터링 및 리포팅</div>
          </div>
          <div className="flex space-x-2">
            <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-xs font-bold text-gray-600 flex items-center">
              <Download className="w-4 h-4 mr-2" /> CSV 내보내기
            </button>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex items-center space-x-1 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center ${
              activeTab === "all"
                ? "border-gray-800 text-gray-800"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            전체 로그
          </button>

          <button
            onClick={() => setActiveTab("analytics")}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center ${
              activeTab === "analytics"
                ? "border-gray-800 text-gray-800"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Activity className="w-4 h-4 mr-2" />
            오늘 통계
          </button>

          <button
            onClick={() => setActiveTab("vehicles")}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center ${
              activeTab === "vehicles"
                ? "border-gray-800 text-gray-800"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Calendar className="w-4 h-4 mr-2" />
            차량 이력
          </button>

          <button
            onClick={() => setActiveTab("unidentified")}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center ${
              activeTab === "unidentified"
                ? "border-gray-800 text-gray-800"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Eye className="w-4 h-4 mr-2" />
            검토 대기
            <span className="ml-2 bg-gray-100 text-gray-700 text-[10px] px-1.5 py-0.5 rounded-full">
              {MOCK_UNCONFIRMED.length}
            </span>
          </button>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="min-h-[500px]">
        {activeTab === "analytics" && <AnalyticsView kpi={kpi} />}
        {activeTab === "vehicles" && <VehiclesView />}
        {activeTab === "unidentified" && <UnidentifiedView />}

        {activeTab === "all" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* 리스트 */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center space-x-2 bg-gray-50 p-2 rounded border border-gray-200">
                <Search className="w-4 h-4 text-gray-400 ml-2" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  type="text"
                  placeholder="로그 검색..."
                  className="bg-transparent border-none focus:outline-none text-sm w-full"
                />
              </div>

              <div className="space-y-2">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={`p-4 rounded-lg border transition-all cursor-pointer flex items-center justify-between group ${
                      selectedLog?.id === log.id
                        ? "bg-gray-50 border-gray-300 shadow-sm"
                        : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-full ${iconWrapClass(log.type)}`}>
                        {iconByType(log.type)}
                      </div>

                      <div>
                        <div className="flex items-center space-x-2 mb-0.5">
                          <span className="font-mono text-xs font-bold text-gray-400">{log.id}</span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusBadgeClass(
                              log.status
                            )}`}
                          >
                            {statusLabel(log.status)}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-gray-800">{log.message}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono text-xs text-gray-500 mb-1">{log.time}</div>
                      <div className="text-xs text-gray-400">{log.category}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 상세 */}
            <div className="lg:col-span-4">
              <Card title="로그 상세" className="h-full sticky top-6">
                {selectedLog ? (
                  <div className="space-y-6">
                    <div className="border-b border-gray-100 pb-4">
                      <div className="text-2xl font-mono font-bold text-gray-900">{selectedLog.id}</div>
                      <div className="text-xs text-gray-500 font-bold mt-1">{selectedLog.category}</div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-400 font-bold mb-1">내용</div>
                      <p className="text-gray-800 text-sm">{selectedLog.message}</p>
                    </div>

                    <div>
                      <div className="text-xs text-gray-400 font-bold mb-1">상태</div>
                      <div className="text-sm text-gray-700">{statusLabel(selectedLog.status)}</div>
                    </div>

                    {selectedLog.user && (
                      <div>
                        <div className="text-xs text-gray-400 font-bold mb-1">처리자</div>
                        <div className="text-sm text-gray-700">{selectedLog.user}</div>
                      </div>
                    )}

                    {selectedLog.status === "pending" && (
                      <div className="pt-4 border-t border-gray-100 space-y-2">
                        <button className="w-full py-2 bg-gray-900 text-white text-sm font-bold rounded shadow-sm hover:bg-gray-800">
                          해결 처리
                        </button>
                        <button className="w-full py-2 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded hover:bg-gray-50">
                          무시 처리
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                    <Info className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-xs">항목을 선택하세요</p>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
