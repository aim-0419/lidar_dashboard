const express = require("express");
const cors = require("cors");
const path = require("path");
const swaggerUi = require("swagger-ui-express");

const swaggerSpec = require("./swagger");
const apiRoutes = require("./routes");
const { config } = require("./config");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api-docs.json", (req, res) => res.json(swaggerSpec));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(express.static(config.distPath));

app.use("/api", apiRoutes);

app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(config.distPath, "index.html"));
});

module.exports = { app };