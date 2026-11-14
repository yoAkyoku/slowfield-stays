"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button, Card } from "../../../ui";
import { useMemo, useState } from "react";
import type { NewsletterCampaign } from "../../../modules/adminApi";
import { siteDateKey, siteTimeOfDay } from "../../../../modules/datetime";

/**
 * A month view of what is scheduled, and what already went out.
 *
 * The send centre lists schedules in the order the queue happens to hold them,
 * which answers "what is scheduled" but not "what is going out this week, and
 * is anything stacked on the same day". Two campaigns an hour apart, or an
 * empty fortnight, are both things you only see laid out against dates.
 *
 * Days are grouped by Taipei date rather than UTC: a 21:00 send is 13:00 UTC,
 * and anything after 16:00 UTC would otherwise file under the previous square.
 */

type Props = {
  campaigns: NewsletterCampaign[];
  zh: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A grid cell's own calendar date as YYYY-MM-DD.
 *
 * Deliberately NOT siteDateKey: a cell is a date on a wall calendar, not an
 * instant. Passing its local midnight through a timezone formatter converts it
 * — on a UTC+9 machine, midnight on the 24th is 15:00Z on the 23rd, which
 * reads back as Taipei's 23rd — so every cell carried the previous day's key
 * and every campaign appeared one square late. Only the campaign timestamps,
 * which really are instants, get converted.
 */
function cellKey(day: Date): string {
  const m = String(day.getMonth() + 1).padStart(2, "0");
  const d = String(day.getDate()).padStart(2, "0");
  return `${day.getFullYear()}-${m}-${d}`;
}

export default function ScheduleCalendar({ campaigns, zh }: Props) {
  /* Month offset from the current one, so the grid needs no date in state —
     Date.now() is read at render, which keeps "today" honest across midnight. */
  const [monthOffset, setMonthOffset] = useState(0);

  const { label, weeks, byDay, todayKey } = useMemo(() => {
    /* Anchor the whole grid on Taipei's today, not the viewer's. An admin
       abroad should see the same month, and the same square highlighted, as
       one sitting in the office — the schedule belongs to the business. */
    const todayKey = siteDateKey(new Date());
    const [ty, tm, td] = todayKey.split("-").map(Number);
    const cursor = new Date(ty, tm - 1 + monthOffset, 1);
    const year = cursor.getFullYear();
    const month = cursor.getMonth();

    /* Every campaign that carries a date, keyed by the day it lands on.
       Sent ones are included so the month reads as a history as well as a
       plan — an empty calendar that only ever shows the future is hard to
       trust when you are checking whether something went out. */
    const map = new Map<string, { campaign: NewsletterCampaign; when: string; kind: "scheduled" | "sent" }[]>();
    for (const campaign of campaigns) {
      const scheduled = campaign.status === "scheduled" ? campaign.scheduled_at : null;
      const sent = campaign.status === "sent" ? (campaign.sent_at ?? null) : null;
      const when = scheduled ?? sent;
      if (!when) continue;
      const key = siteDateKey(when);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push({ campaign, when, kind: scheduled ? "scheduled" : "sent" });
      map.set(key, list);
    }
    // forEach, not for..of over .values(): the tsconfig target predates
    // downlevel iteration of Map iterators.
    map.forEach((list) => list.sort((a, b) => a.when.localeCompare(b.when)));

    // Grid starts on the Sunday on or before the 1st and runs whole weeks.
    const first = new Date(year, month, 1);
    const start = new Date(first.getTime() - first.getDay() * DAY_MS);
    const rows: Date[][] = [];
    for (let w = 0; w < 6; w += 1) {
      const row: Date[] = [];
      for (let d = 0; d < 7; d += 1) {
        row.push(new Date(start.getTime() + (w * 7 + d) * DAY_MS));
      }
      rows.push(row);
      // Stop once the month is covered rather than always drawing six rows.
      const last = row[6];
      if (last.getMonth() !== month && last > first) break;
    }

    return {
      label: new Intl.DateTimeFormat(zh ? "zh-TW" : "en-US", { year: "numeric", month: "long" }).format(cursor),
      weeks: rows,
      byDay: map,
      todayKey,
      month,
    };
  }, [campaigns, monthOffset, zh]);

  const anchor = siteDateKey(new Date()).split("-").map(Number);
  const cursorMonth = new Date(anchor[0], anchor[1] - 1 + monthOffset, 1).getMonth();
  const weekdays = zh
    ? ["日", "一", "二", "三", "四", "五", "六"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <Card
      className="nlx-cal"
      title={zh ? "排程行事曆" : "Schedule calendar"}
      actions={
        <div className="nlx-cal-nav">
          {monthOffset !== 0 && (
            <Button onClick={() => setMonthOffset(0)} size="sm" variant="ghost">
              {zh ? "回到本月" : "Today"}
            </Button>
          )}
          <Button icon={<ChevronLeft />} iconOnly onClick={() => setMonthOffset((m) => m - 1)} size="sm">
            {zh ? "上個月" : "Previous month"}
          </Button>
          <strong>{label}</strong>
          <Button icon={<ChevronRight />} iconOnly onClick={() => setMonthOffset((m) => m + 1)} size="sm">
            {zh ? "下個月" : "Next month"}
          </Button>
        </div>
      }
    >

      <p className="nl-calendar-scroll-hint">{zh ? "左右滑動查看完整日期；鍵盤可用方向鍵捲動。" : "Scroll sideways for all dates, or use the arrow keys."}</p>
      <div className="nl-calendar-scroll" role="region" aria-label={zh ? "行事曆日期（可橫向捲動）" : "Calendar dates (scroll horizontally)"} tabIndex={0}>
      <div className="nl-calendar-grid" role="grid">
        {weekdays.map((d) => (
          <div className="nl-calendar-weekday" key={d} role="columnheader">{d}</div>
        ))}
        {weeks.flat().map((day) => {
          const key = cellKey(day);
          const entries = byDay.get(key) ?? [];
          const outside = day.getMonth() !== cursorMonth;
          return (
            <div
              className={`nl-calendar-day${outside ? " is-outside" : ""}${key === todayKey ? " is-today" : ""}`}
              key={key}
              role="gridcell"
            >
              <span className="nl-calendar-daynum">{day.getDate()}</span>
              {entries.map(({ campaign, when, kind }) => (
                /* Straight to the campaign — the point of seeing it on a date
                   is to be able to open it. */
                <Link
                  className={`nl-calendar-item is-${kind}`}
                  href={`/admin/newsletter/${campaign.id}`}
                  key={campaign.id}
                  title={`${siteTimeOfDay(when, zh ? "zh" : "en")} ${campaign.subject}`}
                >
                  <span className="nl-calendar-item-time">{siteTimeOfDay(when, zh ? "zh" : "en")}</span>
                  <span className="nl-calendar-item-subject">{campaign.subject}</span>
                </Link>
              ))}
            </div>
          );
        })}
      </div>

      </div>
      <p className="nl-calendar-legend">
        <span className="nl-calendar-key is-scheduled" /> {zh ? "已排程" : "Scheduled"}
        <span className="nl-calendar-key is-sent" /> {zh ? "已寄送" : "Sent"}
      </p>
    </Card>
  );
}
