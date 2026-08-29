"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Phoenix",
  "America/Chicago",
  "America/New_York",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "Europe/London",
  "Other",
];

export default function ProfileEditPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("America/Los_Angeles");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  // Whop's photo, display-only fallback; never written back on save.
  const [whopPhoto, setWhopPhoto] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    (async () => {
      try {
        const res = await fetch("/api/profile/get");
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (stale || !data?.ok) return;
        setDisplayName(data.profile.displayName ?? "");
        setPhone(data.profile.phone ?? "");
        setTimezone(data.profile.timezone ?? "America/Los_Angeles");
        setHeadline(data.profile.headline ?? "");
        setBio(data.profile.bio ?? "");
        setPhotoUrl(data.profile.photoUrl ?? null);
        setWhopPhoto(data.whopPhotoUrl ?? null);
        setEmail(data.email ?? null);
      } catch {
        if (!stale) setError("Could not load your profile. Try refreshing.");
      } finally {
        if (!stale) setLoading(false);
      }
    })();
    return () => {
      stale = true;
    };
  }, []);

  const pickPhoto = () => fileInputRef.current?.click();

  const onPhotoChosen = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch("/api/profile/upload-photo", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data?.ok || typeof data.url !== "string") {
        throw new Error(data?.error ?? "upload failed");
      }
      setPhotoUrl(data.url);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Photo upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (displayName.trim().length < 1) {
      setError("Display name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, phone, timezone, headline, bio, photoUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? "save failed");
      router.push("/dashboard/profile");
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Save failed. Try again.");
      setSaving(false);
    }
  };

  const initial = (displayName.trim().charAt(0) || "M").toUpperCase();

  return (
    <div className="hub2-page">
      <div className="hub2-shell">
        <div className="pf-stack">
          <nav className="hub2-nav">
            <Link href="/dashboard/profile" className="hub2-menu">{"←"} Back to profile</Link>
          </nav>

          <header className="hub2-greeting">
            <div className="hub2-greeting-eyebrow">Your account</div>
            <h1 className="hub2-greeting-name">Profile Settings</h1>
          </header>

          {loading ? (
            <p className="pf-loading">Loading your profile…</p>
          ) : (
            <div className="pf-form">
              <div className="pf-photo-row">
                {photoUrl || whopPhoto ? (
                  <img className="pf-photo pf-photo-small" src={photoUrl ?? whopPhoto ?? undefined} alt="Profile photo" width={80} height={80} />
                ) : (
                  <div className="pf-photo pf-photo-small pf-photo-fallback" aria-hidden="true">{initial}</div>
                )}
                <button type="button" className="pf-photo-btn" onClick={pickPhoto} disabled={uploading}>
                  {uploading ? "Uploading…" : "Change Photo"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(e) => onPhotoChosen(e.target.files?.[0])}
                />
              </div>

              <label className="pf-field">
                <span className="pf-label">
                  Display Name <span className="pf-count">{displayName.length}/40</span>
                </span>
                <input
                  className="pf-input"
                  value={displayName}
                  maxLength={40}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                />
              </label>

              <label className="pf-field">
                <span className="pf-label">Email</span>
                <input
                  className="pf-input"
                  value={email ?? ""}
                  placeholder="Managed by Whop"
                  readOnly
                  disabled
                />
              </label>

              <label className="pf-field">
                <span className="pf-label">Phone Number</span>
                <input
                  className="pf-input"
                  type="tel"
                  value={phone}
                  maxLength={30}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 555-5555"
                />
              </label>

              <label className="pf-field">
                <span className="pf-label">Preferred Timezone</span>
                <select className="pf-input" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz.replace("_", " ")}</option>
                  ))}
                  {!TIMEZONES.includes(timezone) && <option value={timezone}>{timezone}</option>}
                </select>
              </label>

              <label className="pf-field">
                <span className="pf-label">
                  Headline <span className="pf-count">{headline.length}/120</span>
                </span>
                <input
                  className="pf-input"
                  value={headline}
                  maxLength={120}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Wholesaler in Dallas, closing my first deal"
                />
              </label>

              <label className="pf-field">
                <span className="pf-label">
                  Bio <span className="pf-count">{bio.length}/2000</span>
                </span>
                <textarea
                  className="pf-input pf-textarea"
                  value={bio}
                  maxLength={2000}
                  rows={6}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="A bit about you and what you're working on"
                />
              </label>

              {error && <p className="pf-error" role="alert">{error}</p>}

              <div className="pf-actions">
                <button type="button" className="pf-save-btn" onClick={save} disabled={saving || uploading}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <Link href="/dashboard/profile" className="pf-discard-btn">
                  Discard
                </Link>
              </div>

              <div className="hub2-section-head">
                <div className="hub2-section-title">Billing &amp; Subscription</div>
              </div>
              <Link href="/manage-membership" className="pf-billing-card">
                <div className="pf-billing-icon" aria-hidden="true">💳</div>
                <div className="pf-billing-body">
                  <div className="pf-billing-title">Manage Membership</div>
                  <div className="pf-billing-sub">View your plan, upgrade, or manage billing</div>
                </div>
                <div className="pf-billing-arrow" aria-hidden="true">{"›"}</div>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
