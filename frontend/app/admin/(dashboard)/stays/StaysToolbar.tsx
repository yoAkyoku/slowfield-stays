import { Search } from "lucide-react";
import { Button, ButtonLink, Input, SearchInput, Select, Toolbar } from "../../ui";

export default function StaysToolbar({
  destination,
  destinationLabel,
  filterLabel,
  keyword,
  keywordLabel,
  resetHref,
  resetLabel,
  status,
  statusLabel,
  statusLabels,
  visibility,
  visibilityLabels
}: {
  destination?: string;
  destinationLabel: string;
  filterLabel: string;
  keyword?: string;
  keywordLabel: string;
  resetHref: string;
  resetLabel: string;
  status?: string;
  statusLabel: string;
  statusLabels: Record<string, string>;
  visibility: string;
  visibilityLabels: Record<string, string>;
}) {
  return (
    <form>
      <input name="tab" type="hidden" value="list" />
      <Toolbar
        end={
          <>
            <Button type="submit" variant="primary">{filterLabel}</Button>
            <ButtonLink external href={resetHref} variant="ghost">
              {resetLabel}
            </ButtonLink>
          </>
        }
      >
        <SearchInput aria-label={keywordLabel} defaultValue={keyword} icon={<Search />} name="keyword" placeholder={keywordLabel} />
        <Input aria-label={destinationLabel} defaultValue={destination} name="destination" placeholder={destinationLabel} />
        <Select aria-label={statusLabel} defaultValue={status ?? ""} name="status">
          <option value="">{statusLabel}</option>
          <option value="draft">{statusLabels.draft}</option>
          <option value="review">{statusLabels.review}</option>
          <option value="published">{statusLabels.published}</option>
          <option value="archived">{statusLabels.archived}</option>
        </Select>
        <Select defaultValue={visibility} name="visibility">
          <option value="active">{visibilityLabels.active}</option>
          <option value="deleted">{visibilityLabels.deleted}</option>
          <option value="all">{visibilityLabels.all}</option>
        </Select>
      </Toolbar>
    </form>
  );
}
