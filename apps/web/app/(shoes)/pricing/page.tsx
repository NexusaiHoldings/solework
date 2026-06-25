import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin-auth";
import PricingClient from "./PricingClient";

// Internal price + margin SETTING (exposes cost structure) — admin only.
export default async function PricingPage(): Promise<React.ReactElement> {
  if (!(await getAdminUser())) redirect("/login?next=/pricing");
  return <PricingClient />;
}
