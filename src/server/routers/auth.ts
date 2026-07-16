import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import {
  findUserByEmail,
  verifyPassword,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  createUser,
  hashPassword,
} from "../lib/auth.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) return null;
    return { userId: ctx.user.userId, email: ctx.user.email, name: ctx.user.name, role: ctx.user.role };
  }),

  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const user = await findUserByEmail(input.email);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos." });

      const ok = await verifyPassword(input.password, user.passwordHash);
      if (!ok) throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos." });

      await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

      const token = signToken({ userId: user.id, email: user.email, name: user.name, role: user.role });
      setAuthCookie(ctx.res, token);
      return { ok: true, name: user.name, role: user.role };
    }),

  logout: protectedProcedure.mutation(({ ctx }) => {
    clearAuthCookie(ctx.res);
    return { ok: true };
  }),

  // Lista usuários (admin)
  listUsers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    return db.select({ id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt }).from(users);
  }),

  // Criar usuário (admin)
  addUser: protectedProcedure
    .input(z.object({ name: z.string().min(1), email: z.string().email(), password: z.string().min(6), role: z.enum(["user", "admin"]).default("user") }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const existing = await findUserByEmail(input.email);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "E-mail já cadastrado." });
      const user = await createUser(input);
      return { id: user.id, name: user.name, email: user.email };
    }),

  // Remover usuário (admin)
  removeUser: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      if (input.id === ctx.user.userId) throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível remover seu próprio usuário." });
      await db.delete(users).where(eq(users.id, input.id));
      return { ok: true };
    }),

  // Alterar a própria senha
  changePassword: protectedProcedure
    .input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(6) }))
    .mutation(async ({ input, ctx }) => {
      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.userId)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      const ok = await verifyPassword(input.currentPassword, user.passwordHash);
      if (!ok) throw new TRPCError({ code: "UNAUTHORIZED", message: "Senha atual incorreta." });
      await db.update(users).set({ passwordHash: await hashPassword(input.newPassword) }).where(eq(users.id, user.id));
      return { ok: true };
    }),
});
