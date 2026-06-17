import { BrandLoader } from "@/components/brand-loader";

// Shown by Next.js whenever a route in this segment is waiting on its server
// data — i.e. while the app is "buffering" during a navigation, and during the
// cold-start home load after the native splash hides. Same branded loader the
// boot overlay uses, so every loading moment looks consistent.
export default function Loading() {
  return <BrandLoader />;
}
