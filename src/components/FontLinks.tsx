// Google Fonts <link>s. The prototype loaded fonts this way, and keeping it
// lets the ported CSS reference literal family names ("Nunito", "Spline Sans
// Mono", "Spectral", …) verbatim. React 19 hoists these into <head>; the
// `precedence` prop on the stylesheet makes React manage + de-dupe it.
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  "family=Nunito:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700&" +
  "family=Nunito+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&" +
  "family=Spectral:ital,wght@0,400;0,500;0,600;1,400&" +
  "family=Figtree:wght@400;500;600;700;800&" +
  "family=Spline+Sans+Mono:wght@400;500;600&" +
  "family=JetBrains+Mono:wght@400;500;600&display=swap";

export function FontLinks() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link rel="stylesheet" href={FONTS_HREF} precedence="high" />
    </>
  );
}
