import { getConfig } from "@/lib/config";
import { getTestProducts } from "@/lib/test-products";
import { PricingPlans } from "@/components/pricing-plans";

// D002: prices must match the DB snapshot used by server orders, not a build-time render.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "요금제",
  alternates: { canonical: "/pricing" },
};

export default async function Pricing() {
  const test =
    getConfig().serviceMode === "test_demo" ? await getTestProducts() : null;
  return <PricingPlans test={test} />;
}
