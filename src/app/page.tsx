// Root URL ("/") — always the public landing page.
//
// This must NEVER render the authenticated dashboard directly. The actual
// dashboard now lives at its own route: /dashboard (see src/app/dashboard/page.tsx),
// mirroring how the admin dashboard lives at /admin/dashboard.
//
// AppShell's <Gate> component (src/components/AppShell.tsx) treats "/" as a
// public route: a signed-out visitor sees this landing page, while a signed-in
// user is redirected on to /dashboard before this content ever paints.
//
// We reuse the exact same component that renders at /landing so there's a
// single source of truth for the marketing page's content/design.
export { default } from "./landing/page";
