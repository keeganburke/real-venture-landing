// First-14-days welcome from William. joinedAt is resolved by
// dashboard/page.tsx as whop_joined_at, else intake_completed_at, else the
// profile row's created_at. Photo: /founders/will.jpg (the same file the
// onboarding Welcome and SpotlightTour use); /team/william-headshot.png does
// not exist in this repo.
const WILLIAM_SRC = "/founders/will.jpg";
const WELCOME_WINDOW_DAYS = 14;

export default function WilliamWelcome({
  joinedAt,
  firstName,
}: {
  joinedAt: string | null;
  firstName: string;
}) {
  if (!joinedAt) return null;
  const joinedMs = new Date(joinedAt).getTime();
  if (Number.isNaN(joinedMs)) return null;
  const days = (Date.now() - joinedMs) / 86400000;
  if (days > WELCOME_WINDOW_DAYS) return null;

  return (
    <div className="william-welcome">
      <img src={WILLIAM_SRC} alt="William" className="william-avatar" width={56} height={56} />
      <div className="william-body">
        <div className="william-name">A message from William</div>
        <p className="william-text">
          {`Hey ${firstName}, William here. Real quick - welcome to Real Venture. The first thing to do is post an intro in #introductions on Discord. Name, where you're from, why you joined. 30 seconds. Everything you need to close your first deal is here in the hub. First 3 days matters most. If you get stuck at any point, DM me directly. Real answer, from me, not a bot.`}
        </p>
        <div className="william-sign">- William</div>
      </div>
    </div>
  );
}
