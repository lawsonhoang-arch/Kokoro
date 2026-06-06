import "./profile.css";
import { Page } from "@/shell/Page";
import { Avatar, Button } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { ProfileTabs } from "./ProfileTabs";

type Stat = { label: string; value: string; hint: string };
const STATS: Stat[] = [
  { label: "Watched", value: "487", hint: "titles, all-time" },
  { label: "This year", value: "62", hint: "35 finished · 27 dropped" },
  { label: "Hours", value: "3 940", hint: "~164 days of TV" },
  { label: "Top genre", value: "Drama", hint: "38% of your list" },
  { label: "Followers", value: "128", hint: "↑ 12 this month" },
];

export default function ProfilePage() {
  return (
    <Page width="wide">
      {/* banner stretches edge-to-edge inside the page padding */}
      <div className="pf-banner" aria-hidden="true"></div>

      {/* HEAD: avatar + identity + actions */}
      <header className="pf-head">
        <Avatar size="xl" hue={3} />
        <div className="pf-meta">
          <h1 className="pf-name">Riley Okabe</h1>
          <span className="pf-handle">@riley · online · timezone JST</span>
          <p className="pf-bio">
            Slow, generous storytelling enjoyer. Currently rewatching Mushishi one episode per
            Sunday. Mod of the Late Night Mushishi club. Open to recommendations — gentler the
            better.
          </p>
        </div>
        <div className="pf-actions">
          <Button variant="ghost">
            <Icon name="message" size={14} />
            Message
          </Button>
          <Button variant="primary">
            <Icon name="plus" size={14} />
            Follow
          </Button>
        </div>
      </header>

      {/* STATS row */}
      <section className="pf-stats" aria-label="Profile stats">
        {STATS.map((s) => (
          <div key={s.label} className="pf-stat">
            <div className="pf-stat__label">{s.label}</div>
            <div className="pf-stat__value">{s.value}</div>
            <div className="pf-stat__hint">{s.hint}</div>
          </div>
        ))}
      </section>

      {/* SUB-TABS + panels (interactive client island) */}
      <ProfileTabs />
    </Page>
  );
}
