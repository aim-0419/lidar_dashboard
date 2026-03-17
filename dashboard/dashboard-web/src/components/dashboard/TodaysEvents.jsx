// src/components/dashboard/TodaysEvents.jsx
import React, { useMemo } from "react";
import { Card } from "./Card";
import {
  ArrowLeft,
  Calendar,
  Filter,
  Download,
  MoreHorizontal,
  Activity,
  MapPin,
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

const HOURLY_DATA = [
  { hour: "00:00", events: 2 },
  { hour: "01:00", events: 1 },
  { hour: "02:00", events: 0 },
  { hour: "03:00", events: 0 },
  { hour: "04:00", events: 1 },
  { hour: "05:00", events: 3 },
  { hour: "06:00", events: 12 },
  { hour: "07:00", events: 45 },
  { hour: "08:00", events: 86 },
  { hour: "09:00", events: 64 },
  { hour: "10:00", events: 42 },
  { hour: "11:00", events: 38 },
  { hour: "12:00", events: 55 },
  { hour: "13:00", events: 48 },
  { hour: "14:00", events: 62 },
  { hour: "15:00", events: 75 },
  { hour: "16:00", events: 90 },
  { hour: "17:00", events: 82 },
  { hour: "18:00", events: 45 },
  { hour: "19:00", events: 24 },
  { hour: "20:00", events: 15 },
  { hour: "21:00", events: 8 },
  { hour: "22:00", events: 5 },
  { hour: "23:00", events: 3 },
];

const RECENT_EVENTS = [
  {
    id: 1,
    time: "10:42",
    type: "경고",
    category: "과속",
    location: "Zone A - 진입",
    description: "40km/h 구간에서 65km/h로 감지되었습니다.",
  },
  {
    id: 2,
    time: "10:15",
    type: "경보",
    category: "역주행",
    location: "Zone B - 진출로",
    description: "교통 흐름 반대 방향으로 이동이 감지되었습니다.",
  },
  {
    id: 3,
    time: "09:58",
    type: "정보",
    category: "출입 승인",
    location: "메인 게이트",
    description: "승인 차량 진입: ID #4829",
  },
  {
    id: 4,
    time: "09:45",
    type: "경고",
    category: "정차",
    location: "Zone C - 하역장",
    description: "15분 이상 정차가 감지되었습니다.",
  },
  {
    id: 5,
    time: "09:30",
    type: "정보",
    category: "점검",
    location: "시스템",
    description: "라이다 센서 #3 자동 보정 완료",
  },
];

/* -----------------------------
   툴팁 (JSX)
------------------------------ */
function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const v = payload?.[0]?.value ?? 0;
    return (
      <div className="bg-gray-800 text-white p-3 rounded shadow-lg border border-gray-700 text-xs">
        <p className="font-bold font-mono mb-1">{label}</p>
        <p className="text-blue-200">
          이벤트: <span className="text-white font-bold">{v}</span>
        </p>
      </div>
    );
  }
  return null;
}

/* -----------------------------
   컴포넌트
------------------------------ */
export default function TodaysEvents({ onBack }) {
  const todayLabel = useMemo(() => {
    // 한국 시간 기준 표시(로컬)
    const d = new Date();
    return d.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }, []);

  const totalEvents = 842;
  const activeAlerts = 3;

  // 피크 계산
  const peak = useMemo(() => {
    if (!HOURLY_DATA.length) return { hour: "-", events: 0 };
    return HOURLY_DATA.reduce((best, cur) => (cur.events > best.events ? cur : best), HOURLY_DATA[0]);
  }, []);

  const badgeClassByType = (type) => {
    if (type === "경고") return "bg-orange-50 text-orange-600 border-orange-200";
    if (type === "경보") return "bg-red-50 text-red-600 border-red-200";
    return "bg-blue-50 text-blue-600 border-blue-200";
  };

  return (
    <div className="p-6 space-y-6 bg-white min-h-screen font-sans">
      {/* 상단 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <button
          type="button"
          className="flex items-center space-x-2 hover:bg-gray-100 rounded p-1 transition-colors"
          onClick={onBack}
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
          <span className="text-sm font-mono text-gray-500">대시보드로</span>
        </button>

        <div className="flex space-x-2">
          <button
            type="button"
            className="flex items-center space-x-2 px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-bold text-gray-600 hover:bg-gray-50"
          >
            <Calendar className="w-4 h-4" />
            <span>{todayLabel}</span>
          </button>

          <button
            type="button"
            className="flex items-center space-x-2 px-3 py-1.5 bg-gray-900 border border-gray-900 rounded text-xs font-bold text-white hover:bg-gray-800"
          >
            <Download className="w-4 h-4" />
            <span>데이터 내보내기</span>
          </button>
        </div>
      </div>

      {/* 타이틀 + 요약 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">오늘 이벤트 분석</h1>
          <div className="text-sm text-gray-500">시스템 감지/트리거 현황 요약</div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div className="text-xs text-gray-400 font-bold uppercase">총 이벤트</div>
            <div className="text-2xl font-bold text-gray-900">{totalEvents}</div>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div className="text-right">
            <div className="text-xs text-gray-400 font-bold uppercase">활성 경보</div>
            <div className="text-2xl font-bold text-red-600">{activeAlerts}</div>
          </div>
        </div>
      </div>

      {/* 차트 */}
      <Card className="p-6 border border-gray-200 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-gray-700 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-gray-700" />
            시간대별 이벤트 분포
          </h3>

          <div className="flex space-x-2">
            <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs font-bold">
              피크: {peak.hour} ({peak.events}건)
            </span>
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={HOURLY_DATA} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="hour"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fontFamily: "monospace" }}
                dy={10}
                interval={2}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontFamily: "monospace" }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="events" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 이벤트 목록 + 우측 카드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 목록 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide">최근 로그</h3>
            <button type="button" className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600">
              <Filter className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-mono text-xs uppercase border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 font-medium w-24">시간</th>
                  <th className="px-4 py-3 font-medium w-32">분류</th>
                  <th className="px-4 py-3 font-medium">설명</th>
                  <th className="px-4 py-3 font-medium w-40">위치</th>
                  <th className="px-4 py-3 font-medium w-10" />
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {RECENT_EVENTS.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50 transition-colors group cursor-pointer">
                    <td className="px-4 py-3 font-mono text-gray-600">{event.time}</td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badgeClassByType(
                          event.type
                        )}`}
                      >
                        {event.category}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-gray-800 font-medium">{event.description}</td>

                    <td className="px-4 py-3 text-gray-500 text-xs">
                      <div className="flex items-center">
                        <MapPin className="w-3 h-3 mr-1 text-gray-300" />
                        {event.location}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <MoreHorizontal className="w-4 h-4 text-gray-300 group-hover:text-gray-600" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="p-3 bg-gray-50 border-t border-gray-200 text-center">
              <button type="button" className="text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors">
                전체 로그 보기
              </button>
            </div>
          </div>
        </div>

        {/* 우측 카드 */}
        <div className="space-y-6">
          <Card title="이벤트 카테고리">
            <div className="space-y-4 pt-2">
              {[
                { label: "과속", count: 124 },
                { label: "역주행", count: 12 },
                { label: "출입 승인", count: 450 },
                { label: "미확인 객체", count: 56 },
              ].map((stat, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600 font-medium">{stat.label}</span>
                    <span className="font-mono font-bold text-gray-900">{stat.count}</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gray-800"
                      style={{ width: `${(stat.count / totalEvents) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="시스템 상태">
            <div className="flex items-center justify-between mb-4 p-3 bg-green-50 border border-green-100 rounded">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-xs font-bold text-green-800 uppercase">정상 운영</span>
              </div>
              <span className="font-mono text-xs text-green-600">가동률 99.9%</span>
            </div>

            <div className="space-y-2 text-xs text-gray-500 font-mono">
              <div className="flex justify-between">
                <span>LIDAR_SENSORS</span>
                <span className="text-green-600">활성 (4/4)</span>
              </div>
              <div className="flex justify-between">
                <span>CAM_FEEDS</span>
                <span className="text-green-600">기록 중</span>
              </div>
              <div className="flex justify-between">
                <span>DB_SYNC</span>
                <span className="text-blue-500">동기화 중...</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
