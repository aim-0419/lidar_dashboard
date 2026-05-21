// /src/pages/Dashboard/WrongwayLogPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../components/dashboard/Card";
import {
  ArrowLeft,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  MapPin,
  Camera,
  AlertOctagon,
  ChevronRight,
  Car,
} from "lucide-react";

/* -----------------------------
   목업 데이터
------------------------------ */
const MOCK_VIOLATIONS = [
  {
    id: "evt-001",
    plate: "56CD 7890",
    timestamp: "오늘 10:42:15",
    location: "진출로 B (북행)",
    snapshotUrl: "",
    status: "new",
    confidence: 98.5,
    vehicleInfo: {
      owner: "홍길동",
      model: "Honda CR-V",
      color: "검정",
      type: "SUV",
      registered: true,
      phone: "010-1234-5678",
    },
  },
  {
    id: "evt-002",
    plate: "99XY 8877",
    timestamp: "오늘 09:15:30",
    location: "게이트 A 진입",
    snapshotUrl: "",
    status: "new",
    confidence: 91.2,
    vehicleInfo: {
      owner: "미상",
      model: "Ford F-150",
      color: "흰색",
      type: "트럭",
      registered: false,
      phone: "N/A",
    },
  },
  {
    id: "evt-003",
    plate: "12AB 3456",
    timestamp: "어제 18:30:45",
    location: "서비스 도로 3",
    snapshotUrl: "",
    status: "reviewed",
    confidence: 87.6,
    vehicleInfo: {
      owner: "김철수",
      model: "Toyota Camry",
      color: "은색",
      type: "승용",
      registered: true,
      phone: "010-9876-5432",
    },
  },
];

const statusText = (s) => (s==="new"?"신규":s==="reviewed"?"검토됨":"보고됨");

export default function WrongwayLogPage() {
    const navigate = useNavigate();

    const [violations, setViolations] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [query, setQuery] = useState("");
    const [isAnimating, setIsAnimating] = useState(false);

    // 실제 데이터 가져오기
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch(`http://${window.location.hostname}:5000/api/wrongway/history`);
                const data = await res.json();
                
                // 데이터 정규화 (필요한 필드가 없으면 기본값 채움)
                const mapped = data.map(item => ({
                    id: item.id,
                    plate: item.track_id || "Unknown",
                    timestamp: item.timestamp,
                    location: item.subMessage || "YOLO-ZONE",
                    snapshotUrl: item.snapshot ? `data:image/jpeg;base64,${item.snapshot}` : "",
                    status: "new", // 실제로는 서버에서 상태를 관리할 수 있지만 여기서는 기본값
                    confidence: (item.confidence * 100).toFixed(1),
                    vehicleInfo: {
                        owner: "인식 전",
                        model: "인식 전",
                        color: "인식 전",
                        type: "인식 전",
                        registered: false,
                        phone: "-",
                    }
                }));
                
                setViolations(mapped);
                if (mapped.length > 0 && !selectedId) {
                    setSelectedId(mapped[0].id);
                }
            } catch (err) {
                console.error("Failed to fetch history:", err);
            }
        };

        fetchHistory();
        const timer = setInterval(fetchHistory, 3000); // 3초마다 갱신
        return () => clearInterval(timer);
    }, [selectedId]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if(!q) return violations;
        return violations.filter((e)=>{
            return (
                e.id.toLowerCase().includes(q) ||
                e.plate.toLowerCase().includes(q) ||
                e.location.toLowerCase().includes(q) ||
                e.timestamp.toLowerCase().includes(q) ||
                e.status.toLowerCase().includes(q)   
            );
        });
    }, [query, violations]);

    const selectedEvent = useMemo(()=>{
        return filtered.find((e) => e.id === selectedId) || filtered[0];
    }, [filtered, selectedId]);

    //선택 변경 애니메이션 
    useEffect(() => {
        setIsAnimating(true);
        const t = setTimeout(() => setIsAnimating(false), 200);
        return () => clearTimeout(t);
    }, [selectedEvent?.id]);

    const newCount = MOCK_VIOLATIONS.filter((v) => v.status ==="new").length;

    return (
     <div className="p-6 space-y-6 bg-white min-h-screen font-sans">
      {/* 상단 */}
      <div className="flex justify-between items-center mb-6">
        <button
          className="flex items-center space-x-2 hover:bg-gray-100 rounded p-1 transition-colors"
          onClick={() => navigate("/")}
          type="button"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
          <span className="text-sm font-mono text-gray-500">대시보드로</span>
        </button>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded bg-red-100 flex items-center justify-center">
            <AlertOctagon className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">역주행 감지 로그</h1>
            <div className="text-sm text-gray-500 flex items-center">
              <span className="w-2 h-2 rounded-full bg-red-500 mr-2 animate-pulse" />
              실시간 감지 중 • 신규 {newCount}건
            </div>
          </div>
        </div>

        <div className="flex space-x-2">
          <div className="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded border border-gray-200">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="번호판/위치/시간 검색..."
              className="bg-transparent outline-none text-sm w-64"
            />
          </div>

          <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded flex items-center hover:bg-gray-50" type="button">
            <Filter className="w-4 h-4 mr-2" /> 필터
          </button>

          <button className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded flex items-center hover:bg-red-700 shadow-sm" type="button">
            <Shield className="w-4 h-4 mr-2" /> 보고서 내보내기
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-250px)]">
        {/* 좌측 리스트 */}
        <div className="lg:col-span-4 flex flex-col bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-white">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">감지 목록</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filtered.map((event) => (
              <div
                key={event.id}
                onClick={() => setSelectedId(event.id)}
                className={`p-4 rounded-lg cursor-pointer transition-all border ${
                  selectedEvent?.id === event.id
                    ? "bg-white border-red-400 shadow-md ring-1 ring-red-100"
                    : "bg-white border-gray-200 hover:border-red-200 hover:shadow-sm"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center">
                    <AlertTriangle className={`w-4 h-4 mr-2 ${event.status === "new" ? "text-red-500" : "text-gray-400"}`} />
                    <span className="font-mono font-bold text-gray-800">{event.plate}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">{event.timestamp}</span>
                </div>

                <div className="flex items-center text-xs text-gray-600 mb-2">
                  <MapPin className="w-3 h-3 mr-1 text-gray-400" />
                  {event.location}
                </div>

                <div className="flex justify-between items-center mt-2">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      event.status === "new" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {statusText(event.status)}
                  </span>
                  {selectedEvent?.id === event.id && <ChevronRight className="w-4 h-4 text-red-400" />}
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="p-6 text-sm text-gray-500 text-center">검색 결과가 없습니다.</div>
            )}
          </div>
        </div>

        {/* 우측 상세 */}
        <Card className="lg:col-span-8 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-red-600" />

          <div className={`flex-1 transition-opacity duration-200 ${isAnimating ? "opacity-60" : "opacity-100"}`}>
            {/* 헤더 */}
            <div className="flex justify-between items-start mb-8 pb-6 border-b border-gray-100">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <h2 className="text-3xl font-mono font-bold text-gray-900">{selectedEvent?.plate || "-"}</h2>
                  <span className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded animate-pulse">
                    역주행 감지
                  </span>
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <Clock className="w-4 h-4 mr-2" />
                  {selectedEvent?.timestamp || "-"}
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">신뢰도</div>
                <div className="text-2xl font-bold text-gray-900">{selectedEvent?.confidence ?? "-"}%</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* 차량 정보 */}
              <div className="space-y-6">
                <h3 className="text-sm font-bold text-gray-900 flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-blue-500" />
                  차량 정보
                </h3>

                <div className="bg-gray-50 rounded-lg p-5 border border-gray-200 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">소유자</div>
                      <div className="font-bold text-gray-800">{selectedEvent?.vehicleInfo?.owner || "-"}</div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500 mb-1">등록 상태</div>
                      <div className={`font-bold ${selectedEvent?.vehicleInfo?.registered ? "text-green-600" : "text-red-600"}`}>
                        {selectedEvent?.vehicleInfo?.registered ? "정상" : "미등록/확인 불가"}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500 mb-1">차종/모델</div>
                      <div className="font-medium text-gray-700">{selectedEvent?.vehicleInfo?.model || "-"}</div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500 mb-1">색상/유형</div>
                      <div className="font-medium text-gray-700">
                        {(selectedEvent?.vehicleInfo?.color || "-") + " • " + (selectedEvent?.vehicleInfo?.type || "-")}
                      </div>
                    </div>

                    <div className="col-span-2 pt-2 border-t border-gray-200 border-dashed">
                      <div className="text-xs text-gray-500 mb-1">연락처</div>
                      <div className="font-mono text-gray-600">{selectedEvent?.vehicleInfo?.phone || "-"}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 스냅샷 */}
              <div className="space-y-6">
                <h3 className="text-sm font-bold text-gray-900 flex items-center">
                  <Camera className="w-4 h-4 mr-2 text-gray-500" />
                  증거 스냅샷
                </h3>

                <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden relative">
                  {selectedEvent?.snapshotUrl ? (
                    <img 
                      src={selectedEvent.snapshotUrl} 
                      alt="Violation Snapshot" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full opacity-60 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-700 via-gray-900 to-black flex items-center justify-center">
                      <Car className="w-16 h-16 text-gray-600" />
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex justify-between items-end">
                    <div className="text-white font-mono text-xs">CAM_02_EXIT_RAMP</div>
                    <div className="text-white font-mono text-xs">{selectedEvent?.timestamp || "-"}</div>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded border border-blue-100">
                  <div className="text-xs font-bold text-blue-800 uppercase mb-2">AI 분석</div>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    지정된 교통 흐름과 반대 방향으로 이동하는 차량이 감지되었습니다. 위험도: 높음.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}