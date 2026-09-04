const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { once } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const express = require("express");
const jwt = require("jsonwebtoken");

function createTestApp() {
  const secret = randomBytes(64).toString("hex");
  const users = {
    manager: { id: "manager", userId: "manager", role: "MANAGER", isActive: true, sessionVersion: 1 },
    admin: { id: "admin", userId: "admin", role: "SUPER_ADMIN", isActive: true, sessionVersion: 1 },
  };
  const cache = new Map();

  // Keep the real router order and auth middleware; isolate DB, logging and hardware controllers.
  function loadModule(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = { exports: {} };
    cache.set(filename, loaded);
    vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
      module: loaded,
      exports: loaded.exports,
      require(name) {
        if (name === "express") return express;
        if (name === "jsonwebtoken") return jwt;
        if (name === "../config") return { config: { jwtSecret: secret } };
        if (name === "../prisma/client") {
          return { prisma: { user: { findUnique: async ({ where }) => users[where.id] || null } } };
        }
        if (name === "../utils/logger") {
          return { logger: { debug() {}, warn() {}, error() {} } };
        }
        if (name.endsWith(".routes") || name.endsWith("/auth.middleware")) {
          return loadModule(path.resolve(path.dirname(filename), `${name}.js`));
        }
        if (name.endsWith(".controller")) {
          return new Proxy({}, {
            get: (_, handler) => (req, res) => res.json({ handler }),
          });
        }
        if (name.endsWith("/login-rate-limit.middleware")) {
          return { loginRateLimit: (req, res, next) => next() };
        }
        if (name.endsWith("/password-rate-limit.middleware")) {
          return { passwordRateLimit: (req, res, next) => next() };
        }
        throw new Error(`Unexpected test dependency: ${name}`);
      },
    }, { filename });
    return loaded.exports;
  }

  const app = express();
  app.use("/api", loadModule(path.resolve(__dirname, "../src/routes/index.js")));
  const tokens = Object.fromEntries(Object.keys(users).map((id) => [
    id, jwt.sign({ id, sessionVersion: 1 }, secret, { expiresIn: "5m" }),
  ]));
  return { app, tokens };
}

test("mounted routers preserve read access and restrict mutations/control commands", async (t) => {
  const { app, tokens } = createTestApp();
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const routes = [
    ["GET", "/wrongway/history", "getWrongWayHistory", false],
    ["GET", "/events/test-event", "getWrongWayEventDetail", false],
    ["GET", "/zones", "getZonesController", false],
    ["GET", "/statistics/summary", "getSummary", false],
    ["PATCH", "/events/test-event/status", "updateWrongWayEventStatus", true],
    ["POST", "/control-board/commands", "sendCommand", true],
    ["GET", "/control-board/commands", "getCommands", true],
    ["GET", "/control-board/commands/test-command", "getCommand", true],
  ];

  for (const [method, route, handler, adminOnly] of routes) {
    for (const role of ["manager", "admin", "anonymous"]) {
      await t.test(`${role}: ${method} ${route}`, async () => {
        const response = await fetch(`${baseUrl}${route}`, {
          method,
          headers: tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {},
          signal: AbortSignal.timeout(5000),
        });
        const expectedStatus = role === "anonymous" ? 401 : adminOnly && role === "manager" ? 403 : 200;
        assert.equal(response.status, expectedStatus);
        const body = await response.json();
        if (expectedStatus === 200) {
          assert.equal(body.handler, handler);
        } else {
          assert.equal(body.ok, false);
          assert.equal(body.handler, undefined);
        }
      });
    }
  }
});
