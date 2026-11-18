"use client";

import { Search, ChevronDown, Users, MapPin, Check, SlidersHorizontal, Home } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Locale } from "./i18n";
import { shortAmenity, type ShortAmenityRule } from "./tr";
import { guestOptions, type SearchOpt } from "./searchOptions";
import { useDismiss } from "./useDismiss";

/**
 * Hero search. Every field is click-to-select (no free typing): region and
 * party-size are dropdowns, service facilities are toggle chips — all in one
 * block. Submits a GET form to /stays with region / guests / repeated amenity
 * params. Party-size options map to a lower-bound `guests` number (backend
 * filters max_guests >= guests).
 */

type Opt = { value: string; label: string };

/**
 * A county and its districts.
 *
 * `value` is what gets submitted and what the API matches on, which is always
 * the Chinese the stay was filed under. `label` is what the reader sees. They
 * were the same field before, so an English visitor picked between 宜蘭縣 and
 * 冬山鄉 on an otherwise English page.
 */
export type LocationOption = { value: string; label: string };
export type LocationGroup = { county: string; label: string; districts: LocationOption[] };

type ListboxState = {
  open: boolean;
  count: number;
  activeIndex: number;
  setActiveIndex: (next: number | ((i: number) => number)) => void;
  openAt: (index: number) => void;
  close: () => void;
};
type OpenKey = "ArrowDown" | "ArrowUp" | "Enter";

/**
 * The keyboard of a click-only listbox, shared by the single and multi-select
 * fields of the search bar, which each carried their own copy.
 *
 * Arrow keys move the highlight and wrap; Home/End jump; Escape and Tab close.
 * On a closed list, `openOn(key)` names the row it opens on; Enter/Space on
 * an open list hands the highlighted row to `choose`.
 */
function listboxKey(
  event: { key: string; preventDefault: () => void },
  { open, count, activeIndex, setActiveIndex, openAt, close }: ListboxState,
  openOn: (key: OpenKey) => number,
  choose: (index: number) => void,
) {
  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      if (!open) openAt(openOn("ArrowDown"));
      else setActiveIndex((i) => (i + 1) % count);
      break;
    case "ArrowUp":
      event.preventDefault();
      if (!open) openAt(openOn("ArrowUp"));
      else setActiveIndex((i) => (i - 1 + count) % count);
      break;
    case "Home":
      if (open) { event.preventDefault(); setActiveIndex(0); }
      break;
    case "End":
      if (open) { event.preventDefault(); setActiveIndex(count - 1); }
      break;
    case "Enter":
    case " ":
      event.preventDefault();
      if (open && activeIndex >= 0 && activeIndex < count) choose(activeIndex);
      else openAt(openOn("Enter"));
      break;
    case "Escape":
      if (open) { event.preventDefault(); close(); }
      break;
    case "Tab":
      // Leaving the control closes it; the panel is not in the tab order.
      close();
      break;
    default:
      break;
  }
}

/** The open state, highlight and scroll of a listbox, with its keyboard bound. */
function useListbox(count: number) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;
  useDismiss(wrapRef, () => setOpen(false), open);

  // Follow the active row with the scroll, or arrowing past the visible rows
  // moves a highlight nobody can see.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current?.querySelector(`#${CSS.escape(optionId(activeIndex))}`)
      ?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIndex]);

  const openAt = (index: number) => {
    setOpen(true);
    setActiveIndex(index);
  };
  const close = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  const onKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    openOn: (key: OpenKey) => number,
    choose: (index: number) => void,
  ) => listboxKey(event, { open, count, activeIndex, setActiveIndex, openAt, close }, openOn, choose);

  return { open, activeIndex, setActiveIndex, wrapRef, listRef, listId, optionId, openAt, close, onKeyDown };
}

/** Click-only dropdown that writes a hidden input (name) — no keyboard typing.
 *  Controlled when `value`/`onChange` are supplied, else self-managed. */
function SelectField({
  name,
  icon,
  placeholder,
  options,
  defaultValue = "",
  value: controlledValue,
  onChange,
  disabled,
}: {
  name: string;
  icon: React.ReactNode;
  placeholder: string;
  options: Opt[];
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
}) {
  const [innerValue, setInnerValue] = useState(defaultValue);
  const value = controlledValue !== undefined ? controlledValue : innerValue;
  const setValue = (v: string) => { if (onChange) onChange(v); else setInnerValue(v); };
  const selected = options.find((o) => o.value === value);

  /* Every row the keyboard can land on, in the order they are drawn — the
     "clear" row included, so an index means the same thing to the key handler
     and to the renderer. */
  const items = useMemo(() => {
    const rows: Array<{ value: string; label: string; clear?: boolean }> = [];
    if (value) rows.push({ value: "", label: placeholder, clear: true });
    rows.push(...options);
    return rows;
  }, [options, value, placeholder]);

  /* Which row the keyboard is on. This listbox announced itself correctly —
     aria-haspopup, aria-expanded, aria-controls — and then contained nothing a
     keyboard could reach: the rows were <li onClick> with no id, no tabindex
     and no key handler, and the button had no aria-activedescendant. A screen
     reader said "expanded, listbox" and the arrow keys did nothing, which is
     worse than a plain <select> because it promises an interface that is not
     there. All four fields of the search bar are this component. */
  const { open, activeIndex, setActiveIndex, wrapRef, listRef, listId, optionId, openAt, close, onKeyDown: listboxKeyDown } = useListbox(items.length);
  // A closed list opens on the chosen row, whichever key opened it.
  const selectedIndex = Math.max(0, items.findIndex((row) => !row.clear && row.value === value));

  const commit = (index: number) => {
    const row = items[index];
    if (!row) return;
    setValue(row.value);
    close();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    listboxKeyDown(event, () => selectedIndex, commit);
  };

  return (
    <div className={`ssb-select${open ? " is-open" : ""}${disabled ? " is-disabled" : ""}`} ref={wrapRef}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        className="ssb-select-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openAt(selectedIndex))}
        onKeyDown={onKeyDown}
      >
        <span className="ssb-select-icon" aria-hidden="true">{icon}</span>
        <span className={`ssb-select-value${selected ? "" : " is-placeholder"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className="ssb-select-caret" aria-hidden="true" />
      </button>
      {open && (
        <ul className="ssb-select-list" id={listId} role="listbox" ref={listRef}>
          {items.map((row, index) => (
            <li
              key={row.clear ? "__clear" : row.value}
              id={optionId(index)}
              role="option"
              aria-selected={!row.clear && row.value === value}
              className={`ssb-select-opt${row.clear ? " is-clear" : ""}${!row.clear && row.value === value ? " is-chosen" : ""}${index === activeIndex ? " is-active" : ""}`}
              // The pointer keeps the highlight and the keyboard in step.
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => commit(index)}
            >
              {row.clear ? row.label : <span>{row.label}</span>}
              {!row.clear && row.value === value && <Check size={15} aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 縣市 → 地區 dependent dropdowns. 縣市 submits `region`, 地區 submits
 *  `destination`; the 地區 options follow the chosen 縣市. */
function LocationFields({
  locations,
  initialCounty,
  initialDistrict,
  countyLabel,
  districtLabel,
}: {
  locations: LocationGroup[];
  initialCounty: string;
  initialDistrict: string;
  countyLabel: string;
  districtLabel: string;
}) {
  const [county, setCounty] = useState(initialCounty);
  const [district, setDistrict] = useState(initialDistrict);
  const countyOpts: Opt[] = locations.map((l) => ({ value: l.county, label: l.label }));
  const districts = locations.find((l) => l.county === county)?.districts ?? [];
  const districtOpts: Opt[] = districts.map((d) => ({ value: d.value, label: d.label }));

  return (
    <>
      <div className="ssb-field">
        <span className="ssb-field-label">{countyLabel}</span>
        <SelectField
          name="region" icon={<MapPin size={16} />} placeholder={countyLabel}
          options={countyOpts} value={county}
          onChange={(v) => { setCounty(v); setDistrict(""); }}
        />
      </div>
      <span className="ssb-divider" />
      <div className="ssb-field">
        <span className="ssb-field-label">{districtLabel}</span>
        <SelectField
          name="destination" icon={<MapPin size={16} />} placeholder={districtLabel}
          options={districtOpts} value={district} onChange={setDistrict}
          disabled={!county}
        />
      </div>
    </>
  );
}

/** Multi-select facilities dropdown that lives INSIDE the search bar (per the
 *  brief: tags should be part of the search field, not a separate row). Writes
 *  one hidden `amenity` input per chosen facility; the panel stays open so
 *  several can be ticked at once. */
function FacilitiesField({
  name,
  label,
  options,
  defaultValues,
  countLabel,
}: {
  name: string;
  label: string;
  options: SearchOpt[];
  defaultValues: string[];
  countLabel: (n: number) => string;
}) {
  const values = options.map((o) => o.value);
  const [selected, setSelected] = useState<string[]>(defaultValues.filter((v) => values.includes(v)));
  const toggle = (v: string) => setSelected((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));

  /* The same keyboard the single-select list has. This one is a multi-select,
     so Enter/Space TICKS the active row and deliberately leaves the list open —
     picking three facilities should not mean reopening the panel three times. */
  const { open, activeIndex, setActiveIndex, wrapRef, listRef, listId, optionId, openAt, close, onKeyDown: listboxKeyDown } = useListbox(options.length);
  const onFacilitiesKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) =>
    listboxKeyDown(event, (key) => (key === "ArrowUp" ? options.length - 1 : 0), (i) => toggle(options[i].value));

  return (
    <div className={`ssb-select${open ? " is-open" : ""}`} ref={wrapRef}>
      {selected.map((v) => <input key={v} type="hidden" name={name} value={v} />)}
      <button
        type="button" className="ssb-select-btn" aria-haspopup="listbox"
        aria-expanded={open} aria-controls={listId}
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        onClick={() => (open ? close() : openAt(0))}
        onKeyDown={onFacilitiesKeyDown}
      >
        <span className="ssb-select-icon" aria-hidden="true"><SlidersHorizontal size={16} /></span>
        <span className={`ssb-select-value${selected.length ? "" : " is-placeholder"}`}>
          {selected.length ? countLabel(selected.length) : label}
        </span>
        {selected.length > 0 && <span className="ssb-count">{selected.length}</span>}
        <ChevronDown size={16} className="ssb-select-caret" aria-hidden="true" />
      </button>
      {open && (
        <ul className="ssb-select-list ssb-select-list--multi" id={listId} role="listbox" aria-multiselectable="true" ref={listRef}>
          {options.map((o, index) => {
            const on = selected.includes(o.value);
            return (
              <li key={o.value} id={optionId(index)} role="option" aria-selected={on}
                className={`ssb-select-opt${on ? " is-chosen" : ""}${index === activeIndex ? " is-active" : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => toggle(o.value)}>
                <span className={`ssb-check${on ? " is-on" : ""}`} aria-hidden="true">{on && <Check size={12} />}</span>
                <span>{o.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function StaySearchBar({
  regions,
  amenities,
  serviceOptions,
  locations,
  labels,
  initial,
  action = "/stays",
  locale = "zh",
  shortLabels,
  guestRanges,
  stayTypes,
  experienceOptions,
}: {
  regions: string[];
  amenities: string[];
  /** Canonical bilingual facility chips (value + label). Overrides `amenities`. */
  serviceOptions?: SearchOpt[];
  /** 縣市/地區 two-level location options. When set, replaces the single region select. */
  locations?: LocationGroup[];
  labels: { region: string; amenity: string; guests: string; submit: string; county?: string; district?: string };
  initial?: { region?: string; amenities?: string[]; experiences?: string[]; guests?: string; destination?: string; tag?: string };
  action?: string;
  locale?: Locale;
  shortLabels?: ShortAmenityRule[];
  /** Party-size ranges from site settings; falls back to the bundled list. */
  guestRanges?: SearchOpt[];
  /** 民宿類型 options from site settings. Empty hides the field. */
  stayTypes?: SearchOpt[];
  /** 慢域體驗 options from site settings. Empty hides the field. */
  experienceOptions?: SearchOpt[];
}) {
  const zh = locale === "zh";
  const regionOpts: Opt[] = regions.map((r) => ({ value: r, label: r }));
  // Party-size ranges → lower-bound guests value (backend: max_guests >= guests).
  const guestOpts: Opt[] = guestRanges?.length ? guestRanges : guestOptions(locale);

  return (
    <form className="ssb-form" action={action}>
      <div className="ssb">
        {locations && locations.length > 0 ? (
          <LocationFields
            locations={locations}
            initialCounty={initial?.region ?? ""}
            initialDistrict={initial?.destination ?? ""}
            countyLabel={labels.county ?? (zh ? "縣市" : "County")}
            districtLabel={labels.district ?? (zh ? "地區" : "District")}
          />
        ) : (
          <div className="ssb-field">
            <span className="ssb-field-label">{zh ? "地區" : "Region"}</span>
            <SelectField name="region" icon={<MapPin size={16} />} placeholder={labels.region} options={regionOpts} defaultValue={initial?.region ?? ""} />
          </div>
        )}
        {stayTypes && stayTypes.length > 0 && (
          <>
            <span className="ssb-divider" />
            <div className="ssb-field">
              <span className="ssb-field-label">{zh ? "類型" : "Type"}</span>
              <SelectField
                name="tag"
                icon={<Home size={16} />}
                placeholder={zh ? "選擇類型" : "Any type"}
                options={stayTypes}
                defaultValue={initial?.tag ?? ""}
              />
            </div>
          </>
        )}
        <span className="ssb-divider" />
        <div className="ssb-field ssb-field--guests">
          <span className="ssb-field-label">{zh ? "人數" : "Guests"}</span>
          <SelectField name="guests" icon={<Users size={16} />} placeholder={zh ? "選擇人數" : "Any size"} options={guestOpts} defaultValue={initial?.guests ?? ""} />
        </div>
        {(() => {
          // Facilities live INSIDE the bar as a multi-select field (per the brief:
          // tags integrated into the search, not a separate row below).
          const facOpts: SearchOpt[] = serviceOptions && serviceOptions.length > 0
            ? serviceOptions
            : amenities.map((a) => ({ value: a, label: shortAmenity(a, locale, shortLabels) }));
          if (facOpts.length === 0) return null;
          return (
            <>
              <span className="ssb-divider" />
              <div className="ssb-field">
                <span className="ssb-field-label">{labels.amenity}</span>
                <FacilitiesField
                  name="amenity" label={zh ? "選擇設施" : "Any facility"}
                  options={facOpts} defaultValues={initial?.amenities ?? []}
                  countLabel={(n) => (zh ? `已選 ${n} 項` : `${n} selected`)}
                />
              </div>
            </>
          );
        })()}
        {experienceOptions && experienceOptions.length > 0 && (
          <>
            <span className="ssb-divider" />
            <div className="ssb-field">
              <span className="ssb-field-label">{zh ? "慢域體驗" : "Experiences"}</span>
              <FacilitiesField
                name="experience"
                label={zh ? "選擇體驗" : "Any experience"}
                options={experienceOptions}
                defaultValues={initial?.experiences ?? []}
                countLabel={(n) => (zh ? `已選 ${n} 項` : `${n} selected`)}
              />
            </div>
          </>
        )}
        <button type="submit" className="ssb-submit">
          <Search size={16} /> {labels.submit}
        </button>
      </div>
    </form>
  );
}

