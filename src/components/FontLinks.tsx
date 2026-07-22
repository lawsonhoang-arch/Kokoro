// Google Fonts <link>s. React 19 hoists these into <head>; the `precedence`
// prop on the stylesheet makes React manage + de-dupe it.
//
// The app runs on TWO fonts: Nunito for main text, Hanken Grotesk for subtext
// (labels, counts, meta, captions). Everything else the prototype pulled in
// (Nunito Sans, Spectral, Figtree, two monos) has been retired.
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  "family=Nunito:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700&" +
  "family=Hanken+Grotesk:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap";

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
