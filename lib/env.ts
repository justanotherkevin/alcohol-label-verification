export function isProductionEnvironment(): boolean {
  return process.env.VERCEL_ENV === "production"
}
