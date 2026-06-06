// A template re-mounts on every navigation (unlike a layout, which persists),
// so the incoming page's `.page` element is freshly created each time and its
// CSS enter animations replay — this is what drives the prototype's
// `kk-page-fade-in` + staggered `kk-rise` section reveal. The nav sits in the
// layout above this, so it stays put. `prefers-reduced-motion` is honored by
// the keyframes in transitions.css.
export default function AppTemplate({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
