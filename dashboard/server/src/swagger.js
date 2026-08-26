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
    { name: "Auth", description: "로그인과 인증 토큰 발급" },
    { name: "Users", description: "User management and profile APIs" },
    { name: "Database", description: "DB 연결과 기본 테이블 확인" },
    { name: "Sites", description: "현장 정보 조회" },
    { name: "Zones", description: "현장별 구역 조회" },
    { name: "Devices", description: "장비 목록/상세/상태 조회" },
    { name: "Dashboard", description: "대시보드 상태와 로그 조회" },
    { name: "Control", description: "차단기와 전광판 제어" },
    { name: "Control Board", description: "통합제어보드 원격 TCP 명령 전송" },
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
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "관리자 로그인",
        description:
          "userId와 password를 받아 사용자를 확인하고 accessToken은 응답 본문으로, refreshToken은 HttpOnly 쿠키로 발급합니다.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "로그인 성공",
            headers: {
              "Set-Cookie": {
                description: "HttpOnly refreshToken cookie",
                schema: {
                  type: "string",
                  example:
                    "refreshToken=jwt_refresh_token; HttpOnly; Path=/; SameSite=Lax",
                },
              },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginSuccessResponse" },
              },
            },
          },
          401: {
            description: "아이디 또는 비밀번호가 올바르지 않거나 비활성 사용자",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginFailResponse" },
              },
            },
          },
        },
      },
    },
    "/api/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "토큰 재발급",
        description: "HttpOnly cookie에 저장된 refreshToken을 검증해 새로운 accessToken을 발급합니다.",
        responses: {
          200: {
            description: "토큰 재발급 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    accessToken: { type: "string", example: "jwt_access_token" },
                  },
                },
              },
            },
          },
          401: {
            description: "refreshToken이 없거나 유효하지 않음",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    message: { type: "string", example: "유효하지 않은 refresh token입니다." },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/ws-ticket": {
      post: {
        tags: ["Auth"],
        summary: "WebSocket ticket issuance",
        description:
          "Issues a short-lived WebSocket connection ticket for authenticated users.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "WebSocket ticket issued successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WebSocketTicketResponse" },
              },
            },
          },
          401: {
            description: "Authentication failed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    message: { type: "string", example: "Authentication is required." },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "내 정보 조회",
        description: "현재 로그인한 사용자의 정보를 조회합니다.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "내 정보 조회 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    user: {
                      type: "object",
                      properties: {
                        id: { type: "string", example: "user_id" },
                        userId: { type: "string", example: "admin" },
                        name: { type: "string", example: "관리자" },
                        role: { type: "string", example: "super_admin" },
                        isActive: { type: "boolean", example: true },
                        lastLoginAt: { type: "string", format: "date-time", nullable: true },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "인증 실패",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    message: { type: "string", example: "유효하지 않은 토큰입니다." },
                  },
                },
              },
            },
          },
          404: {
            description: "사용자 정보를 찾을 수 없음",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    message: { type: "string", example: "사용자 정보를 찾을 수 없습니다." },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "로그아웃",
        description: "HttpOnly cookie에 저장된 refreshToken을 폐기하고 쿠키를 제거합니다.",
        responses: {
          200: {
            description: "로그아웃 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                  },
                },
              },
            },
          },
          500: {
            description: "로그아웃 처리 실패",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    message: { type: "string", example: "로그아웃 처리 중 오류가 발생했습니다." },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/users/me": {
      get: {
        tags: ["Users"],
        summary: "내 정보 조회",
        description: "현재 로그인한 사용자의 정보를 조회합니다.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "내 정보 조회 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    user: {
                      type: "object",
                      properties: {
                        id: { type: "string", example: "user_id" },
                        userId: { type: "string", example: "admin" },
                        name: { type: "string", example: "관리자" },
                        role: { type: "string", example: "super_admin" },
                        isActive: { type: "boolean", example: true },
                        lastLoginAt: { type: "string", format: "date-time", nullable: true },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "인증 실패",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    message: {
                      type: "string",
                      example: "유효하지 않은 토큰입니다.",
                    },
                  },
                },
              },
            },
          },
          404: {
            description: "사용자 정보를 찾을 수 없음",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    message: { type: "string", example: "사용자 정보를 찾을 수 없습니다." },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/users": {
      get: {
        tags: ["Users"],
        summary: "사용자 목록 조회",
        description: "관리자가 사용자 목록을 조회합니다.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "사용자 목록 조회 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    count: { type: "integer", example: 1 },
                    users: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", example: "user_id" },
                          userId: { type: "string", example: "admin" },
                          name: { type: "string", example: "admin" },
                          role: { type: "string", example: "super_admin" },
                          isActive: { type: "boolean", example: true },
                          lastLoginAt: { type: "string", format: "date-time", nullable: true },
                          createdAt: { type: "string", format: "date-time" },
                          updatedAt: { type: "string", format: "date-time" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "인증 실패",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    message: { type: "string", example: "인증이 필요합니다." },
                  },
                },
              },
            },
          },
          403: {
            description: "권한 없음",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    message: { type: "string", example: "권한이 없습니다." },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Users"],
        summary: "사용자 생성",
        description: "관리자가 새 사용자를 생성합니다.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["userId", "name", "password"],
                properties: {
                  userId: { type: "string", example: "manager01" },
                  name: { type: "string", example: "manager" },
                  password: { type: "string", example: "password123" },
                  role: { type: "string", example: "SUPER_ADMIN" },
                  isActive: { type: "boolean", example: true },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "사용자 생성 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    user: {
                      type: "object",
                      properties: {
                        id: { type: "string", example: "user_id" },
                        userId: { type: "string", example: "manager01" },
                        name: { type: "string", example: "manager" },
                        role: { type: "string", example: "super_admin" },
                        isActive: { type: "boolean", example: true },
                        lastLoginAt: { type: "string", format: "date-time", nullable: true },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "잘못된 요청 본문",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    message: { type: "string", example: "userId, name, password는 필수입니다." },
                  },
                },
              },
            },
          },
          409: {
            description: "이미 존재하는 사용자 ID",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    message: { type: "string", example: "이미 존재하는 사용자 ID입니다." },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/users/{id}": {
      get: {
        tags: ["Users"],
        summary: "사용자 상세 조회",
        description: "관리자가 사용자 상세 정보를 조회합니다.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            example: "user_id",
          },
        ],
        responses: {
          200: {
            description: "사용자 상세 조회 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    user: {
                      type: "object",
                      properties: {
                        id: { type: "string", example: "user_id" },
                        userId: { type: "string", example: "admin" },
                        name: { type: "string", example: "admin" },
                        role: { type: "string", example: "super_admin" },
                        isActive: { type: "boolean", example: true },
                        lastLoginAt: { type: "string", format: "date-time", nullable: true },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "인증 실패",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    message: { type: "string", example: "인증이 필요합니다." },
                  },
                },
              },
            },
          },
          403: {
            description: "권한 없음",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    message: { type: "string", example: "권한이 없습니다." },
                  },
                },
              },
            },
          },
          404: {
            description: "사용자를 찾을 수 없음",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    message: { type: "string", example: "사용자를 찾을 수 없습니다." },
                  },
                },
              },
            },
          },
        },
      },
      patch: {
        tags: ["Users"],
        summary: "사용자 수정",
        description: "관리자가 사용자 정보를 수정합니다.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            example: "user_id",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  userId: { type: "string", example: "manager02" },
                  name: { type: "string", example: "updated manager" },
                  role: { type: "string", example: "SUPER_ADMIN" },
                  isActive: { type: "boolean", example: true },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "사용자 수정 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    user: {
                      type: "object",
                      properties: {
                        id: { type: "string", example: "user_id" },
                        userId: { type: "string", example: "manager02" },
                        name: { type: "string", example: "updated manager" },
                        role: { type: "string", example: "super_admin" },
                        isActive: { type: "boolean", example: true },
                        lastLoginAt: { type: "string", format: "date-time", nullable: true },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "잘못된 요청 본문",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    message: { type: "string", example: "수정할 필드를 하나 이상 입력해야 합니다." },
                  },
                },
              },
            },
          },
          404: {
            description: "사용자를 찾을 수 없음",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    message: { type: "string", example: "사용자를 찾을 수 없습니다." },
                  },
                },
              },
            },
          },
          409: {
            description: "이미 존재하는 사용자 ID",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    message: { type: "string", example: "이미 존재하는 사용자 ID입니다." },
                  },
                },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Users"],
        summary: "사용자 삭제/비활성화",
        description: "관리자가 사용자를 비활성화합니다.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            example: "user_id",
          },
        ],
        responses: {
          200: {
            description: "사용자 비활성화 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    user: {
                      type: "object",
                      properties: {
                        id: { type: "string", example: "user_id" },
                        userId: { type: "string", example: "manager02" },
                        name: { type: "string", example: "updated manager" },
                        role: { type: "string", example: "super_admin" },
                        isActive: { type: "boolean", example: false },
                        lastLoginAt: { type: "string", format: "date-time", nullable: true },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
          },
          404: {
            description: "사용자를 찾을 수 없음",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    message: { type: "string", example: "사용자를 찾을 수 없습니다." },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/users/{id}/password": {
      patch: {
        tags: ["Users"],
        summary: "비밀번호 변경/초기화",
        description: "관리자가 사용자 비밀번호를 변경하거나 초기화합니다.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            example: "user_id",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["password"],
                properties: {
                  password: { type: "string", example: "newPassword123" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "비밀번호 변경 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    user: {
                      type: "object",
                      properties: {
                        id: { type: "string", example: "user_id" },
                        userId: { type: "string", example: "manager02" },
                        name: { type: "string", example: "updated manager" },
                        role: { type: "string", example: "super_admin" },
                        isActive: { type: "boolean", example: true },
                        lastLoginAt: { type: "string", format: "date-time", nullable: true },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "잘못된 요청 본문",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    message: { type: "string", example: "password는 필수입니다." },
                  },
                },
              },
            },
          },
          404: {
            description: "사용자를 찾을 수 없음",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    message: { type: "string", example: "사용자를 찾을 수 없습니다." },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/database/health": {
      get: {
        tags: ["Database"],
        summary: "DB 연결 상태 확인",
        description:
          "Prisma가 PostgreSQL에 정상 연결되는지 확인하고, 기본 테이블 상태를 함께 반환합니다. 마이그레이션과 seed 적용 여부를 Swagger에서 빠르게 확인하기 위한 API입니다.",
        responses: {
          200: {
            description: "DB 연결 및 기본 테이블 조회 성공",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DatabaseHealthResponse" },
              },
            },
          },
          503: {
            description: "DB 연결 또는 기본 테이블 조회 실패",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DatabaseHealthErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/sites": {
      get: {
        tags: ["Sites"],
        summary: "현장 목록 조회",
        description:
          "등록된 현장 목록을 반환합니다. 각 현장에 속한 구역과 장비 요약 정보를 함께 제공합니다.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "현장 목록 조회 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        count: { type: "integer", example: 1 },
                        sites: {
                          type: "array",
                          items: { type: "object", additionalProperties: true },
                        },
                      },
                    },
                    message: { type: "string", example: "OK" },
                  },
                },
              },
            },
          },
          503: {
            description: "현장 목록 조회 실패",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
    },
    "/api/sites/{id}": {
      get: {
        tags: ["Sites"],
        summary: "현장 상세 조회",
        description: "현장 하나의 상세 정보를 반환합니다. 해당 현장에 속한 구역과 장비 정보를 함께 제공합니다.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            example: "site-wolchulsan-rest-area",
          },
        ],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "현장 상세 조회 성공",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          404: {
            description: "현장을 찾을 수 없음",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          503: {
            description: "현장 상세 조회 실패",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
    },
    "/api/zones": {
      get: {
        tags: ["Zones"],
        summary: "구역 목록 조회",
        description: "등록된 전체 구역 목록을 반환합니다. 각 구역의 소속 현장 요약과 장비 정보를 함께 제공합니다.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "구역 목록 조회 성공",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          503: {
            description: "구역 목록 조회 실패",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
    },
    "/api/zones/{id}": {
      get: {
        tags: ["Zones"],
        summary: "구역 상세 조회",
        description: "구역 하나의 상세 정보를 반환합니다. 소속 현장 요약과 장비 목록을 함께 제공합니다.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            example: "zone-roundabout-01",
          },
        ],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "구역 상세 조회 성공",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          404: {
            description: "구역을 찾을 수 없음",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          503: {
            description: "구역 상세 조회 실패",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
    },
    "/api/sites/{siteId}/zones": {
      get: {
        tags: ["Zones"],
        summary: "현장별 구역 조회",
        description: "특정 현장에 속한 구역 목록을 반환합니다.",
        parameters: [
          {
            name: "siteId",
            in: "path",
            required: true,
            schema: { type: "string" },
            example: "site-wolchulsan-rest-area",
          },
        ],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "현장별 구역 조회 성공",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          404: {
            description: "현장을 찾을 수 없음",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          503: {
            description: "현장별 구역 조회 실패",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
    },
    "/api/devices": {
      get: {
        tags: ["Devices"],
        summary: "장비 목록 조회",
        description: "등록된 전체 장비 목록을 반환합니다. 각 장비의 소속 구역과 현장 요약 정보를 함께 제공합니다.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "장비 목록 조회 성공",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          503: {
            description: "장비 목록 조회 실패",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
    },
    "/api/devices/{id}": {
      get: {
        tags: ["Devices"],
        summary: "장비 상세 조회",
        description: "장비 하나의 상세 정보를 반환합니다. 소속 구역과 현장 요약 정보를 함께 제공합니다.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            example: "device-lidar-pc-01",
          },
        ],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "장비 상세 조회 성공",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          404: {
            description: "장비를 찾을 수 없음",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          503: {
            description: "장비 상세 조회 실패",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
    },
    "/api/devices/{id}/status": {
      get: {
        tags: ["Devices"],
        summary: "장비 상태 조회",
        description: "장비 하나의 상태 정보만 간단하게 반환합니다.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            example: "device-lidar-pc-01",
          },
        ],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "장비 상태 조회 성공",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          404: {
            description: "장비를 찾을 수 없음",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          503: {
            description: "장비 상태 조회 실패",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
    },
    "/api/zones/{zoneId}/devices": {
      get: {
        tags: ["Devices"],
        summary: "구역별 장비 조회",
        description: "특정 구역에 속한 장비 목록을 반환합니다.",
        parameters: [
          {
            name: "zoneId",
            in: "path",
            required: true,
            schema: { type: "string" },
            example: "zone-roundabout-01",
          },
        ],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "구역별 장비 조회 성공",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          404: {
            description: "구역을 찾을 수 없음",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          503: {
            description: "구역별 장비 조회 실패",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
    },
    "/api/statistics/summary": {
      get: {
        tags: ["Dashboard"],
        summary: "통계 요약 조회",
        description: "선택한 기간의 누적 교통 통계를 조회합니다.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "period",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["daily", "weekly", "monthly", "custom"],
              default: "daily",
            },
            example: "daily",
          },
          {
            name: "startDate",
            in: "query",
            required: false,
            schema: { type: "string", format: "date" },
            example: "2026-08-01",
          },
          {
            name: "endDate",
            in: "query",
            required: false,
            schema: { type: "string", format: "date" },
            example: "2026-08-03",
          },
          {
            name: "siteId",
            in: "query",
            required: false,
            schema: { type: "string" },
            example: "site-wolchulsan-rest-area",
          },
          {
            name: "zoneId",
            in: "query",
            required: false,
            schema: { type: "string" },
            example: "cmzone123",
          },
        ],
        responses: {
          200: {
            description: "통계 요약 조회 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    period: { type: "string", example: "daily" },
                    bucketUnit: { type: "string", example: "hour" },
                    range: {
                      type: "object",
                      properties: {
                        startAt: { type: "string", format: "date-time" },
                        endAt: { type: "string", format: "date-time" },
                      },
                    },
                    summary: {
                      type: "object",
                      properties: {
                        totalVehicles: { type: "integer", example: 24 },
                        wrongWayEvents: { type: "integer", example: 0 },
                        wrongWayRate: { type: "number", example: 0 },
                        pedestrianCount: { type: "integer", example: 0 },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "잘못된 query parameter",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    message: {
                      type: "string",
                      example: "period must be one of daily, weekly, monthly, or custom.",
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "인증 실패",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    message: { type: "string", example: "인증이 필요합니다." },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/statistics/traffic-series": {
      get: {
        tags: ["Dashboard"],
        summary: "기간별 통과 차량 시계열 조회",
        description:
          "일별, 주별, 월별, 사용자 지정 기간 기준으로 통과 차량 시계열 데이터를 조회합니다.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "period",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["daily", "weekly", "monthly", "custom"],
              default: "daily",
            },
            example: "daily",
          },
          {
            name: "startDate",
            in: "query",
            required: false,
            schema: { type: "string", format: "date" },
            example: "2026-08-01",
            description: "period가 custom일 때 시작 날짜",
          },
          {
            name: "endDate",
            in: "query",
            required: false,
            schema: { type: "string", format: "date" },
            example: "2026-08-03",
            description: "period가 custom일 때 종료 날짜",
          },
          {
            name: "siteId",
            in: "query",
            required: false,
            schema: { type: "string" },
            example: "site-wolchulsan-rest-area",
          },
          {
            name: "zoneId",
            in: "query",
            required: false,
            schema: { type: "string" },
            example: "cmzone123",
          },
        ],
        responses: {
          200: {
            description: "통계 시계열 조회 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    period: { type: "string", example: "custom" },
                    bucketUnit: { type: "string", example: "day" },
                    range: {
                      type: "object",
                      properties: {
                        startAt: {
                          type: "string",
                          format: "date-time",
                          example: "2026-08-01T00:00:00.000Z",
                        },
                        endAt: {
                          type: "string",
                          format: "date-time",
                          example: "2026-08-04T00:00:00.000Z",
                        },
                      },
                    },
                    series: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          label: { type: "string", example: "08/01" },
                          value: { type: "integer", example: 12 },
                          startAt: {
                            type: "string",
                            format: "date-time",
                            example: "2026-08-01T00:00:00.000Z",
                          },
                          endAt: {
                            type: "string",
                            format: "date-time",
                            example: "2026-08-01T23:59:59.000Z",
                          },
                        },
                      },
                    },
                    summary: {
                      type: "object",
                      properties: {
                        totalVehicles: { type: "integer", example: 30 },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "잘못된 query parameter",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    message: {
                      type: "string",
                      example: "startDate is required when period is custom.",
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "인증 실패",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: false },
                    message: { type: "string", example: "인증이 필요합니다." },
                  },
                },
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
        description: "메모리에 저장된 현재 대시보드 상태 정보를 조회합니다.",
        responses: {
          200: {
            description: "현재 대시보드 상태 조회 성공",
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
        description: "메모리에 저장된 최근 대시보드 로그 목록을 조회합니다.",
        responses: {
          200: {
            description: "최근 대시보드 로그 조회 성공",
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
        description: "차단기 열기 명령을 전송합니다.",
        responses: {
          200: {
            description: "차단기 열기 명령 접수 성공",
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
        description: "차단기 닫기 명령을 전송합니다.",
        responses: {
          200: {
            description: "차단기 닫기 명령 접수 성공",
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
        description: "전광판에 표시할 문구를 전송합니다.",
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
            description: "전광판 문구 전송 성공",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/VmsResponse" },
              },
            },
          },
        },
      },
    },
    "/api/control/status": {
      get: {
        tags: ["Control"],
        summary: "제어 상태 조회",
        description:
          "차단기, 전광판, 경광등 등 현재 제어 상태를 조회합니다. 현재는 DB가 아닌 메모리 상태를 기준으로 반환합니다.",
        responses: {
          200: {
            description: "현재 제어 상태 조회 성공",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ControlStatusResponse" },
              },
            },
          },
        },
      },
    },
    "/api/control-board/commands": {
      post: {
        tags: ["Control Board"],
        summary: "통합제어보드 명령 전송",
        description:
          "대시보드 서버가 통합제어보드로 TCP 명령을 전송합니다. dryRun이 true이면 실제 전송 없이 프레임 생성과 검증만 수행합니다.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ControlBoardCommandRequest" },
            },
          },
        },
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "통합제어보드 명령 전송 성공",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ControlBoardCommandResponse" },
              },
            },
          },
          400: {
            description: "잘못된 요청 또는 통합제어보드 설정 오류",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          502: {
            description: "통합제어보드 TCP 전송 실패",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      get: {
        tags: ["Control Board"],
        summary: "최근 통합제어보드 명령 목록 조회",
        description: "최근 전송된 통합제어보드 명령 목록을 조회합니다.",
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
            description: "최근 통합제어보드 명령 목록 조회 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    items: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ControlBoardCommandResponse" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/control-board/commands/{id}": {
      get: {
        tags: ["Control Board"],
        summary: "통합제어보드 명령 결과 조회",
        description: "명령 ID 기준으로 통합제어보드 명령 결과를 조회합니다.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", example: "cmd_123456" },
          },
        ],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "통합제어보드 명령 결과 조회 성공",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    item: { $ref: "#/components/schemas/ControlBoardCommandResponse" },
                  },
                },
              },
            },
          },
          404: {
            description: "해당 명령 ID를 찾을 수 없음",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/wrongway": {
      post: {
        tags: ["Wrongway"],
        summary: "라이다 역주행/정주행 이벤트 수신",
        description:
          "라이다 PC에서 전송한 이벤트 payload를 수신합니다. normal-driving은 VehicleTrack을 갱신하고, wrong-way-level-1은 TrafficEvent와 EventLog를 함께 저장합니다.",
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
            description: "정주행 track 갱신 또는 중복/미대상 이벤트 처리 완료",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WrongwayReceiveResult" },
              },
            },
          },
          201: {
            description: "역주행 등 이벤트 신규 저장 완료",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WrongwayReceiveResult" },
              },
            },
          },
          400: {
            description: "필수 payload 값 누락",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          500: {
            description: "역주행 데이터 수신 처리 오류",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/wrongway/history": {
      get: {
        tags: ["Wrongway"],
        summary: "이벤트 이력 페이지 조회",
        description:
          "traffic_events에 저장된 이벤트를 페이지 단위로 조회합니다. 보행자 필터는 진입과 이탈 이벤트를 함께 포함하며, sortBy와 sortOrder로 전체 결과의 정렬 기준을 지정할 수 있습니다.",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
          {
            name: "eventType",
            in: "query",
            schema: {
              type: "string",
              enum: ["wrong-way", "situation-ended", "pedestrian", "pedestrian-entered", "pedestrian-exited"],
            },
          },
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["NEW", "CONFIRMED", "RESOLVED", "FALSE_ALARM"] },
          },
          {
            name: "zoneId",
            in: "query",
            description: "내부 DB 구역 ID 기준 필터",
            schema: { type: "string", example: "zone-roundabout-01" },
          },
          { name: "externalZoneId", in: "query", schema: { type: "string", example: "Z455" } },
          {
            name: "search",
            in: "query",
            description: "이벤트 ID, track_id, 외부 구역 ID, 내부 구역명/코드, 메시지 통합 검색",
            schema: { type: "string", example: "회전" },
          },
          { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
          {
            name: "sortBy",
            in: "query",
            description: "정렬할 이벤트 필드",
            schema: {
              type: "string",
              enum: ["occurredAt", "eventType", "zone", "trackId", "speedKmh", "status"],
              default: "occurredAt",
            },
          },
          {
            name: "sortOrder",
            in: "query",
            description: "정렬 방향",
            schema: { type: "string", enum: ["asc", "desc"], default: "desc" },
          },
        ],
        responses: {
          200: {
            description: "이벤트 이력 조회 성공",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EventHistoryResponse" },
              },
            },
          },
          400: {
            description: "페이지 또는 필터 값이 올바르지 않음",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          500: {
            description: "이벤트 이력 조회 오류",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/events/{id}/status": {
      patch: {
        tags: ["Wrongway"],
        summary: "관리자 이벤트 처리 상태 변경",
        description:
          "관리자가 이벤트의 업무 처리 상태를 변경하고 event_logs에 변경 이력을 기록합니다. 통합제어보드나 물리 장비는 제어하지 않습니다.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "상태를 변경할 이벤트 ID",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/EventStatusUpdateRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "이벤트 상태 변경 또는 동일 상태 확인",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EventStatusUpdateResponse" },
              },
            },
          },
          400: { description: "지원하지 않는 상태 값" },
          401: { description: "인증 토큰이 없거나 유효하지 않음" },
          404: { description: "이벤트를 찾을 수 없음" },
          500: { description: "이벤트 상태 변경 오류" },
        },
      },
    },
    "/api/events/{id}": {
      get: {
        tags: ["Wrongway"],
        summary: "이벤트 상세 조회",
        description:
          "관제 화면에서 선택한 이벤트의 객체·시간·구역·라이다 PC 정보와 저장된 원본 payload를 조회합니다. 목록 API에는 원본 payload를 포함하지 않습니다.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "상세 조회할 이벤트 ID",
          },
        ],
        responses: {
          200: {
            description: "이벤트 상세 조회 성공",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EventDetailResponse" },
              },
            },
          },
          401: { description: "인증 토큰이 없거나 유효하지 않음" },
          404: { description: "이벤트를 찾을 수 없음" },
          500: { description: "이벤트 상세 조회 오류" },
        },
      },
    },
    "/api/wrongway/test-payloads": {
      get: {
        tags: ["Wrongway"],
        summary: "테스트 payload 및 API URL 조회",
        description:
          "역주행/정주행 테스트용 payload 예시와 Swagger 테스트용 API URL 목록을 조회합니다.",
        responses: {
          200: {
            description: "테스트 payload 조회 성공",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WrongwayTestPayloadsResponse" },
              },
            },
          },
        },
      },
    },
    "/api/wrongway/test/normal": {
      post: {
        tags: ["Wrongway"],
        security: [{ bearerAuth: [] }],
        summary: "정주행 테스트 데이터 1회 전송",
        description:
          "정주행 payload를 1회 생성해 기존 /api/wrongway 처리 흐름으로 전송합니다. VehicleTrack upsert 동작을 확인할 때 사용합니다.",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/WrongwayTestOptions" },
            },
          },
        },
        responses: {
          200: {
            description: "정주행 테스트 데이터 처리 완료",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WrongwayTestSendResponse" },
              },
            },
          },
        },
      },
    },
    "/api/wrongway/test/normal-stream/start": {
      post: {
        tags: ["Wrongway"],
        security: [{ bearerAuth: [] }],
        summary: "정주행 테스트 데이터 1초 간격 전송 시작",
        description:
          "서버 내부에서 1초마다 normal-driving payload를 생성해 기존 /api/wrongway 처리 흐름으로 전송합니다. 같은 track_id를 반복 전송해 VehicleTrack upsert 동작을 확인할 때 사용합니다.",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/WrongwayTestOptions" },
            },
          },
        },
        responses: {
          200: {
            description: "정주행 테스트 스트림 시작 또는 이미 실행 중",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/NormalDrivingStreamStatus" },
              },
            },
          },
        },
      },
    },
    "/api/wrongway/test/normal-stream/stop": {
      post: {
        tags: ["Wrongway"],
        security: [{ bearerAuth: [] }],
        summary: "정주행 테스트 데이터 1초 간격 전송 중지",
        description: "실행 중인 정주행 테스트 스트림 전송을 중지합니다.",
        responses: {
          200: {
            description: "정주행 테스트 스트림 중지 성공",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/NormalDrivingStreamStatus" },
              },
            },
          },
        },
      },
    },
    "/api/wrongway/test/normal-stream/status": {
      get: {
        tags: ["Wrongway"],
        security: [{ bearerAuth: [] }],
        summary: "정주행 테스트 스트림 상태 조회",
        description: "현재 정주행 테스트 스트림이 실행 중인지 상태를 조회합니다.",
        responses: {
          200: {
            description: "정주행 테스트 스트림 상태 조회 성공",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/NormalDrivingStreamStatus" },
              },
            },
          },
        },
      },
    },
    "/api/wrongway/test/mixed-snapshot": {
      post: {
        tags: ["Wrongway"],
        security: [{ bearerAuth: [] }],
        summary: "정주행·역주행 혼합 snapshot 테스트",
        description:
          "normal-driving과 wrong-way 객체를 한 snapshot으로 보내 객체별 upsert, 사건 생성, 이벤트 저장을 확인합니다.",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/WrongwayTestOptions" },
            },
          },
        },
        responses: {
          200: {
            description: "역주행 테스트 데이터 처리 완료 또는 중복 처리",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WrongwayTestSendResponse" },
              },
            },
          },
          201: {
            description: "역주행 이벤트 신규 저장",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WrongwayTestSendResponse" },
              },
            },
          },
        },
      },
    },
    "/api/ingest/lidar": {
      post: {
        tags: ["External Ingest"],
        summary: "라이다 PC 실제 HTTP 이벤트 수신",
        description: "현장 라이다 PC가 실제로 전송하는 JSON payload를 수신하는 API입니다. 수신한 원본 데이터는 현장 연동 확인을 위해 rawPayload로 함께 반환합니다.",
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
            description: "라이다 실제 이벤트 수신 성공",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ExternalIngestResponse" },
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
        description: "개발 환경이나 Swagger, curl 테스트에서 라이다 수신 흐름을 확인하기 위한 mock API입니다. 실제 라이다 PC 연동 시에는 /api/ingest/lidar를 사용합니다.",
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
            description: "라이다 mock 이벤트 수신 성공",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ExternalIngestResponse" },
              },
            },
          },
        },
      },
    },
    "/api/ingest/control-board": {
      post: {
        tags: ["External Ingest"],
        summary: "통합제어보드 실제 HTTP 패킷 수신",
        description:
          "통합제어보드 또는 중간 브리지 프로그램이 실제 패킷을 HTTP JSON 형태로 전달할 때 사용하는 API입니다. 내부에서는 mock과 동일한 parser와 adapter 흐름을 사용합니다.",
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
            description: "통합제어보드 실제 패킷 수신 성공",
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
        summary: "통합제어보드 mock 패킷 수신",
        description: "RS-485 10바이트 패킷 adapter 흐름을 HTTP로 먼저 테스트하기 위한 API입니다. packet 값이 있으면 Byte 1~6 기준 CRC-8/SMBUS를 계산해 Byte 7과 비교합니다.",
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
            description: "통합제어보드 mock 패킷 수신 성공",
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
        summary: "통합제어보드 시리얼 리더 테스트",
        description: "실제 COM 포트를 열거나 serialport 의존성을 추가하지 않고, 현장 테스트에 필요한 포트와 보드레이트, 샘플 패킷 입력 형태만 확인하는 API입니다.",
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
            description: "시리얼 리더 테스트 요청 접수 성공",
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
        description: "최근 수신된 외부 연동 이벤트 목록을 조회합니다.",
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
            description: "최근 외부 수신 이벤트 목록 조회 성공",
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
    "/api/ingest/status": {
      get: {
        tags: ["External Ingest"],
        summary: "외부 수신 상태 조회",
        description:
          "라이다 PC와 통합제어보드에서 최근 수신된 이벤트를 기준으로 마지막 수신 시각, 최근 오류 패킷 수, 최근 오류 이벤트를 요약해 반환합니다.",
        responses: {
          200: {
            description: "외부 수신 상태 조회 성공",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/IngestStatusResponse" },
              },
            },
          },
        },
      },
    },
    "/api/demo/start": {
      post: {
        tags: ["Demo"],
        summary: "데모 시작",
        description: "데모 상태를 시작하고 테스트용 데이터를 초기화하거나 재생합니다.",
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
            description: "데모 시작 성공",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DemoResponse" },
              },
            },
          },
          500: {
            description: "데모 시작 실패",
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
        summary: "데모 초기화",
        description: "현재 데모 상태를 초기화하고 기본 상태로 되돌립니다.",
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
            description: "데모 초기화 성공",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DemoResponse" },
              },
            },
          },
          500: {
            description: "데모 초기화 실패",
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
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      HealthResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          ts: { type: "string", format: "date-time" },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["userId", "password"],
        properties: {
          userId: { type: "string", example: "admin" },
          password: { type: "string", example: "password" },
        },
      },
      LoginUser: {
        type: "object",
        properties: {
          id: { type: "string", example: "user_id" },
          userId: { type: "string", example: "admin" },
          name: { type: "string", example: "관리자" },
          role: { type: "string", example: "super_admin" },
        },
      },
      LoginSuccessResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          accessToken: { type: "string", example: "jwt_access_token" },
          user: { $ref: "#/components/schemas/LoginUser" },
        },
      },
      WebSocketTicketResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          ticket: { type: "string", example: "jwt_websocket_ticket" },
          expiresInSeconds: { type: "integer", example: 30 },
        },
      },
      LoginFailResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: false },
          message: {
            type: "string",
            example: "아이디 또는 비밀번호가 올바르지 않습니다.",
          },
        },
      },
      DatabaseHealthResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          checkedAt: { type: "string", format: "date-time" },
          database: { type: "string", example: "postgresql" },
          tables: {
            type: "object",
            properties: {
              users: { type: "integer", example: 0 },
              sites: { type: "integer", example: 1 },
              zones: { type: "integer", example: 2 },
              devices: { type: "integer", example: 4 },
              vehicleTracks: { type: "integer", example: 0 },
              trafficEvents: { type: "integer", example: 0 },
              eventLogs: { type: "integer", example: 0 },
            },
          },
        },
      },
      DatabaseHealthErrorResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: false },
          checkedAt: { type: "string", format: "date-time" },
          message: {
            type: "string",
            example: "DB 연결 또는 기본 테이블 조회에 실패했습니다.",
          },
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
      ControlStatusResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          checkedAt: { type: "string", format: "date-time" },
          siteId: { type: "string", example: "Site-01" },
          deviceId: { type: "string", example: "LIDAR-01" },
          gate: { type: "string", enum: ["OPENED", "CLOSED"], example: "CLOSED" },
          vmsLast: { type: "string", example: "역주행 차량 주의" },
          lidar: {
            type: "object",
            properties: {
              pts: { type: "integer", example: 2405 },
              hz: { type: "integer", example: 10 },
            },
          },
          counters: {
            type: "object",
            properties: {
              todaysEvents: { type: "integer", example: 3 },
              newEvents: { type: "integer", example: 1 },
              wrongWayEvents: { type: "integer", example: 2 },
              vehiclesPassed: { type: "integer", example: 12842 },
            },
          },
        },
      },
      ControlBoardCommandRequest: {
        type: "object",
        required: ["commandType"],
        properties: {
          commandType: {
            type: "string",
            enum: [
              "STAGE_1_ON",
              "STAGE_2_ON",
              "STAGE_2_RETURN",
              "SYSTEM_RESET",
              "warning_level_1",
              "warning_level_2",
              "situation_ended",
            ],
            example: "STAGE_1_ON",
            description: "기존 현장 테스트용 명령입니다. 신규 장비별 프로토콜은 확정 후 별도로 반영합니다.",
          },
          zoneId: { type: "string", example: "zone-1" },
          reason: { type: "string", example: "manual-test" },
          host: {
            type: "string",
            example: "192.168.0.10",
            description: ".env의 CONTROL_BOARD_HOST 대신 일시적으로 테스트 IP를 지정할 때 사용합니다.",
          },
          port: {
            type: "integer",
            example: 5000,
            description: ".env의 CONTROL_BOARD_PORT 대신 일시적으로 테스트 port를 지정할 때 사용합니다.",
          },
          timeoutMs: { type: "integer", example: 3000 },
          dryRun: {
            type: "boolean",
            example: true,
            description: "true이면 실제 TCP 전송 없이 10바이트 패킷과 CRC-8 계산 결과만 확인합니다.",
          },
        },
      },
      ControlBoardCommandResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          commandId: { type: "string", example: "cmd_123456" },
          commandType: { type: "string", example: "STAGE_1_ON" },
          status: {
            type: "string",
            enum: ["dry-run", "pending", "ack-received", "sent-timeout", "send-failed"],
            example: "dry-run",
          },
          host: { type: "string", nullable: true, example: "192.168.0.10" },
          port: { type: "integer", nullable: true, example: 5000 },
          requestedAt: { type: "string", format: "date-time" },
          sentAt: { type: "string", format: "date-time", nullable: true },
          ackAt: { type: "string", format: "date-time", nullable: true },
          ackReceived: { type: "boolean", example: false },
          timeout: { type: "boolean", example: false },
          packet: {
            type: "object",
            properties: {
              hexString: {
                type: "string",
                example: "02 A1 10 01 01 02 00 49 03 0D",
              },
              parsed: { type: "object", additionalProperties: true },
            },
          },
          ack: {
            type: "object",
            nullable: true,
            additionalProperties: true,
          },
        },
      },
      WrongwayRequest: {
        type: "object",
        required: ["timestamp", "source", "objects"],
        properties: {
          timestamp: { type: "string", example: "2026-01-13T14:43:53.860089+09:00" },
          source: { type: "string", example: "lidar-pc-01" },
          status: { type: "string", enum: ["normal-driving", "wrong-way", "situation-ended"], example: "wrong-way" },
          total_objects: { type: "integer", example: 2 },
          moving_vehicle_count: { type: "integer", example: 2 },
          normal_moving_vehicle_count: { type: "integer", example: 1 },
          wrong_way_count: { type: "integer", example: 1 },
          processing_time_ms: { type: "number", example: 8.518 },
          objects: { type: "array", minItems: 1, items: { $ref: "#/components/schemas/WrongwayObject" } },
        },
      },
      WrongwayObject: {
        type: "object",
        required: ["type", "zone_id", "track_id"],
        properties: {
          type: { type: "string", enum: ["normal-driving", "wrong-way", "situation-ended", "pedestrian-entered", "pedestrian-exited"] },
          warning_level: { type: "integer", enum: [0, 1], example: 1 },
          confidence: { type: "number", example: 0.95 },
          zone_id: { type: "string", example: "Z455" },
          track_id: { type: "string", example: "track-wrongway-001" },
          message: { type: "string", example: "역주행 발생" },
          speed_ms: { type: "number", example: 2.8 },
          speed_kmh: { type: "number", example: 10.08 },
          object_class: { type: "integer", example: 1 },
          description: { type: "string", example: "Wrong-way driving detected" },
        },
      },
      WrongwayTestOptions: {
        type: "object",
        properties: {
          trackId: {
            type: "string",
            example: "test-normal-track-001",
            description: "테스트용 track_id를 직접 지정할 때 사용합니다.",
          },
          zoneId: {
            type: "string",
            example: "Z261",
            description: "테스트용 zone_id를 직접 지정할 때 사용합니다.",
          },
        },
      },
      WrongwayReceiveResult: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          source: { type: "string", example: "lidar-pc-01" },
          status: { type: "string", example: "wrong-way" },
          summary: { type: "object", additionalProperties: true },
          warnings: { type: "array", items: { type: "string" } },
          results: { type: "array", items: { type: "object", additionalProperties: true } },
          receivedAt: { type: "string", format: "date-time" },
        },
      },
      EventHistoryItem: {
        type: "object",
        properties: {
          id: { type: "string", example: "cm_event_id" },
          eventCode: { type: "string", nullable: true },
          eventType: { type: "string", example: "wrong-way" },
          status: { type: "string", example: "NEW" },
          occurredAt: { type: "string", format: "date-time", nullable: true },
          receivedAt: { type: "string", format: "date-time" },
          zone: {
            type: "object",
            nullable: true,
            properties: {
              id: { type: "string" },
              code: { type: "string", nullable: true },
              name: { type: "string" },
            },
          },
          externalZoneId: { type: "string", nullable: true, example: "Z455" },
          trackId: { type: "string", nullable: true, example: "track-001" },
          warningLevel: { type: "integer", nullable: true, example: 1 },
          confidence: { type: "number", nullable: true, example: 0.95 },
          message: { type: "string", nullable: true, example: "역주행 발생" },
          speedKmh: { type: "number", nullable: true, example: 10.08 },
          objectClass: { type: "integer", nullable: true, example: 1 },
          description: { type: "string", nullable: true },
        },
      },
      EventHistoryResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: {
            type: "object",
            properties: {
              items: { type: "array", items: { $ref: "#/components/schemas/EventHistoryItem" } },
              pagination: {
                type: "object",
                properties: {
                  page: { type: "integer", example: 1 },
                  limit: { type: "integer", example: 20 },
                  total: { type: "integer", example: 42 },
                  totalPages: { type: "integer", example: 3 },
                  hasPrevious: { type: "boolean", example: false },
                  hasNext: { type: "boolean", example: true },
                },
              },
              filters: { type: "object", additionalProperties: true },
            },
          },
          message: { type: "string", example: "OK" },
        },
      },
      EventDetailItem: {
        allOf: [
          { $ref: "#/components/schemas/EventHistoryItem" },
          {
            type: "object",
            properties: {
              speedMs: { type: "number", nullable: true, example: 2.8 },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
              zone: {
                type: "object",
                nullable: true,
                properties: {
                  id: { type: "string" },
                  code: { type: "string", nullable: true, example: "Z455" },
                  name: { type: "string", example: "회전교차로 영역 1" },
                  site: {
                    type: "object",
                    nullable: true,
                    properties: {
                      id: { type: "string" },
                      name: { type: "string", example: "월출산휴게소" },
                    },
                  },
                },
              },
              device: {
                type: "object",
                nullable: true,
                properties: {
                  id: { type: "string" },
                  code: { type: "string", nullable: true, example: "LIDAR-PC-01" },
                  name: { type: "string", example: "회전교차로 1 라이다 PC" },
                  type: { type: "string", example: "LIDAR_PC" },
                },
              },
              rawPayload: {
                type: "object",
                additionalProperties: true,
                description: "해당 이벤트의 상위 snapshot 요약과 라이다 객체 원본 데이터",
              },
            },
          },
        ],
      },
      EventDetailResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: {
            type: "object",
            properties: {
              event: { $ref: "#/components/schemas/EventDetailItem" },
            },
          },
          message: { type: "string", example: "OK" },
        },
      },
      EventStatusUpdateRequest: {
        type: "object",
        required: ["status"],
        properties: {
          status: {
            type: "string",
            enum: ["NEW", "CONFIRMED", "RESOLVED", "FALSE_ALARM"],
            example: "CONFIRMED",
          },
          memo: {
            type: "string",
            example: "현장 확인 결과 실제 역주행으로 판단",
          },
        },
      },
      EventStatusUpdateResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: {
            type: "object",
            properties: {
              event: { $ref: "#/components/schemas/EventHistoryItem" },
              previousStatus: { type: "string", example: "NEW" },
              changed: { type: "boolean", example: true },
            },
          },
          message: { type: "string", example: "이벤트 상태가 변경되었습니다." },
        },
      },
      WrongwayTestSendResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          payload: { $ref: "#/components/schemas/WrongwayRequest" },
          result: { $ref: "#/components/schemas/WrongwayReceiveResult" },
        },
      },
      WrongwayTestPayloadsResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          endpoint: { type: "string", example: "http://localhost:5000/api/wrongway" },
          note: { type: "string" },
          testApis: {
            type: "object",
            additionalProperties: { type: "string" },
          },
          payloads: {
            type: "object",
            properties: {
              normalDriving: { $ref: "#/components/schemas/WrongwayRequest" },
              wrongWay: { $ref: "#/components/schemas/WrongwayRequest" },
            },
          },
        },
      },
      NormalDrivingStreamStatus: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          running: { type: "boolean", example: true },
          startedAt: { type: "string", format: "date-time", nullable: true },
          stoppedAt: { type: "string", format: "date-time", nullable: true },
          sentCount: { type: "integer", example: 3 },
          intervalMs: { type: "integer", example: 1000 },
          trackId: { type: "string", example: "test-normal-track-001" },
          zoneId: { type: "string", example: "Z261" },
          lastResult: {
            nullable: true,
            oneOf: [{ $ref: "#/components/schemas/WrongwayReceiveResult" }],
          },
          lastError: {
            type: "object",
            nullable: true,
            additionalProperties: true,
          },
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
            description: "외부 장비가 보낸 원본 시각 값입니다. 잘못된 형식 여부 확인을 위해 그대로 보관합니다.",
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
            description: "외부 장비 시각과 백엔드 수신 시각의 차이입니다. 외부 장비 시각 - 백엔드 수신 시각 기준이며 단위는 ms입니다.",
          },
          confidence: { type: "number", example: 0.92 },
          rawPayload: {
            type: "object",
            additionalProperties: true,
            description: "현장 연동 테스트에서 실제 수신 데이터 형식을 확인하기 위한 원본 payload입니다. 운영 전에는 노출 범위를 다시 제한해야 합니다.",
          },
          rawSummary: {
            type: "object",
            additionalProperties: true,
            description: "원본 payload의 필드 목록, 크기, 제어보드 패킷 파싱 결과, CRC 검증 결과 등을 담는 진단 정보입니다.",
          },
        },
      },
      IngestStatusResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          checkedAt: { type: "string", format: "date-time" },
          storage: { type: "string", example: "MEMORY" },
          totalRecentEvents: { type: "integer", example: 5 },
          invalidRecentEvents: { type: "integer", example: 1 },
          lastReceivedAt: { type: "string", format: "date-time", nullable: true },
          lastLidarReceivedAt: { type: "string", format: "date-time", nullable: true },
          lastControlBoardReceivedAt: { type: "string", format: "date-time", nullable: true },
          lastEvent: {
            nullable: true,
            oneOf: [{ $ref: "#/components/schemas/ExternalEvent" }],
          },
          lastInvalidEvent: {
            nullable: true,
            oneOf: [{ $ref: "#/components/schemas/ExternalEvent" }],
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
          command: {
            type: "string",
            enum: ["STAGE_1_ON", "STAGE_2_ON", "STAGE_2_RETURN", "SYSTEM_RESET", "UNKNOWN"],
            example: "STAGE_1_ON",
          },
          crcValid: {
            type: "boolean",
            example: true,
            description: "packet 없이 command만 테스트할 때 사용하는 임시 CRC 상태 값입니다. packet이 있으면 실제 CRC-8 계산 결과가 우선 적용됩니다.",
          },
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































