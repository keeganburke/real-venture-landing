import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../../lib/session";
import { createAdminClient } from "../../../../lib/supabase/server";

const MAX_BYTES = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "expected multipart form" }, { status: 400 });
  }

  const file = form.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "missing photo field" }, { status: 400 });
  }
  const ext = EXTENSIONS[file.type];
  if (!ext) {
    return NextResponse.json({ ok: false, error: "png, jpg, or webp only" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "max 5MB" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const path = `${session.whopUserId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("profile-photos")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) {
    console.error("photo upload failed:", error.message);
    return NextResponse.json({ ok: false, error: "upload failed" }, { status: 500 });
  }

  const { data } = supabase.storage.from("profile-photos").getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
