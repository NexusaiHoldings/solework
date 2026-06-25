import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin-auth";
import InventoryClient from "./InventoryClient";

// Operator stock management — admin only.
export default async function InventoryPage(): Promise<React.ReactElement> {
  if (!(await getAdminUser())) redirect("/login?next=/inventory");
  return <InventoryClient />;
}
