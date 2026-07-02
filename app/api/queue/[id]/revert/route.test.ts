import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "./route";
import {
  listQueue,
  getApplication,
  resolveApplication,
  __resetQueueForTests,
} from "@/lib/queue/store";

function callRevert(id: string) {
  return POST(
    new Request("http://localhost/api/queue/x/revert", { method: "POST" }),
    {
      params: Promise.resolve({ id }),
    },
  );
}

describe("POST /api/queue/[id]/revert", () => {
  beforeEach(async () => {
    await __resetQueueForTests();
  });

  it("returns 404 for an unknown application id", async () => {
    const res = await callRevert("nope");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 409 when the application is not resolved", async () => {
    const target = (await listQueue()).find((i) => i.status === "analyzed")!;
    const res = await callRevert(target.id);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/not resolved/i);
  });

  it("reverts a resolved application back to analyzed and returns it", async () => {
    const target = (await listQueue()).find((i) => i.status === "analyzed")!;
    await resolveApplication(target.id, {
      decision: "approved",
      overrides: [],
      rejectedFields: [],
      note: "",
      resolvedAt: new Date().toISOString(),
    });

    const res = await callRevert(target.id);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.application.status).toBe("analyzed");
    expect(body.application.reviewData.resolution).toBeNull();

    const persisted = await getApplication(target.id);
    expect(persisted?.status).toBe("analyzed");
    expect((await listQueue()).find((i) => i.id === target.id)).toBeDefined();
  });
});
