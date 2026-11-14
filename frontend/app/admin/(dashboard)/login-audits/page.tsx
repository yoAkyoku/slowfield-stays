import { getLocale, t } from "../../../modules/i18n";
import { AdminForbiddenError, getAdminLoginAudits, getAdminProfile, hasPermission } from "../../modules/adminApi";
import AdminTable from "../../modules/AdminTable";
import AdminTablePagination from "../../modules/AdminTablePagination";
import { getPageSlice } from "../../modules/paginationUtils";
import StatusBadge from "../../modules/StatusBadge";
import LoginCharts from "./LoginCharts";
import type { ChartPoint, IpEntry } from "./LoginCharts";
import { LogIn, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button, ButtonLink, Card, Grid, Input, Page, PageHeader, SearchInput, Select, StatCard, Toolbar } from "../../ui";
import { formatDateTime } from "../../../modules/datetime";

function dateValue(value?: string) {
  if (!value) return "";
  return value.slice(0, 10);
}

/** Generate last 30 days as chart points */
function last30Days(rows: { created_at?: string }[]): ChartPoint[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const key = d.toISOString().slice(0, 10);
    const count = rows.filter((r) => dateValue(r.created_at) === key).length;
    return { label: key.slice(5), value: count };
  });
}

/** Generate last 12 months as chart points */
function last12Months(rows: { created_at?: string }[]): ChartPoint[] {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (11 - i));
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const count = rows.filter((r) => (r.created_at ?? "").slice(0, 7) === ym).length;
    return { label: ym.slice(2), value: count };
  });
}

type AuditRow = { ip_address?: string | null; created_at?: string | null };

/** Compute top IPs from a filtered subset */
function computeTopIps(rows: AuditRow[], noIpLabel: string): IpEntry[] {
  const ipCounts = Object.entries(
    rows.reduce<Record<string, number>>((acc, audit) => {
      const key = audit.ip_address || noIpLabel;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
  const max = ipCounts.length > 0 ? ipCounts[0][1] : 1;
  return ipCounts.slice(0, 5).map(([address, count]) => ({
    address,
    count,
    percentage: Math.round((count / max) * 100)
  }));
}

/** Filter rows by days ago */
function filterByDaysAgo(rows: AuditRow[], days: number): AuditRow[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return rows.filter((r) => dateValue(r.created_at ?? undefined) >= cutoffStr);
}

export default async function AdminLoginAuditsPage(
  props: {
    searchParams: Promise<{ date_from?: string; date_to?: string; ip?: string; keyword?: string; page?: string; result?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();
  const copy = t(locale);
  const zh = locale === "zh";
  const [audits, profile] = await Promise.all([getAdminLoginAudits(), getAdminProfile()]);
  if (!hasPermission(profile.permissions, "global_users:read")) throw new AdminForbiddenError();
  const hasFilters = Boolean(searchParams.keyword || searchParams.ip || searchParams.result || searchParams.date_from || searchParams.date_to);
  const emptyTable =
    hasFilters
      ? (zh ? ["沒有符合條件的登入紀錄", "請調整篩選條件，或按重設查看所有紀錄。"] : ["No matching login records", "Adjust the filters or reset to see all records."])
      : locale === "zh"
      ? ["尚未有登入紀錄", "管理員登入後，成功與失敗紀錄會出現在這裡。"]
      : ["No login records yet", "Successful and failed admin logins will appear here after activity starts."];
  const keyword = searchParams.keyword?.trim().toLowerCase() ?? "";
  const ip = searchParams.ip?.trim().toLowerCase() ?? "";
  const rows = audits
    .filter((audit) => {
      const created = dateValue(audit.created_at);
      return (!searchParams.date_from || created >= searchParams.date_from) && (!searchParams.date_to || created <= searchParams.date_to);
    })
    .filter((audit) => {
      if (searchParams.result === "success") return audit.success;
      if (searchParams.result === "failed") return !audit.success;
      return true;
    })
    .filter((audit) => !keyword || audit.email.toLowerCase().includes(keyword))
    .filter((audit) => !ip || String(audit.ip_address ?? "").toLowerCase().includes(ip));
  const pageSize = 20;
  const currentPage = Math.max(1, Number(searchParams.page) || 1);
  const paginatedRows = getPageSlice(rows, currentPage, pageSize);
  // Chart data — login trend
  const monthData = last30Days(rows);
  const yearData = last12Months(rows);

  // IP data per time range
  const noIpLabel = zh ? "無紀錄" : "Unknown";
  const today = new Date().toISOString().slice(0, 10);
  const ipToday = computeTopIps(rows.filter((r) => dateValue(r.created_at) === today), noIpLabel);
  const ipWeek = computeTopIps(filterByDaysAgo(rows, 7), noIpLabel);
  const ipMonth = computeTopIps(filterByDaysAgo(rows, 30), noIpLabel);
  const ipYear = computeTopIps(filterByDaysAgo(rows, 365), noIpLabel);

  const successCount = rows.filter((row) => row.success).length;
  const failedCount = rows.length - successCount;

  return (
    <Page>
      <PageHeader title={copy.admin.adminLoginAnalyticsTitle} description={copy.admin.adminLoginAnalyticsText} />

      <Grid cols={3}>
        <StatCard icon={<LogIn />} label={zh ? "登入紀錄" : "Sign-in records"} value={rows.length} />
        <StatCard icon={<ShieldCheck />} label={copy.admin.adminLoginSuccess} tone="success" value={successCount} />
        <StatCard icon={<ShieldAlert />} label={copy.admin.adminLoginFailed} tone={failedCount > 0 ? "danger" : "neutral"} value={failedCount} />
      </Grid>

      {/* Charts (client) */}
      <LoginCharts
        monthData={monthData}
        yearData={yearData}
        ipToday={ipToday}
        ipWeek={ipWeek}
        ipMonth={ipMonth}
        ipYear={ipYear}
        zh={zh}
      />

      <Card flush>
      {/* Filter bar */}
      <div className="a-card__body">
      <form key={JSON.stringify([searchParams.keyword ?? "", searchParams.ip ?? "", searchParams.result ?? "", searchParams.date_from ?? "", searchParams.date_to ?? ""])}>
        <Toolbar
          end={
            <>
              <Button type="submit">{copy.admin.adminFilter}</Button>
              <ButtonLink href="/admin/login-audits" variant="ghost">{copy.admin.adminResetFilters}</ButtonLink>
            </>
          }
        >
          <SearchInput icon={<Search />} type="text" name="keyword" aria-label={copy.admin.adminEmail} placeholder={copy.admin.adminEmail} defaultValue={searchParams.keyword} />
          <Input name="ip" aria-label={copy.admin.adminIpAddress} placeholder={copy.admin.adminIpAddress} defaultValue={searchParams.ip} />
          <Select name="result" aria-label={zh ? "登入結果" : "Sign-in result"} defaultValue={searchParams.result ?? ""}>
            <option value="">{copy.admin.adminAllStatuses}</option>
            <option value="success">{copy.admin.adminLoginSuccess}</option>
            <option value="failed">{copy.admin.adminLoginFailed}</option>
          </Select>
          <Input name="date_from" type="date" aria-label={copy.admin.adminDateFrom} defaultValue={searchParams.date_from} />
          <Input name="date_to" type="date" aria-label={copy.admin.adminDateTo} defaultValue={searchParams.date_to} />
        </Toolbar>
      </form>
      </div>

      {/* Table */}
      <AdminTable
        rows={paginatedRows}
        emptyTitle={emptyTable[0]}
        emptyText={emptyTable[1]}
        columns={[
          { key: "email", label: copy.admin.adminEmail },
          { key: "ip_address", label: copy.admin.adminIpAddress },
          {
            key: "success",
            label: copy.admin.adminLoginResult,
            render: (row) => (
              <StatusBadge
                labels={{ active: copy.admin.adminLoginSuccess, archived: copy.admin.adminLoginFailed }}
                status={row.success ? "active" : "archived"}
              />
            )
          },
          { key: "created_at", label: copy.admin.adminCreatedAt, render: (row) => formatDateTime(String(row.created_at ?? "")) }
        ]}
      />
      </Card>
      <AdminTablePagination pageSize={pageSize} totalRows={rows.length} />
    </Page>
  );
}
