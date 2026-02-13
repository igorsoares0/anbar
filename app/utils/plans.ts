export const PLANS = {
  free: { name: "Free", price: 0, viewLimit: 1_000 },
  starter: { name: "Starter", price: 5.99, viewLimit: 10_000 },
  professional: { name: "Professional", price: 9.99, viewLimit: 50_000 },
  enterprise: { name: "Enterprise", price: 27.99, viewLimit: Infinity },
} as const;

export type PlanKey = keyof typeof PLANS;
