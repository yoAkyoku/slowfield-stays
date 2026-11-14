"use client";

import { useEffect, useRef, useState } from "react";
import { contentCategoryFromType } from "../../modules/contentRoutes";

type PreviewState = {
  description: string;
  image: string;
  title: string;
  url: string;
};

function fieldValue(form: HTMLFormElement | null, name: string) {
  if (!form) return "";
  const field = form.elements.namedItem(name);
  if (field instanceof RadioNodeList) {
    return String(field.value ?? "");
  }
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
    return field.value;
  }
  return "";
}

export default function SeoPreview({
  defaults,
  labels,
  siteUrl,
  slugMode,
  pageId
}: {
  defaults: PreviewState;
  labels: {
    description: string;
    imageMissing: string;
    searchPreview: string;
    sharePreview: string;
  };
  siteUrl: string;
  slugMode: "page" | "stay";
  pageId?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState(defaults);

  /* The origin this admin is being served from, which is the origin the public
     site is served from too — Caddy routes both through the same host.

     The `siteUrl` prop comes from NEXT_PUBLIC_SITE_URL, and that variable is not
     among the build args the production compose passes, so it fell through to
     the literal "http://localhost:3000". Every editor on the live site was shown
     a search-result preview claiming their page would be at localhost — the one
     question this panel exists to answer, answered wrongly. Reading it from the
     browser cannot drift from wherever the admin is actually deployed, and needs
     no new configuration. The prop stays as the server-render value so the first
     paint has something sensible and hydration matches. */
  const [origin, setOrigin] = useState(siteUrl);
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const form = ref.current?.closest("form") ?? null;

    function buildUrl() {
      const canonical = fieldValue(form, "seo_canonical");
      if (canonical) return canonical;
      const slug = fieldValue(form, "slug");
      if (slugMode === "page") {
        const contentType = fieldValue(form, "content_type") || "page";
        const category = contentCategoryFromType(contentType);
        const identifier = slug || (pageId ? String(pageId) : "draft-id");
        return `${origin}/${category}/${identifier}`;
      }
      return `${origin}/stays/${slug || "stay-slug"}`;
    }

    function update() {
      const title = fieldValue(form, "seo_title") || fieldValue(form, "title") || fieldValue(form, "name") || defaults.title;
      const description = fieldValue(form, "seo_description") || fieldValue(form, "summary") || defaults.description;
      const image = fieldValue(form, "seo_og_image") || fieldValue(form, "hero_image_url") || defaults.image;
      setPreview({ title, description, image, url: buildUrl() });
    }

    update();
    form?.addEventListener("input", update);
    form?.addEventListener("change", update);
    return () => {
      form?.removeEventListener("input", update);
      form?.removeEventListener("change", update);
    };
  }, [defaults, origin, slugMode, pageId]);

  return (
    <div className="seo-preview" ref={ref}>
      <div>
        <span className="admin-action-kicker">{labels.searchPreview}</span>
        <div className="seo-preview-card">
          <span className="seo-preview-url">{preview.url}</span>
          <strong>{preview.title}</strong>
          <p>{preview.description}</p>
        </div>
      </div>
      <div>
        <span className="admin-action-kicker">{labels.sharePreview}</span>
        <div className="seo-share-preview">
          {preview.image ? <img src={preview.image} alt="" /> : <div>{labels.imageMissing}</div>}
          <strong>{preview.title}</strong>
          <p>{preview.description}</p>
        </div>
      </div>
    </div>
  );
}
