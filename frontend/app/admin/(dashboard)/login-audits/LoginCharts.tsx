"use client";

import { useState } from "react";
import { Button, Card } from "../../ui";

/* ─── Types ─── */
export type ChartPoint = { label: string; value: number };
export type IpEntry = { address: string; count: number; percentage: number };

type IpRange = "today" | "week" | "month" | "year";

/* ─── Main Component ─── */
export default function LoginCharts({
  monthData,
  yearData,
  ipToday,
  ipWeek,
  ipMonth,
  ipYear,
  zh
}: {
  monthData: ChartPoint[];
  yearData: ChartPoint[];
  ipToday: IpEntry[];
  ipWeek: IpEntry[];
  ipMonth: IpEntry[];
  ipYear: IpEntry[];
  zh: boolean;
}) {
  const [trendRange, setTrendRange] = useState<"month" | "year">("month");
  const [ipRange, setIpRange] = useState<IpRange>("week");

  const trendData = trendRange === "month" ? monthData : yearData;

  const ipDataMap: Record<IpRange, IpEntry[]> = { today: ipToday, week: ipWeek, month: ipMonth, year: ipYear };
  const ipData = ipDataMap[ipRange];

  const ipRangeLabels: Record<IpRange, string> = zh
    ? { today: "今日", week: "週", month: "月", year: "年" }
    : { today: "Today", week: "Week", month: "Month", year: "Year" };

  return (
    <div className="a-split">
      {/* Line chart */}
      <Card
        title={zh ? "登入活動" : "Sign-in Activity"}
        description={zh ? "登入趨勢" : "Login Trend"}
        actions={
          <div className="a-toolbar__end" role="group" aria-label={zh ? "登入趨勢期間" : "Sign-in trend period"}>
            <Button size="sm" variant={trendRange === "month" ? "secondary" : "ghost"} aria-pressed={trendRange === "month"} onClick={() => setTrendRange("month")}>
              {zh ? "月" : "Month"}
            </Button>
            <Button size="sm" variant={trendRange === "year" ? "secondary" : "ghost"} aria-pressed={trendRange === "year"} onClick={() => setTrendRange("year")}>
              {zh ? "年" : "Year"}
            </Button>
          </div>
        }
      >
        <LineChart data={trendData} />
      </Card>

      {/* IP leaderboard */}
      <Card
        title={zh ? "常見 IP" : "Frequent IPs"}
        description={zh ? "來源分析" : "Source Analysis"}
        actions={
          <div className="a-toolbar__end" role="group" aria-label={zh ? "來源分析期間" : "Source analysis period"}>
            {(["today", "week", "month", "year"] as IpRange[]).map((key) => (
              <Button key={key} size="sm" variant={ipRange === key ? "secondary" : "ghost"} aria-pressed={ipRange === key} onClick={() => setIpRange(key)}>
                {ipRangeLabels[key]}
              </Button>
            ))}
          </div>
        }
      >
        <div className="la-lb">
          {ipData.length > 0 ? (
            ipData.map((entry, idx) => (
              <div className="la-lb-row" key={entry.address}>
                <span className="la-lb-rank">#{idx + 1}</span>
                <code className="la-lb-addr">{entry.address}</code>
                <div className="la-lb-bar">
                  <span style={{ width: `${entry.percentage}%` }} />
                </div>
                <span className="la-lb-count">{entry.count}</span>
              </div>
            ))
          ) : (
            <p className="la-lb-empty">{zh ? "此期間沒有紀錄" : "No records in this period"}</p>
          )}
        </div>
      </Card>
    </div>
  );
}

/* ─── SVG Line Chart with Hover Tooltip ─── */
function LineChart({ data }: { data: ChartPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (data.length === 0) return null;

  const maxVal = Math.max(1, ...data.map((d) => d.value));
  const W = 100;
  const H = 40;
  const padX = 1;
  const padY = 4;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;

  const points = data.map((d, i) => {
    const x = padX + (i / Math.max(1, data.length - 1)) * innerW;
    const y = padY + innerH - (d.value / maxVal) * innerH;
    return { x, y, ...d };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPath = `M${points[0].x},${H} L${polyline.replace(/,/g, " L").replace(/ L/, ",")} L${points[points.length - 1].x},${H} Z`;

  const labelStep = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div className="la-line-chart">
      <div className="la-line-chart-inner">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="la-line-svg">
          {[0.25, 0.5, 0.75].map((frac) => (
            <line
              key={frac}
              x1={padX}
              y1={padY + innerH * (1 - frac)}
              x2={W - padX}
              y2={padY + innerH * (1 - frac)}
              className="la-line-grid"
            />
          ))}
          <path d={areaPath} className="la-line-area" />
          <polyline points={polyline} className="la-line-path" />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={hovered === i ? "1.2" : "0.5"}
              className={`la-line-dot ${hovered === i ? "la-line-dot--active" : ""}`}
            />
          ))}
          {points.map((p, i) => (
            <rect
              key={`hit-${i}`}
              x={p.x - (innerW / data.length) / 2}
              y={0}
              width={innerW / data.length}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>

        {hovered !== null && (
          <div
            className="la-line-tooltip"
            style={{
              left: `${(points[hovered].x / W) * 100}%`,
              top: `${(points[hovered].y / H) * 100}%`
            }}
          >
            <span className="la-line-tooltip-label">{points[hovered].label}</span>
            <strong className="la-line-tooltip-value">{points[hovered].value}</strong>
          </div>
        )}
      </div>

      <div className="la-line-labels">
        {data.map((d, i) =>
          i % labelStep === 0 || i === data.length - 1 ? (
            <span key={i} style={{ left: `${(i / Math.max(1, data.length - 1)) * 100}%` }}>
              {d.label}
            </span>
          ) : null
        )}
      </div>
    </div>
  );
}
