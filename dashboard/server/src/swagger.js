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
