const SLOTS = ["12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
const MODES = new Set(["virtual", "chambers"]);
const MATTERS = new Set([
  "Family & child law",
  "Alternative dispute resolution",
  "Commercial & civil litigation",
  "Human rights & public interest",
  "Criminal law & constitutional rights",
  "Conveyancing & property law",
  "Other",
]);
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^[0-9+\-().\s]{0,40}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === "nkilimaadv.com") {
      url.hostname = "www.nkilimaadv.com";
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === "/google832593f514e966a9.html") {
      return new Response("google-site-verification: google832593f514e966a9.html\n", {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    if (url.pathname === "/api/bookings") {
      if (request.method === "GET") return listBookings(env);
      if (request.method === "POST") return createBooking(request, env);
      return json({ error: "The booking could not be read." }, 404);
    }
    return env.ASSETS.fetch(request);
  },
};

async function listBookings(env) {
  const rows = await env.DB.prepare("SELECT date, time FROM bookings").all();
  return json({
    bookings: (rows.results || []).filter((item) => item.date && item.time),
  });
}

async function createBooking(request, env) {
  const raw = await request.text();
  if (!raw || raw.length > 20000) {
    return json({ error: "The booking could not be read." }, 400);
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "The booking could not be read." }, 400);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return json({ error: "The booking could not be read." }, 400);
  }

  const error = validate(payload);
  if (error) return json({ error: error.message }, error.status);

  const record = buildRecord(payload);
  const today = eatNow().isoDate;
  try {
    const existing = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM bookings WHERE date = ? AND time = ?"
    )
      .bind(record.date, record.time)
      .first();
    if (existing && existing.count > 0) {
      return json({ error: "That hour has just been reserved. Please choose another." }, 409);
    }
    const upcoming = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM bookings WHERE lower(email) = ? AND date >= ?"
    )
      .bind(record.email.toLowerCase(), today)
      .first();
    if (upcoming && upcoming.count >= 2) {
      return json(
        {
          error:
            "This email already has two upcoming consultations. Please telephone the chambers to arrange another.",
        },
        400
      );
    }
    await env.DB.prepare(
      `INSERT INTO bookings
        (id, date, time, mode, name, email, phone, matter, country, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        record.id,
        record.date,
        record.time,
        record.mode,
        record.name,
        record.email,
        record.phone,
        record.matter,
        record.country,
        record.notes,
        record.createdAt
      )
      .run();
  } catch (caught) {
    const message = String(caught && caught.message ? caught.message : caught);
    if (message.includes("UNIQUE") || message.includes("constraint")) {
      return json({ error: "That hour has just been reserved. Please choose another." }, 409);
    }
    return json({ error: "This hour could not be reserved." }, 500);
  }

  return json(
    {
      ok: true,
      appointment: { date: record.date, time: record.time, mode: record.mode },
    },
    201
  );
}

function validate(payload) {
  const date = String(payload.date || "");
  const time = String(payload.time || "");
  const mode = String(payload.mode || "");
  const name = cleanLine(payload.name, 120);
  const email = cleanLine(payload.email, 160);
  const phone = cleanLine(payload.phone, 40);
  const matter = cleanLine(payload.matter, 80);

  if (!SLOTS.includes(time)) return { status: 400, message: "Please select an open hour from the diary." };
  if (!MODES.has(mode)) return { status: 400, message: "Please choose Google Meet or a consultation in chambers." };
  if (name.length < 2) return { status: 400, message: "Please enter your name." };
  if (!EMAIL_RE.test(email)) return { status: 400, message: "Please enter a valid email address." };
  if (phone && !PHONE_RE.test(phone)) return { status: 400, message: "Please enter a valid telephone number." };
  if (!MATTERS.has(matter)) return { status: 400, message: "Please select a practice area." };
  if (!validDate(date)) return { status: 400, message: "Please choose a valid date." };
  if (isWeekend(date)) return { status: 400, message: "Consultations are available Monday to Friday." };

  const slot = Date.parse(`${date}T${time}:00+03:00`);
  if (Number.isNaN(slot) || slot <= Date.now()) {
    return { status: 400, message: "That hour has already passed." };
  }
  if (date > addDays(eatNow().isoDate, 90)) {
    return { status: 400, message: "Consultations can be reserved up to 90 days ahead." };
  }
  return null;
}

function buildRecord(payload) {
  return {
    id: crypto.randomUUID(),
    date: String(payload.date),
    time: String(payload.time),
    mode: String(payload.mode),
    name: cleanLine(payload.name, 120),
    email: cleanLine(payload.email, 160),
    phone: cleanLine(payload.phone, 40),
    matter: cleanLine(payload.matter, 80),
    country: cleanLine(payload.country, 80),
    notes: cleanLine(payload.notes, 800),
    createdAt: eatNow().createdAt,
  };
}

function cleanLine(value, limit) {
  return String(value || "").split(/\s+/).filter(Boolean).join(" ").slice(0, limit);
}

function validDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isWeekend(value) {
  const weekday = new Date(`${value}T12:00:00+03:00`).getUTCDay();
  return weekday === 0 || weekday === 6;
}

function eatNow(now = new Date()) {
  const shifted = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const pad = (value) => String(value).padStart(2, "0");
  const year = shifted.getUTCFullYear();
  const month = pad(shifted.getUTCMonth() + 1);
  const day = pad(shifted.getUTCDate());
  const hour = pad(shifted.getUTCHours());
  const minute = pad(shifted.getUTCMinutes());
  return {
    isoDate: `${year}-${month}-${day}`,
    createdAt: `${year}-${month}-${day}T${hour}:${minute}+03:00`,
  };
}

function addDays(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
