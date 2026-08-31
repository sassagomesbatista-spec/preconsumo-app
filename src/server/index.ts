import "dotenv/config";
import { runAutoMigrations } from "./db/index.js";
await runAutoMigrations();
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers/_app.js";
import { createContext } from "./trpc.js";
import { externalApiRouter } from "./routes/external-api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3001);
const APP_URL = process.env.APP_URL ?? `http://localhost:${PORT}`;

const app = express();

app.use(cookieParser());
app.use(express.json());
app.use(
  cors({
    origin: process.env.NODE_ENV === "production" ? APP_URL : "http://localhost:5173",
    credentials: true,
  })
);

app.use(
  "/trpc",
  createExpressMiddleware({ router: appRouter, createContext })
);

app.use(externalApiRouter);

// Serve frontend em produção
if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "../../dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Pré Consumo rodando em http://localhost:${PORT}`);
});
