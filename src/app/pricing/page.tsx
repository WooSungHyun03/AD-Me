import { getConfig } from "@/lib/config";
import { getTestProducts } from "@/lib/test-products";
import { PricingPlans } from "@/components/pricing-plans";

export const metadata = {
  title: "요금제",
  alternates: { canonical: "/pricing" },
};

export default async function Pricing() {
  const test =
    getConfig().serviceMode === "test_demo" ? await getTestProducts() : null;
  return <PricingPlans test={test} />;
}
