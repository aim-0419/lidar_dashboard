const express = require("express");
const cors = require("cors");
const path = require("path");
const swaggerUi = require("swagger-ui-express");

const swaggerSpec = require("./swagger");
const apiRoutes = require("./routes");
const { config } = require("./config");

const app = express();
const allowedOrigins = new Set([
  config.frontendBaseUrl,
  config.dashboardBaseUrl,
  `http://localhost:${config.port}`,
  `http://127.0.0.1:${config.port}`,
  `http://${config.publicHost}:${config.frontendPort}`,
  `http://127.0.0.1:${config.frontendPort}`,
]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json());

app.get("/api-docs.json", (req, res) => res.json(swaggerSpec));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(express.static(config.distPath));

app.use("/api", apiRoutes);

app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(config.distPath, "index.html"));
});

module.exports = { app };
