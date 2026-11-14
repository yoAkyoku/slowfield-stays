import { Tabs } from "../../ui";
import type { StayWorkspaceTab } from "./staysConsoleData";

export default function StaysTabs({
  activeTab,
  counts,
  hrefFor,
  labels
}: {
  activeTab: StayWorkspaceTab;
  counts: Record<StayWorkspaceTab, number>;
  hrefFor: (tab: StayWorkspaceTab) => string;
  labels: Record<StayWorkspaceTab, string>;
}) {
  const tabs: StayWorkspaceTab[] = ["overview", "list", "issues"];

  return (
    <Tabs
      ariaLabel="Stay workspace tabs"
      items={tabs.map((tab) => ({
        active: tab === activeTab,
        count: tab === "overview" ? undefined : counts[tab],
        href: hrefFor(tab),
        label: labels[tab]
      }))}
    />
  );
}
