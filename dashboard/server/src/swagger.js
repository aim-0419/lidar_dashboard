const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "Lidar Dashboard API",
    version: "1.0.0",
    description: "라이다 역주행 관제 대시보드 백엔드 API",
  },
  servers: [
    {
      url: "/",
      description: "현재 백엔드 서버",
    },
  ],
  tags: [
    { name: "Health", description: "서버 상태 확인" },
    { name: "Dashboard", description: "대시보드 상태와 로그 조회" },
    { name: "Control", description: "차단기와 전광판 제어" },
    { name: "Wrongway", description: "역주행 감지 이벤트" },
    { name: "External Ingest", description: "라이다 PC와 통합 제어보드 외부 이벤트 수신" },
    { name: "Demo", description: "감지 데모 제어" },
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "백엔드 서버 상태 확인",
        responses: {
          200: {
            description: "서버 실행 중",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
              },
            },
          },
        },
      },
    },
    "/api/state": {
      get: {
        tags: ["Dashboard"],
        summary: "현재 대시보드 상태 조회",
        responses: {
          200: {
            description: "메모리에 저장된 현재 대시보드 상태",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DashboardState" },
              },
            },
          },
        },
      },
    },
    "/api/logs": {
      get: {
        tags: ["Dashboard"],
        summary: "최근 대시보드 로그 조회",
        responses: {
          200: {
            description: "최근 로그 목록",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/LogItem" },
                },
              },
            },
          },
        },
      },
    },
    "/api/gate/open": {
      post: {
        tags: ["Control"],
        summary: "차단기 열기",
        responses: {
          200: {
            description: "차단기 열기 명령 접수",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GateResponse" },
              },
            },
          },
        },
      },
    },
    "/api/gate/close": {
      post: {
        tags: ["Control"],
        summary: "차단기 닫기",
        responses: {
          200: {
            description: "차단기 닫기 명령 접수",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GateResponse" },
              },
            },
          },
        },
      },
    },
    "/api/vms": {
      post: {
        tags: ["Control"],
        summary: "전광판 문구 전송",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/VmsRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "전광판 문구 접수",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/VmsResponse" },
              },
            },
          },
        },
      },
    },
    "/api/wrongway": {
      post: {
        tags: ["Wrongway"],
        summary: "역주행 감지 이벤트 수신",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/WrongwayRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "이벤트 수신 및 대시보드 전파 완료",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OkResponse" },
              },
            },
          },
        },
      },
    },
    "/api/ingest/lidar/mock": {
      post: {
        tags: ["External Ingest"],
        summary: "라이다 PC mock HTTP 이벤트 수신",
        description: "실제 라이다 PC 데이터 규격 확정 전, JSON 수신 흐름을 테스트하기 위한 임시 ingest API입니다.",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LidarIngestRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "라이다 외부 이벤트 수신 완료",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ExternalIngestResponse" },
              },
            },
          },
        },
      },
    },
    "/api/ingest/control-board/mock": {
      post: {
        tags: ["External Ingest"],
        summary: "통합 제어보드 mock 패킷 수신",
        description: "RS-485 패킷 adapter 흐름을 HTTP로 먼저 테스트하기 위한 임시 API입니다. 이 단계에서는 CRC-8 실제 계산 검증은 수행하지 않습니다.",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ControlBoardMockRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "통합 제어보드 mock 패킷 수신 완료",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ExternalIngestResponse" },
              },
            },
          },
        },
      },
    },
    "/api/ingest/control-board/serial/test": {
      post: {
        tags: ["External Ingest"],
        summary: "통합 제어보드 serial reader 테스트",
        description: "실제 COM 포트를 열거나 serialport 의존성을 추가하지 않고, 현장 테스트에 필요한 포트/보드레이트/샘플 패킷 입력 형태만 확인합니다.",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ControlBoardSerialTestRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "serial reader 테스트 요청 접수",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ControlBoardSerialTestResponse" },
              },
            },
          },
        },
      },
    },
    "/api/ingest/events/recent": {
      get: {
        tags: ["External Ingest"],
        summary: "최근 외부 수신 이벤트 조회",
        parameters: [
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", example: 20 },
          },
        ],
        responses: {
          200: {
            description: "최근 외부 수신 이벤트 목록",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ExternalEvent" },
                },
              },
            },
          },
        },
      },
    },
    "/api/demo/start": {
      post: {
        tags: ["Demo"],
        summary: "감지 데모 시작",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          200: {
            description: "감지 데모 시작 완료",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DemoResponse" },
              },
            },
          },
          500: {
            description: "감지 데모 시작 실패",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/demo/reset": {
      post: {
        tags: ["Demo"],
        summary: "감지 데모 초기화",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          200: {
            description: "감지 데모 초기화 완료",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DemoResponse" },
              },
            },
          },
          500: {
            description: "감지 데모 초기화 실패",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      HealthResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          ts: { type: "string", format: "date-time" },
        },
      },
      OkResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: false },
          error: { type: "string" },
        },
      },
      DashboardState: {
        type: "object",
        properties: {
          siteId: { type: "string", example: "Site-01" },
          deviceId: { type: "string", example: "LIDAR-01" },
          todaysEvents: { type: "integer", example: 3 },
          vehiclesPassed: { type: "integer", example: 12842 },
          wrongWayEvents: { type: "integer", example: 2 },
          unidentified: { type: "integer", example: 24 },
          lidar: {
            type: "object",
            properties: {
              pts: { type: "integer", example: 2405 },
              hz: { type: "integer", example: 10 },
            },
          },
          gate: { type: "string", enum: ["OPENED", "CLOSED"], example: "CLOSED" },
          vmsLast: { type: "string", example: "" },
        },
      },
      LogItem: {
        type: "object",
        properties: {
          msg: { type: "string", example: "System boot completed" },
          time: { type: "string", example: "10:42:00 AM" },
        },
      },
      GateResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          gate: { type: "string", enum: ["OPENED", "CLOSED"], example: "OPENED" },
        },
      },
      VmsRequest: {
        type: "object",
        properties: {
          text: { type: "string", maxLength: 80, example: "역주행 차량 주의" },
        },
      },
      VmsResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          vmsLast: { type: "string", example: "역주행 차량 주의" },
        },
      },
      WrongwayRequest: {
        type: "object",
        properties: {
          id: { type: "string", example: "evt-001" },
          stage: { type: "integer", example: 1 },
          message: { type: "string", example: "구역: 출구-B" },
          timestamp: { type: "string", format: "date-time" },
          zone_id: { type: "string", example: "EXIT-B" },
          track_id: { type: "string", example: "track-12" },
          confidence: { type: "number", example: 0.92 },
          video_ts_ms: { type: "integer", example: 12345 },
          device_id: { type: "string", example: "LIDAR-01" },
          serial_no: { type: "string", example: "SN-001" },
        },
      },
      ExternalEvent: {
        type: "object",
        properties: {
          id: { type: "string", example: "evt-001" },
          source: { type: "string", example: "LIDAR_PC" },
          eventType: { type: "string", example: "WRONG_WAY" },
          stage: { type: "integer", example: 1 },
          siteId: { type: "string", example: "Site-01" },
          zoneId: { type: "string", example: "ROUNDABOUT-01" },
          deviceId: { type: "string", example: "LIDAR-01" },
          trackId: { type: "string", example: "track-001" },
          message: { type: "string", example: "라이다 역주행 감지 이벤트 수신" },
          externalOccurredAt: {
            type: "string",
            description: "외부 장비가 보낸 원본 시간 값입니다. 잘못된 형식이어도 데이터 확인을 위해 그대로 보관합니다.",
            nullable: true,
            example: "2026-06-22T10:15:30+09:00",
          },
          occurredAt: { type: "string", format: "date-time" },
          receivedAt: { type: "string", format: "date-time" },
          isOccurredAtValid: { type: "boolean", example: true },
          timeSkewMs: {
            type: "integer",
            nullable: true,
            example: -120,
            description: "외부 장비 시간과 백엔드 수신 시간의 차이입니다. 외부 장비 시간 - 백엔드 수신 시간 기준이며 단위는 ms입니다.",
          },
          confidence: { type: "number", example: 0.92 },
          rawPayload: {
            type: "object",
            additionalProperties: true,
            description: "현장 연동 테스트에서 실제 수신 데이터 형식을 확인하기 위한 원본 payload입니다. 운영 전에는 노출/저장 범위를 다시 제한해야 합니다.",
          },
          rawSummary: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
      LidarIngestRequest: {
        type: "object",
        additionalProperties: true,
        properties: {
          id: { type: "string", example: "evt-lidar-001" },
          stage: { type: "integer", example: 1 },
          zone_id: { type: "string", example: "ROUNDABOUT-01" },
          device_id: { type: "string", example: "LIDAR-01" },
          track_id: { type: "string", example: "track-001" },
          confidence: { type: "number", example: 0.92 },
          timestamp: { type: "string", format: "date-time" },
          message: { type: "string", example: "라이다 역주행 감지 이벤트 수신" },
        },
      },
      ControlBoardMockRequest: {
        type: "object",
        additionalProperties: true,
        properties: {
          packet: {
            oneOf: [
              { type: "string", example: "02 10 01 3A 03" },
              {
                type: "array",
                items: { type: "integer" },
                example: [2, 16, 1, 58, 3],
              },
            ],
          },
          command: { type: "string", enum: ["STAGE_1", "STAGE_2", "CLEAR", "UNKNOWN"], example: "STAGE_1" },
          crcValid: { type: "boolean", example: true },
          zone_id: { type: "string", example: "ROUNDABOUT-01" },
          device_id: { type: "string", example: "CONTROL-BOARD-01" },
        },
      },
      ControlBoardSerialTestRequest: {
        type: "object",
        properties: {
          port: { type: "string", example: "COM3" },
          baudRate: { type: "integer", example: 9600 },
          samplePacket: { type: "string", example: "02 10 01 3A 03" },
          command: { type: "string", example: "STAGE_1" },
        },
      },
      ExternalIngestResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          eventId: { type: "string", example: "evt-001" },
          receivedAt: { type: "string", format: "date-time" },
          event: { $ref: "#/components/schemas/ExternalEvent" },
        },
      },
      ControlBoardSerialTestResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          mode: { type: "string", example: "SERIAL_READER_NOT_CONNECTED" },
          serial: {
            type: "object",
            properties: {
              port: { type: "string", example: "COM3" },
              baudRate: { type: "integer", example: 9600 },
            },
          },
          event: { $ref: "#/components/schemas/ExternalEvent" },
        },
      },
      DemoResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          detector: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
    },
  },
};

module.exports = swaggerSpec;
