"use client";

import { useState } from "react";
import CancelFlow from "./CancelFlow";

export type MembershipSummary = {
  membershipId: string | null;
  planName: string;
  price: string;
  status: string;
  renewalDate: string | null;
};

type Props = {
  membership: MembershipSummary;
};

export default function ManageMembershipClient({ membership }: Props) {
  const [cancelOpen, setCancelOpen] = useState(false);

  const openCancelModal = () => setCancelOpen(true);

  const statusColor =
    membership.status === "Active" ? "var(--green)" : "var(--txt-mut)";

  return (
    <main className="manage-mem-page">
      <div className="mm-shell">
        <div className="settings">
          <div className="settings-h">
            <div className="settings-title">Manage Membership</div>
            <div className="settings-sub">View your plan or manage billing.</div>
          </div>

          <div className="plan-card">
            <div className="plan-top">
              <div>
                <div className="plan-tier">Current Plan</div>
                <div className="plan-name">{membership.planName}</div>
                <div className="plan-price">{membership.price}</div>
              </div>
              <div className="plan-crown">{"\u{1F451}"}</div>
            </div>
            <div className="plan-meta">
              <span>
                Status: <b style={{ color: statusColor }}>{membership.status}</b>
              </span>
              {membership.renewalDate && (
                <span>
                  Renews: <b>{membership.renewalDate}</b>
                </span>
              )}
            </div>
          </div>

          {/* Billing section removed: every row was a dead placeholder. The
              whole container is commented out so no empty header renders.
              TODO: wire embedded card swap when Whop API path confirmed
              Removed - no need for invoices tab
              Removed - no need for billing history tab
          <div className="settings-section">
            <div className="settings-section-h">Billing</div>
            <a className="settings-row" href="#">
              <div className="settings-row-l">
                <span className="settings-row-icn">{"\u{1F4B3}"}</span>
                <span className="settings-row-label">Payment method</span>
              </div>
              <span className="settings-row-arw">{"→"}</span>
            </a>
            <a className="settings-row" href="#">
              <div className="settings-row-l">
                <span className="settings-row-icn">{"\u{1F4C4}"}</span>
                <span className="settings-row-label">Invoices</span>
              </div>
              <span className="settings-row-arw">{"→"}</span>
            </a>
            <a className="settings-row" href="#">
              <div className="settings-row-l">
                <span className="settings-row-icn">{"\u{1F4C5}"}</span>
                <span className="settings-row-label">Billing history</span>
              </div>
              <span className="settings-row-arw">{"→"}</span>
            </a>
          </div>
          */}

          {/* TODO: Restore when Ultra launches
          <div className="settings-section">
            <div className="settings-section-h">Plan</div>
            <a className="settings-row" href="#">
              <div className="settings-row-l">
                <span className="settings-row-icn">{"⬆️"}</span>
                <span className="settings-row-label">Upgrade to Ultra</span>
              </div>
              <span className="settings-row-arw">{"→"}</span>
            </a>
          </div>
          */}

          <button type="button" className="cancel-link" onClick={openCancelModal}>
            Cancel membership
          </button>
        </div>
      </div>

      <CancelFlow
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        membershipId={membership.membershipId ?? ""}
        plan={membership.planName || "Pro"}
      />
    </main>
  );
}
