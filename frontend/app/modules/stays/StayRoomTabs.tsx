"use client";

import { useId, useRef, useState } from "react";
import { Users } from "lucide-react";
import { bilingual } from "../tr";
import type { Locale } from "../i18n";

type RoomType = {
  name: string;
  description: string;
  price: number;
  capacity: number;
};

function RoomBody({ room, guestsUnit, locale }: { room: RoomType; guestsUnit: string; locale: Locale }) {
  const desc = bilingual(room.description, locale);
  return (
    <div className="room-row">
      <div className="room-row-head">
        <h3>{bilingual(room.name, locale)}</h3>
        {room.price > 0 && <strong>TWD {room.price.toLocaleString()}+</strong>}
      </div>
      <div className="room-row-spec">
        <span><Users size={15} strokeWidth={1.7} /> {room.capacity} {guestsUnit}</span>
      </div>
      {desc && <p>{desc}</p>}
    </div>
  );
}

export default function StayRoomTabs({
  rooms,
  guestsUnit,
  locale = "zh"
}: {
  rooms: RoomType[];
  guestsUnit: string;
  locale?: Locale;
}) {
  const [active, setActive] = useState(0);
  /* One id base per instance: a stay page can carry more than one room section,
     and duplicate ids would point every tab at the first panel on the page. */
  const uid = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  if (rooms.length === 0) return null;

  // Clamp active index to prevent out-of-bounds if rooms change
  const safeActive = Math.min(active, rooms.length - 1);

  // Single room — no tabs needed
  if (rooms.length === 1) {
    return (
      <div className="stay-room-content">
        <RoomBody room={rooms[0]} guestsUnit={guestsUnit} locale={locale} />
      </div>
    );
  }

  const current = rooms[safeActive];
  const tabId = (i: number) => `${uid}-room-tab-${i}`;
  /* One panel for the whole set, so it keeps one id: the tabs swap what is
     inside it rather than each owning a panel of its own. Every tab points at
     that id, and the panel names itself after whichever tab is selected. */
  const panelId = `${uid}-room-panel`;

  /**
   * Arrow / Home / End over the tab strip.
   *
   * The markup already claimed `role="tab"`, which is a promise: a screen
   * reader tells the reader to use the arrow keys, and until now pressing them
   * did nothing at all. Selection follows focus (automatic activation) — the
   * panel is already rendered from local state, so there is nothing to load and
   * no reason to make the reader press Enter as well.
   */
  function onTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, i: number) {
    const last = rooms.length - 1;
    let next: number;
    switch (event.key) {
      case "ArrowRight": next = i === last ? 0 : i + 1; break;
      case "ArrowLeft": next = i === 0 ? last : i - 1; break;
      case "Home": next = 0; break;
      case "End": next = last; break;
      default: return;
    }
    // Stops the page scrolling on Home/End and the arrows, which is what the
    // browser would otherwise do while focus sits on a button.
    event.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="stay-room-tabs">
      <div className="stay-room-tab-bar" role="tablist">
        {rooms.map((room, i) => (
          <button
            key={`${room.name}-${i}`}
            ref={(el) => { tabRefs.current[i] = el; }}
            id={tabId(i)}
            className={`stay-room-tab${i === safeActive ? " stay-room-tab--active" : ""}`}
            role="tab"
            aria-selected={i === safeActive}
            aria-controls={panelId}
            /* Roving tabindex: the strip is one Tab stop, and the arrows move
               within it — otherwise Tab walks every room name in turn. */
            tabIndex={i === safeActive ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(event) => onTabKeyDown(event, i)}
          >
            {bilingual(room.name, locale)}
          </button>
        ))}
      </div>
      <div className="stay-room-content" role="tabpanel" id={panelId} aria-labelledby={tabId(safeActive)}>
        <RoomBody room={current} guestsUnit={guestsUnit} locale={locale} />
      </div>
    </div>
  );
}
