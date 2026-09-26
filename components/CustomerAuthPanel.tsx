import { customerLogoutAction } from "@/app/actions/customer-auth";
import { CustomerLoginForm } from "@/components/CustomerLoginForm";
import { getCustomerSession } from "@/lib/customer-auth";

export async function CustomerAuthPanel() {
  const session = await getCustomerSession();
  if (session) {
    return (
      <div className="rounded-2xl border border-forest/15 bg-forest-mist/40 px-5 py-4">
        <p className="text-sm text-ink/80">
          เข้าสู่ระบบแล้วในชื่อ{" "}
          <span className="font-mono font-semibold text-forest">
            {session.username}
          </span>
        </p>
        <form action={customerLogoutAction} className="mt-3">
          <button
            type="submit"
            className="text-sm font-medium text-forest underline-offset-2 hover:underline"
          >
            ออกจากระบบ
          </button>
        </form>
      </div>
    );
  }
  return <CustomerLoginForm />;
}
