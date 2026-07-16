import { router } from "../trpc.js";
import { authRouter } from "./auth.js";
import { projectsRouter } from "./projects.js";

export const appRouter = router({
  auth: authRouter,
  projects: projectsRouter,
});

export type AppRouter = typeof appRouter;
