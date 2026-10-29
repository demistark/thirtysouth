import { describe, expect, it } from "vitest";
import { isOtpEnabled } from "@/lib/otp";

describe("email code setting", () => {
  it("enables code entry only for the exact string true, default off", () => {
    expect(isOtpEnabled()).toBe(false);
    expect(isOtpEnabled({ otp_enabled: "false" })).toBe(false);
    expect(isOtpEnabled({ otp_enabled: "TRUE" })).toBe(false);
    expect(isOtpEnabled({ otp_enabled: "true" })).toBe(true);
  });
});