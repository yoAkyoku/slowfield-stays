import { Tabs } from "../../ui";

export type NlTabKey = "campaigns" | "subscribers" | "send" | "calendar";

const TAB_TABS: NlTabKey[] = ["campaigns", "subscribers", "send", "calendar"];

export function normalizeNlTab(value?: string): NlTabKey {
  if (value === "subscribers" || value === "send" || value === "calendar") return value;
  return "campaigns";
}

export default function NewsletterTabs({
  activeTab,
  labels
}: {
  activeTab: NlTabKey;
  labels: Record<NlTabKey, string>;
}) {
  return (
    <Tabs
      ariaLabel="Newsletter tabs"
      items={TAB_TABS.map((tab) => ({ href: `/admin/newsletter?tab=${tab}`, label: labels[tab], active: activeTab === tab }))}
    />
  );
}
