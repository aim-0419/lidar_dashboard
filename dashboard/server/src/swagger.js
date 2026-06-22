const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "Lidar Dashboard API",
    version: "1.0.0",
    description: "Wrong-way detection dashboard backend API",
  },
  servers: [
    {
      url: "/",
      description: "Current backend server",
    },
  ],
  tags: [
    { name: "Health", description: "Server health check" },
    { name: "Dashboard", description: "Dashboard state and logs" },
    { name: "Control", description: "Gate and VMS control" },
    { name: "Wrongway", description: "Wrong-way detection events" },
    { name: "External Ingest", description: "External lidar and control-board event ingest" },
    { name: "Demo", description: "Detector demo controls" },
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "Check backend server health",
        responses: {
          200: {
            description: "Server is running",
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
        summary: "Get current dashboard state",
        responses: {
          200: {
            description: "Current in-memory dashboard state",
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
        summary: "Get recent dashboard logs",
        responses: {
          200: {
            description: "Recent logs",
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
        summary: "Open the barrier gate",
        responses: {
          200: {
            description: "Gate open command accepted",
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
        summary: "Close the barrier gate",
        responses: {
          200: {
            description: "Gate close command accepted",
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
        summary: "Send text to VMS",
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
            description: "VMS text accepted",
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
        summary: "Receive wrong-way detection event",
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
            description: "Event accepted and broadcasted",
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
        summary: "Receive mock lidar HTTP event",
        description: "Temporary ingest endpoint for lidar PC JSON tests before the real data contract is confirmed.",
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
            description: "External lidar event accepted",
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
        summary: "Receive mock control-board packet",
        description: "Temporary HTTP test endpoint for RS-485 packet adapter flow. CRC-8 is not verified in this step.",
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
            description: "Control-board mock packet accepted",
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
        summary: "Prepare control-board serial reader test",
        description: "Checks serial reader input shape without opening a real COM port or adding serialport dependency.",
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
            description: "Serial reader test request accepted",
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
        summary: "Get recent external ingest events",
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
            description: "Recent external events",
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
        summary: "Start detector demo",
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
            description: "Detector demo started",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DemoResponse" },
              },
            },
          },
          500: {
            description: "Detector demo start failed",
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
        summary: "Reset detector demo",
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
            description: "Detector demo reset",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DemoResponse" },
              },
            },
          },
          500: {
            description: "Detector demo reset failed",
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
          text: { type: "string", maxLength: 80, example: "Wrong-way warning" },
        },
      },
      VmsResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          vmsLast: { type: "string", example: "Wrong-way warning" },
        },
      },
      WrongwayRequest: {
        type: "object",
        properties: {
          id: { type: "string", example: "evt-001" },
          stage: { type: "integer", example: 1 },
          message: { type: "string", example: "Zone: EXIT-B" },
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
            description: "Original timestamp value received from the external device. Kept even when invalid.",
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
            description: "External occurredAt minus backend receivedAt in milliseconds.",
          },
          confidence: { type: "number", example: 0.92 },
          rawPayload: {
            type: "object",
            additionalProperties: true,
            description: "Temporary raw payload for field-test debugging. Restrict before production use.",
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
