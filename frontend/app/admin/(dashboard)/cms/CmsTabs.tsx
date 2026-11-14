import { Tabs } from "../../ui";
import type { CmsTabKey } from "./cmsConsoleData";

export default function CmsTabs({
  activeTab,
  counts,
  hrefFor,
  labels
}: {
  activeTab: CmsTabKey;
  counts: Record<CmsTabKey, number>;
  hrefFor: (tab: CmsTabKey) => string;
  labels: Record<CmsTabKey, string>;
}) {
  const tabs: CmsTabKey[] = ["overview", "pages", "banners", "issues"];

  return (
    <Tabs
      ariaLabel="CMS tabs"
      items={tabs.map((tab) => ({
        href: hrefFor(tab),
        label: labels[tab],
        count: tab === "overview" ? undefined : counts[tab],
        active: activeTab === tab
      }))}
    />
  );
}
