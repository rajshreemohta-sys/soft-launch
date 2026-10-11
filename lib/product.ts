// Arjun's product. Edit freely; every Gemini prompt reads from here.
// TODO(Rajshree): final product name.
export const PRODUCT = {
  name: "ShiftSense",
  whatItIs:
    "Workforce management software for mid-market and enterprise companies in India with large or frontline workforces.",
  capabilities: [
    "shift scheduling and rostering",
    "attendance and time tracking (biometric, geo-fenced mobile)",
    "leave and overtime management",
    "labour law compliance reports",
    "a mobile app for frontline staff",
    "workforce analytics (attrition, overtime cost, staffing gaps)",
    "payroll system integration",
  ],
  bestFit:
    "Companies with many hourly, shift-based or distributed staff, such as retail, quick commerce, logistics, hospitals, hotels, BPOs and manufacturing.",
};

export function productContext(): string {
  return [
    `Product: ${PRODUCT.name}. ${PRODUCT.whatItIs}`,
    `Capabilities: ${PRODUCT.capabilities.join("; ")}.`,
    `Best-fit customers: ${PRODUCT.bestFit}`,
  ].join("\n");
}
