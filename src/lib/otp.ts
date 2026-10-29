export function isOtpEnabled(settings?: { otp_enabled?: string }) {
  return settings?.otp_enabled === "true";
}