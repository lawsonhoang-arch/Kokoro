// Upgrade catalog cover URLs to their highest-resolution variant.
//
// Anime covers come from the offline DB as MyAnimeList's *standard* image
// (e.g. .../images/anime/1015/138006.jpg ≈ 225px). MAL also serves a "large"
// variant with an `l` suffix (...138006l.jpg ≈ 450px, ~3× the data) that's much
// sharper on cards and the hero. Manga covers already use the `l` variant, so
// they're left untouched. AniList URLs (if any) get their large size too.
export function hiResCover(url: string | null | undefined): string | null {
  if (!url) return null;
  let u = url.replace("://myanimelist.net/", "://cdn.myanimelist.net/");
  // MAL: insert `l` before the extension when it's the standard (digits.ext)
  // image — manga `…l.jpg` already ends in a letter, so it won't match.
  u = u.replace(
    /(\/images\/(?:anime|manga)\/\d+\/\d+)\.(jpg|jpeg|png|webp)(\?.*)?$/i,
    (_m, path, ext, qs) => `${path}l.${ext}${qs ?? ""}`,
  );
  // AniList: prefer the large cover
  u = u.replace("/cover/medium/", "/cover/large/");
  return u;
}
