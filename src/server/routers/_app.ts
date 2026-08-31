import { router } from "../trpc.js";
import { authRouter } from "./auth.js";
import { projectsRouter } from "./projects.js";
import { erpBridgeRouter } from "./erpBridge.js";

export const appRouter = router({
  auth: authRouter,
  projects: projectsRouter,
  erpBridge: erpBridgeRouter,
});

export type AppRouter = typeof appRouter;
