"""Which permissions are network-wide and which belong to one site.

This split is the whole of the multi-tenant boundary: a permission in
``GLOBAL_PERMISSIONS`` is honoured from a user's global role
(``AdminUser.role_id``) and one in ``SITE_PERMISSIONS`` from their per-site role
(``AdminUserSite.role_id``). ``admin.deps.require_permission`` is what enforces
it; ``auth.routes.me`` has to report the same answer, or the admin UI draws
menus for pages that then return 403.

It lives here, beside ``Role``, because both of those modules need it and
``admin.deps`` already imports ``auth.routes`` — importing back would be a
cycle. That is the same reason ``admin.deps`` exists at all, and the same
mistake it was created to stop: a second copy of a rule that two code paths then
disagree about.
"""

GLOBAL_PERMISSIONS = frozenset({
    "sites:read", "sites:write",
    "global_users:read", "global_users:write",
    "roles:read", "roles:write",
})

SITE_PERMISSIONS = frozenset({
    "stays:read", "stays:write",
    "cms:read", "cms:write",
    "media:read", "media:write",
    "inquiries:read", "inquiries:write",
    "newsletter:read", "newsletter:write",
    "site_users:read", "site_users:write",
})
