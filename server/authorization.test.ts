import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextFor(role: "admin" | "user"): TrpcContext {
  const now = new Date();
  return {
    user: { id: 7, openId: "role-test", name: "Role Test", email: "role@example.com", loginMethod: "test", role, createdAt: now, updatedAt: now, lastSignedIn: now },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("workspace authorization", () => {
  it("blocks operators from admin summaries", async () => {
    const caller = appRouter.createCaller(contextFor("user"));
    await expect(caller.workspace.adminSummary()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
