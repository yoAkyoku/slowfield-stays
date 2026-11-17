/**
 * Shared back-office UI kit. Every admin screen should build from these
 * instead of inventing page-specific buttons, headers, cards or fields.
 * Styles live in ./admin-ui.css (tokens are the --a-* custom properties).
 *
 * Existing shared pieces that stay where they are and are restyled by the kit:
 * AdminTable, AdminEmptyState, StatusBadge, SubmitButton, ConfirmSubmitButton,
 * AdminPagination (../modules).
 */
export { Button, ButtonLink, buttonClass } from "./Button";
export type { ButtonSize, ButtonVariant } from "./Button";
export { Card, Grid, Page, PageHeader, Stack, Toolbar } from "./Layout";
export { ActionTile, Badge, Callout, DescriptionList, ListRow, ListRows, Progress, StatCard, Tabs } from "./Display";
export type { TabItem, Tone } from "./Display";
export { Check, Field, FormActions, FormGrid, FormSection, Input, SearchInput, Select, Textarea } from "./Form";
export { CellTitle, Chips, Disclosure, InputGroup, RowActions, Segmented, TableFrame } from "./Controls";
export type { SegmentedOption } from "./Controls";
export { Dialog, DialogActions } from "./Dialog";
export { ConfirmProvider, useConfirm } from "./Confirm";
export type { AskOptions } from "./Confirm";
export { cx } from "./cx";
