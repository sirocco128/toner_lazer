"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEMO_ADMIN_ACCOUNTS,
  DEMO_ADMIN_PASSWORD,
  DEMO_CUSTOMER_ACCOUNTS,
  DEMO_CUSTOMER_PASSWORD,
  type DemoLoginAccount,
} from "@/lib/demo-logins";

type RosterSide = "admin" | "customer";

type LoginRosterProps = {
  highlight?: RosterSide;
  sides?: RosterSide | "both";
  onPick?: (username: string, password: string) => void;
};

function AccountList({
  title,
  password,
  accounts,
  accent,
  onPick,
}: {
  title: string;
  password: string;
  accounts: DemoLoginAccount[];
  accent: string;
  onPick?: (username: string, password: string) => void;
}) {
  return (
    <div className={`rounded-xl border p-3 ${accent}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/55">
        {title}
      </p>
      <p className="mt-1 font-mono text-sm text-ink">
        รหัสผ่าน{" "}
        <button
          type="button"
          onClick={() => onPick?.(accounts[0]?.username ?? "", password)}
          className="rounded bg-paper px-1.5 py-0.5 font-semibold text-forest underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {password}
        </button>
      </p>
      <ul className="mt-2 space-y-1">
        {accounts.map((account) => (
          <li key={account.username}>
            <button
              type="button"
              onClick={() => onPick?.(account.username, password)}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-1.5 py-1.5 text-left text-sm transition hover:bg-paper/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-mono font-medium text-forest">
                {account.username}
              </span>
              <span className="text-xs text-ink/55">{account.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RosterLists({
  highlight,
  sides,
  onPick,
}: {
  highlight: RosterSide;
  sides: RosterSide | "both";
  onPick?: (username: string, password: string) => void;
}) {
  const showAdmin = sides === "both" || sides === "admin";
  const showCustomer = sides === "both" || sides === "customer";

  return (
    <div className={sides === "both" ? "grid gap-3 sm:grid-cols-2" : "grid gap-3"}>
      {showAdmin ? (
        <AccountList
          title="ฝั่งผู้ดูแล"
          password={DEMO_ADMIN_PASSWORD}
          accounts={DEMO_ADMIN_ACCOUNTS}
          accent={
            highlight === "admin"
              ? "border-forest/30 bg-forest-mist/60"
              : "border-forest/15 bg-paper"
          }
          onPick={onPick}
        />
      ) : null}
      {showCustomer ? (
        <AccountList
          title="ฝั่งลูกค้า"
          password={DEMO_CUSTOMER_PASSWORD}
          accounts={DEMO_CUSTOMER_ACCOUNTS}
          accent={
            highlight === "customer"
              ? "border-forest/30 bg-forest-mist/60"
              : "border-forest/15 bg-paper"
          }
          onPick={onPick}
        />
      ) : null}
    </div>
  );
}

export function LoginRoster({
  highlight = "admin",
  sides = "both",
  onPick,
}: LoginRosterProps) {
  const [open, setOpen] = useState(false);
  const resolvedSides = sides === "both" ? "both" : sides;

  function pick(username: string, password: string) {
    onPick?.(username, password);
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full rounded-md"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Users />
        รายชื่อและรหัสผ่าน
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="z-[80] w-[min(100%-1.5rem,36rem)]">
          <DialogHeader>
            <DialogTitle>รายชื่อและรหัสผ่าน</DialogTitle>
            <DialogDescription>
              กดชื่อผู้ใช้หรือรหัสผ่านเพื่อใส่ในฟอร์ม
            </DialogDescription>
          </DialogHeader>
          <RosterLists highlight={highlight} sides={resolvedSides} onPick={pick} />
        </DialogContent>
      </Dialog>
    </>
  );
}
