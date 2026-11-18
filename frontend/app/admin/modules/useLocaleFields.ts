"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";

type Fields = Record<string, Record<string, string> | undefined>;

/**
 * Read and write one field of the language tab being edited. The banner, page,
 * stay and new-site forms all keep their per-language copy as `{ zh: {...},
 * en: {...} }` and each wrote this same getter/setter pair; the state itself
 * stays in the form, which also reads other languages from it directly.
 */
export function useLocaleFields<T extends Fields>(
  fields: T,
  setFields: Dispatch<SetStateAction<T>>,
  editLocale: string,
) {
  const getField = useCallback(
    (field: string) => fields[editLocale]?.[field] ?? "",
    [fields, editLocale],
  );
  const setField = useCallback(
    (field: string, value: string) => {
      setFields((prev) => ({
        ...prev,
        [editLocale]: { ...(prev[editLocale] ?? {}), [field]: value },
      }));
    },
    [setFields, editLocale],
  );
  return { getField, setField };
}
