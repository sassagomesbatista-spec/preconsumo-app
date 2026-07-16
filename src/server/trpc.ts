import { initTRPC, TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import { getUserFromRequest, type JwtPayload } from "./lib/auth.js";

export interface Context {
  req: Request;
  res: Response;
  user: JwtPayload | null;
}

export async function createContext({
  req,
  res,
}: {
  req: Request;
  res: Response;
}): Promise<Context> {
  const user = await getUserFromRequest(req);
  return { req, res, user };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
