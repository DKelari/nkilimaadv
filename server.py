#!/usr/bin/env python3
"""Chambers site and shared appointment diary."""

import json
import re
import threading
import uuid
from datetime import datetime, timedelta, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "bookings.json"
EAT = timezone(timedelta(hours=3))
LOCK = threading.Lock()
SLOTS = ["12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]
MODES = {"virtual", "chambers"}
MATTERS = {
    "Family & child law",
    "Alternative dispute resolution",
    "Commercial & civil litigation",
    "Human rights & public interest",
    "Criminal law & constitutional rights",
    "Conveyancing & property law",
    "Other",
}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^[0-9+\-().\s]{0,40}$")


def now_eat():
    return datetime.now(EAT)


def load_bookings():
    if not DATA.exists():
        return []
    try:
        data = json.loads(DATA.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    return data if isinstance(data, list) else []


def save_bookings(items):
    temporary = DATA.with_suffix(".tmp")
    temporary.write_text(json.dumps(items, indent=2), encoding="utf-8")
    temporary.replace(DATA)


def clean_line(value, limit):
    text = " ".join(str(value or "").split())
    return text[:limit]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if urlparse(self.path).path == "/api/bookings":
            self.send_json(200, {"bookings": public_bookings(load_bookings())})
            return
        super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path != "/api/bookings":
            self.send_error(404)
            return
        self.create_booking()

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def create_booking(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > 20000:
            self.send_json(400, {"error": "The booking could not be read."})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(400, {"error": "The booking could not be read."})
            return
        if not isinstance(payload, dict):
            self.send_json(400, {"error": "The booking could not be read."})
            return

        error, record = validate(payload)
        if error:
            self.send_json(400, {"error": error})
            return

        with LOCK:
            items = load_bookings()
            if any(item.get("date") == record["date"] and item.get("time") == record["time"] for item in items):
                self.send_json(409, {"error": "That hour has just been reserved. Please choose another."})
                return
            upcoming = [
                item
                for item in items
                if str(item.get("email", "")).lower() == record["email"].lower()
                and item.get("date", "") >= now_eat().date().isoformat()
            ]
            if len(upcoming) >= 2:
                self.send_json(
                    400,
                    {"error": "This email already has two upcoming consultations. Please telephone the chambers to arrange another."},
                )
                return
            items.append(record)
            save_bookings(items)

        self.send_json(
            201,
            {
                "ok": True,
                "appointment": {
                    "date": record["date"],
                    "time": record["time"],
                    "mode": record["mode"],
                },
            },
        )


def public_bookings(items):
    return [{"date": item.get("date"), "time": item.get("time")} for item in items if item.get("date") and item.get("time")]


def validate(payload):
    date = str(payload.get("date") or "")
    time = str(payload.get("time") or "")
    mode = str(payload.get("mode") or "")
    name = clean_line(payload.get("name"), 120)
    email = clean_line(payload.get("email"), 160)
    phone = clean_line(payload.get("phone"), 40)
    matter = clean_line(payload.get("matter"), 80)
    notes = clean_line(payload.get("notes"), 800)
    country = clean_line(payload.get("country"), 80)

    if time not in SLOTS:
        return "Please select an open hour from the diary.", None
    if mode not in MODES:
        return "Please choose Google Meet or a consultation in chambers.", None
    if len(name) < 2:
        return "Please enter your name.", None
    if not EMAIL_RE.match(email):
        return "Please enter a valid email address.", None
    if phone and not PHONE_RE.match(phone):
        return "Please enter a valid telephone number.", None
    if matter not in MATTERS:
        return "Please select a practice area.", None

    try:
        day = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        return "Please choose a valid date.", None
    if day.weekday() > 4:
        return "Consultations are available Monday to Friday.", None

    hour, minute = (int(part) for part in time.split(":"))
    slot = datetime(day.year, day.month, day.day, hour, minute, tzinfo=EAT)
    current = now_eat()
    if slot <= current:
        return "That hour has already passed.", None
    if slot.date() > (current + timedelta(days=90)).date():
        return "Consultations can be reserved up to 90 days ahead.", None

    record = {
        "id": str(uuid.uuid4()),
        "date": date,
        "time": time,
        "mode": mode,
        "name": name,
        "email": email,
        "phone": phone,
        "matter": matter,
        "country": country,
        "notes": notes,
        "createdAt": current.isoformat(timespec="minutes"),
    }
    return None, record


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 4173), Handler)
    print("Chambers site at http://127.0.0.1:4173")
    server.serve_forever()


if __name__ == "__main__":
    main()
