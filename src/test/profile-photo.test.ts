import { describe, expect, it } from "vitest";
import { isOtpEnabled, photoDimensions, photoValidation } from "@/lib/profile-photo";

describe("profile photo rules", () => {
  it("accepts only JPEG PNG and WebP", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) expect(photoValidation({type,size: 100})).toBeNull();
    expect(photoValidation({type:"image/gif",size:100})).toBe("type");
  });
  it("limits original uploads to 5 MB", () => {
    expect(photoValidation({type:"image/jpeg",size:5*1024*1024})).toBeNull();
    expect(photoValidation({type:"image/jpeg",size:5*1024*1024+1})).toBe("size");
  });
  it("resizes the longest edge to 800 without stretching or upscaling", () => {
    expect(photoDimensions(1600,1200)).toEqual({width:800,height:600});
    expect(photoDimensions(600,1200)).toEqual({width:400,height:800});
    expect(photoDimensions(300,200)).toEqual({width:300,height:200});
  });
  it("enables code entry only for the exact string true, default off", () => {
    expect(isOtpEnabled()).toBe(false);
    expect(isOtpEnabled({otp_enabled:"false"})).toBe(false);
    expect(isOtpEnabled({otp_enabled:"TRUE"})).toBe(false);
    expect(isOtpEnabled({otp_enabled:"true"})).toBe(true);
  });
});