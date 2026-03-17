// 라이다 장비 목록
// 연결 상태, 위치, 마지막 통신 시간 등
import React from "react"
import { Card } from "../../components/dashboard/Card";
import { Server, Wifi, WifiOff, Activity, HardDrive } from "lucide-react";

export default function DevicesPage() {
    const devices = [
        { name: "LIDAR_MAIN_01", type: "센서", status: "online", ip: "192.168.1.101", temp: "42°C" },
        { name: "CAM_ENTRANCE", type: "카메라", status: "online", ip: "192.168.1.102", temp: "38°C" },
        { name: "LIDAR_BACK_02", type: "센서", status: "error", ip: "192.168.1.103", temp: "--" },
        { name: "EDGE_PROCESSOR", type: "서버", status: "online", ip: "192.168.1.200", temp: "55°C" },
    ];

    return (
        <div className="p-6 space-y-6 bg-white min-h-screen font-sans">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">장비 상태</h1>
        <div className="text-sm text-gray-500">실시간 하드웨어 모니터링</div>
      </div>

      {/* 상단 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-green-50 border-green-200 p-4">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="font-bold text-green-700 font-mono">시스템 정상</span>
          </div>
          <div className="text-xs text-green-600">가동 시간: 14일 2시간 15분</div>
        </Card>

        <Card className="bg-white p-4">
          <div className="flex items-center space-x-3 mb-2">
            <Activity className="w-4 h-4 text-gray-400" />
            <span className="font-bold text-gray-700 font-mono">CPU 부하</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div className="bg-blue-500 h-2 rounded-full" style={{ width: "45%" }} />
          </div>
          <div className="text-xs text-gray-500 text-right">45%</div>
        </Card>

        <Card className="bg-white p-4">
          <div className="flex items-center space-x-3 mb-2">
            <HardDrive className="w-4 h-4 text-gray-400" />
            <span className="font-bold text-gray-700 font-mono">저장공간</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div className="bg-gray-600 h-2 rounded-full" style={{ width: "72%" }} />
          </div>
          <div className="text-xs text-gray-500 text-right">사용 중: 72%</div>
        </Card>
      </div>

      {/* 장비 목록 */}
      <h2 className="font-bold text-lg text-gray-800 mt-8 mb-4">연결된 장비</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {devices.map((device, i) => {
          const online = device.status === "online";
          return (
            <Card key={i} className="flex items-center justify-between p-4">
              <div className="flex items-center space-x-4">
                <div
                  className={`w-10 h-10 rounded flex items-center justify-center ${
                    online ? "bg-green-100" : "bg-red-100"
                  }`}
                >
                  <Server className={`w-5 h-5 ${online ? "text-green-600" : "text-red-600"}`} />
                </div>

                <div>
                  <div className="font-bold text-gray-800 font-mono">{device.name}</div>
                  <div className="text-xs text-gray-500 flex items-center space-x-2">
                    <span>{device.type}</span>
                    <span>•</span>
                    <span>{device.ip}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end space-y-1">
                <div
                  className={`flex items-center space-x-1 text-xs font-bold uppercase ${
                    online ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  <span>{online ? "정상" : "오류"}</span>
                </div>
                <div className="text-xs text-gray-400 font-mono">{device.temp}</div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}