from app.modules.cms.schemas import BannerRead, PageRead, SeoMeta

PUBLIC_BANNERS = [
    BannerRead(
        id=1,
        title="Private stays with a sense of place",
        subtitle="A curated collection of intimate villas, mountain houses, and slow coastal retreats.",
        image_url="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=80",
        cta_label="Explore stays",
        cta_href="/stays",
        sort_order=1,
        status="published",
    )
]

PUBLIC_PAGES = {
    "experience": PageRead(
        id=1,
        slug="experience",
        title="The Slowfield Stays Experience",
        summary="Small-scale hospitality selected for architecture, atmosphere, and thoughtful service.",
        body="We collect homes and boutique stays where the destination is part of the design. Each stay is reviewed for privacy, comfort, service response, and a clear sense of place.",
        content_type="experience",
        status="published",
        seo=SeoMeta(
            title="Private boutique staycation experience",
            description="Curated villas and boutique retreats for private holidays.",
        ),
        published_at=None,
        route_category="experience",
        public_path="/experience/experience",
    ),
    "privacy": PageRead(
        id=2,
        slug="privacy",
        title="Privacy Policy",
        summary="How inquiry data is used.",
        body="Inquiry details are used only to respond to stay requests and service follow-up.",
        content_type="privacy",
        status="published",
        seo=SeoMeta(title="Privacy Policy", description="Slowfield Stays privacy policy."),
        published_at=None,
        route_category="privacy",
        public_path="/privacy/privacy",
    ),
}
