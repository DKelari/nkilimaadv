(function () {
  const SLOTS = ["12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
  const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav-links");
  const year = document.querySelector("[data-year]");
  const weekSchedule = document.querySelector("#week-schedule");
  const weekCaption = document.querySelector("#week-caption");
  const weekPrev = document.querySelector("#week-prev");
  const weekNext = document.querySelector("#week-next");
  const diaryStatus = document.querySelector("#diary-status");
  const calLabel = document.querySelector("#cal-label");
  const calGrid = document.querySelector("#cal-grid");
  const calPrev = document.querySelector("#cal-prev");
  const calNext = document.querySelector("#cal-next");
  const dayLabel = document.querySelector("#day-label");
  const dayNote = document.querySelector("#day-note");
  const slotList = document.querySelector("#slot-list");
  const form = document.querySelector("#booking-form");
  const summary = document.querySelector("#selection-summary");
  const bookingStatus = document.querySelector("#booking-status");
  const confirmation = document.querySelector("#confirmation");
  const confirmationTitle = document.querySelector("#confirmation-title");
  const confirmationDetail = document.querySelector("#confirmation-detail");
  const confirmationMail = document.querySelector("#confirmation-mail");
  const confirmationAnother = document.querySelector("#confirmation-another");

  const now = nairobiParts();
  let cursor = { year: now.year, month: now.month };
  let bookings = [];
  let diaryReady = false;
  let selectedDay = null;
  let selectedTime = null;
  let weekAnchor = null;

  if (year) year.textContent = String(new Date().getFullYear());

  function setMenu(open) {
    if (!header || !toggle) return;
    header.classList.toggle("is-open", open);
    document.body.classList.toggle("nav-lock", open);
    toggle.setAttribute("aria-expanded", String(open));
    const menuLabel = toggle.querySelector(".sr-only");
    if (menuLabel) menuLabel.textContent = open ? "Close" : "Menu";
  }

  toggle?.addEventListener("click", function () {
    setMenu(!header.classList.contains("is-open"));
  });

  nav?.addEventListener("click", function (event) {
    if (event.target.closest("a")) setMenu(false);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setMenu(false);
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth >= 1080) setMenu(false);
  });

  function onScroll() {
    header?.classList.toggle("is-scrolled", window.scrollY > 8);
  }

  onScroll();
  document.addEventListener("scroll", onScroll, { passive: true });

  if (nav) {
    const links = Array.from(nav.querySelectorAll('a[href^="#"]'));
    const sections = links
      .map(function (link) {
        return document.querySelector(link.getAttribute("href"));
      })
      .filter(Boolean);

    if ("IntersectionObserver" in window && sections.length) {
      const observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            links.forEach(function (link) {
              const current = link.getAttribute("href") === "#" + entry.target.id;
              if (current) link.setAttribute("aria-current", "true");
              else link.removeAttribute("aria-current");
            });
          });
        },
        { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
      );
      sections.forEach(function (section) {
        observer.observe(section);
      });
    }
  }

  function nairobiParts(date) {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const parts = {};
    fmt.formatToParts(date || new Date()).forEach(function (part) {
      if (part.type !== "literal") parts[part.type] = part.value;
    });
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute),
    };
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function keyOf(year, month, day) {
    return year + "-" + pad(month) + "-" + pad(day);
  }

  function weekdayIndex(year, month, day) {
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    const name = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Nairobi",
      weekday: "short",
    }).format(date);
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
  }

  function addDays(year, month, day, delta) {
    const date = new Date(Date.UTC(year, month - 1, day + delta, 12));
    return nairobiParts(date);
  }

  function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  function monthIndex(year, month) {
    return year * 12 + (month - 1);
  }

  function formatLong(year, month, day) {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Nairobi",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(Date.UTC(year, month - 1, day, 12)));
  }

  function formatMonth(year, month) {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Nairobi",
      month: "long",
      year: "numeric",
    }).format(new Date(Date.UTC(year, month - 1, 1, 12)));
  }

  function formatShortMonth(year, month) {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Nairobi",
      month: "short",
    }).format(new Date(Date.UTC(year, month - 1, 1, 12)));
  }

  function formatSlot(time) {
    const startHour = Number(time.slice(0, 2));
    const endHour = startHour + 1;
    return clock(startHour, 0) + " – " + clock(endHour, 0);
  }

  function clock(hour, minute) {
    const suffix = hour >= 12 ? "p.m." : "a.m.";
    const h = hour % 12 || 12;
    return h + ":" + pad(minute) + " " + suffix;
  }

  function isWeekend(year, month, day) {
    const wd = weekdayIndex(year, month, day);
    return wd === 0 || wd === 6;
  }

  function isPastSlot(year, month, day, time) {
    const today = nairobiParts();
    const dateKey = keyOf(year, month, day);
    const todayKey = keyOf(today.year, today.month, today.day);
    if (dateKey < todayKey) return true;
    if (dateKey > todayKey) return false;
    const hour = Number(time.slice(0, 2));
    const minute = Number(time.slice(3, 5));
    return hour < today.hour || (hour === today.hour && minute <= today.minute);
  }

  function tooFar(year, month, day) {
    const today = nairobiParts();
    const start = Date.UTC(today.year, today.month - 1, today.day);
    const target = Date.UTC(year, month - 1, day);
    return (target - start) / 86400000 > 90;
  }

  function isReserved(dateKey, time) {
    return bookings.some(function (item) {
      return item.date === dateKey && item.time === time;
    });
  }

  function openCount(year, month, day) {
    if (isWeekend(year, month, day)) return 0;
    const dateKey = keyOf(year, month, day);
    return SLOTS.filter(function (time) {
      return !isPastSlot(year, month, day, time) && !isReserved(dateKey, time) && !tooFar(year, month, day);
    }).length;
  }

  function setStatus(node, message, isError) {
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("is-error", Boolean(isError));
  }

  function mondayOf(year, month, day) {
    const wd = weekdayIndex(year, month, day);
    let delta = 1 - wd;
    if (wd === 0) delta = 1;
    if (wd === 6) delta = 2;
    return addDays(year, month, day, delta);
  }

  function shownMonday() {
    if (weekAnchor) return weekAnchor;
    const today = nairobiParts();
    return mondayOf(today.year, today.month, today.day);
  }

  function formatWeek(start) {
    const end = addDays(start.year, start.month, start.day, 4);
    if (start.month === end.month && start.year === end.year) {
      return start.day + "–" + end.day + " " + formatMonth(end.year, end.month);
    }
    const short = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Nairobi",
      day: "numeric",
      month: "short",
    });
    const from = short.format(new Date(Date.UTC(start.year, start.month - 1, start.day, 12)));
    const to = short.format(new Date(Date.UTC(end.year, end.month - 1, end.day, 12)));
    return from + " – " + to + " " + end.year;
  }

  function renderWeek() {
    if (!weekSchedule) return;
    const start = shownMonday();
    const today = nairobiParts();
    const days = [0, 1, 2, 3, 4].map(function (offset) {
      return addDays(start.year, start.month, start.day, offset);
    });
    const currentMonday = mondayOf(today.year, today.month, today.day);
    const upcoming = addDays(start.year, start.month, start.day, 7);
    if (weekPrev) {
      weekPrev.disabled = keyOf(start.year, start.month, start.day) <= keyOf(currentMonday.year, currentMonday.month, currentMonday.day);
    }
    if (weekNext) weekNext.disabled = tooFar(upcoming.year, upcoming.month, upcoming.day);
    if (weekCaption) weekCaption.textContent = formatWeek(start);

    const end = addDays(start.year, start.month, start.day, 4);
    const split = start.month !== end.month || start.year !== end.year;
    const board = document.createElement("div");
    board.className = "week-board";
    const key = document.createElement("div");
    key.className = "hour-key";
    key.setAttribute("aria-hidden", "true");
    const gap = document.createElement("span");
    gap.className = "hour-key-gap";
    const labels = document.createElement("div");
    labels.className = "hour-key-row";
    SLOTS.forEach(function (time) {
      const item = document.createElement("span");
      const hour = Number(time.slice(0, 2));
      item.textContent = (hour % 12 || 12) + (hour >= 12 ? "p" : "a");
      labels.appendChild(item);
    });
    key.append(gap, labels);
    board.appendChild(key);
    days.forEach(function (day) {
      const column = document.createElement("section");
      const dateKey = keyOf(day.year, day.month, day.day);
      const current =
        selectedDay && keyOf(selectedDay.year, selectedDay.month, selectedDay.day) === dateKey;
      const isToday = keyOf(today.year, today.month, today.day) === dateKey;
      column.className = "day-col" + (current ? " is-current" : "") + (isToday ? " is-today" : "");
      const title = document.createElement("p");
      title.className = "day-col-title";
      const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      title.textContent = names[weekdayIndex(day.year, day.month, day.day)] + " " + day.day;
      if (split) {
        const month = document.createElement("span");
        month.className = "day-col-month";
        month.textContent = formatShortMonth(day.year, day.month);
        title.appendChild(month);
      }
      column.appendChild(title);
      const hours = document.createElement("div");
      hours.className = "hour-row";
      SLOTS.forEach(function (time) {
        hours.appendChild(timeChip(day, time));
      });
      column.appendChild(hours);
      board.appendChild(column);
    });
    weekSchedule.replaceChildren(board);
  }

  function timeChip(day, time) {
    const dateKey = keyOf(day.year, day.month, day.day);
    const reserved = isReserved(dateKey, time);
    const closed = isPastSlot(day.year, day.month, day.day, time) || tooFar(day.year, day.month, day.day);
    const open = !reserved && !closed && diaryReady;
    const selected =
      open &&
      selectedDay &&
      selectedTime === time &&
      keyOf(selectedDay.year, selectedDay.month, selectedDay.day) === dateKey;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "time-chip" + (reserved ? " is-held" : open ? " is-open" : " is-shut");
    if (selected) {
      chip.classList.add("is-selected");
      chip.setAttribute("aria-pressed", "true");
    }
    if (open) {
      chip.addEventListener("click", function () {
        chooseSlot(day, time);
      });
    } else {
      chip.disabled = true;
    }
    const hour = Number(time.slice(0, 2));
    chip.textContent = String(hour % 12 || 12);
    const when = formatLong(day.year, day.month, day.day) + ", " + formatSlot(time);
    chip.setAttribute(
      "aria-label",
      selected ? "Selected, " + when : open ? "Reserve " + when : (reserved ? "Reserved, " : "Closed, ") + when
    );
    return chip;
  }

  function renderCalendar() {
    if (!calGrid || !calLabel) return;
    calLabel.textContent = formatMonth(cursor.year, cursor.month);
    const today = nairobiParts();
    const min = monthIndex(today.year, today.month);
    const max = min + 3;
    if (calPrev) calPrev.disabled = monthIndex(cursor.year, cursor.month) <= min;
    if (calNext) calNext.disabled = monthIndex(cursor.year, cursor.month) >= max;

    calGrid.replaceChildren();
    DOW.forEach(function (name) {
      const cell = document.createElement("div");
      cell.className = "cal-dow";
      cell.textContent = name;
      calGrid.appendChild(cell);
    });

    const first = weekdayIndex(cursor.year, cursor.month, 1);
    const offset = (first + 6) % 7;
    for (let i = 0; i < offset; i += 1) {
      const blank = document.createElement("span");
      blank.setAttribute("aria-hidden", "true");
      calGrid.appendChild(blank);
    }

    const count = daysInMonth(cursor.year, cursor.month);
    for (let day = 1; day <= count; day += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cal-day";
      button.textContent = String(day);
      const weekend = isWeekend(cursor.year, cursor.month, day);
      const available = openCount(cursor.year, cursor.month, day);
      const closedDay =
        !diaryReady ||
        weekend ||
        tooFar(cursor.year, cursor.month, day) ||
        SLOTS.every(function (time) {
          return isPastSlot(cursor.year, cursor.month, day, time);
        });
      const isToday =
        today.year === cursor.year && today.month === cursor.month && today.day === day;
      const isSelected =
        selectedDay &&
        selectedDay.year === cursor.year &&
        selectedDay.month === cursor.month &&
        selectedDay.day === day;

      button.classList.toggle("is-today", isToday);
      button.classList.toggle("is-selected", Boolean(isSelected));
      if (closedDay) {
        button.classList.add("is-muted");
        button.disabled = true;
        button.setAttribute("aria-label", formatLong(cursor.year, cursor.month, day) + ", closed");
      } else if (available === 0) {
        button.classList.add("is-held");
        button.disabled = true;
        button.setAttribute("aria-label", formatLong(cursor.year, cursor.month, day) + ", fully reserved");
      } else {
        button.classList.add("is-open");
        button.setAttribute(
          "aria-label",
          formatLong(cursor.year, cursor.month, day) + ", " + available + " open"
        );
        button.addEventListener("click", function () {
          chooseDay({ year: cursor.year, month: cursor.month, day: day });
        });
      }
      if (!closedDay && available < SLOTS.length) {
        const reservedCount = SLOTS.filter(function (time) {
          return isReserved(keyOf(cursor.year, cursor.month, day), time);
        }).length;
        if (reservedCount) {
          const mark = document.createElement("span");
          mark.className = "mark";
          mark.setAttribute("aria-hidden", "true");
          button.appendChild(mark);
        }
      }
      calGrid.appendChild(button);
    }
  }

  function showWeekOf(day) {
    weekAnchor = mondayOf(day.year, day.month, day.day);
    cursor = { year: day.year, month: day.month };
  }

  function chooseDay(day) {
    selectedDay = day;
    selectedTime = null;
    hideConfirmation();
    showWeekOf(day);
    renderAll();
    document.querySelector(".day-col.is-current")?.scrollIntoView({ block: "nearest" });
  }

  function chooseSlot(day, time) {
    selectedDay = day;
    selectedTime = time;
    hideConfirmation();
    showWeekOf(day);
    renderAll();
    document.querySelector("#name")?.focus({ preventScroll: true });
    form?.scrollIntoView({ block: "nearest" });
  }

  function shiftWeek(delta) {
    const start = shownMonday();
    const next = addDays(start.year, start.month, start.day, delta);
    weekAnchor = next;
    cursor = { year: next.year, month: next.month };
    if (selectedDay) {
      const selectedMonday = mondayOf(selectedDay.year, selectedDay.month, selectedDay.day);
      if (keyOf(selectedMonday.year, selectedMonday.month, selectedMonday.day) !== keyOf(next.year, next.month, next.day)) {
        selectedDay = null;
        selectedTime = null;
        hideConfirmation();
      }
    }
    renderAll();
  }

  function renderDay() {
    if (!dayLabel || !dayNote) return;
    if (slotList) slotList.replaceChildren();
    const confirming = confirmation && !confirmation.hidden;
    if (confirming) {
      dayLabel.textContent = selectedDay
        ? formatLong(selectedDay.year, selectedDay.month, selectedDay.day)
        : "Hour reserved";
      dayNote.textContent = "This hour is reserved. Client names are not shown. Another hour can be chosen above.";
      if (form) form.hidden = true;
      if (summary) summary.textContent = "";
      return;
    }
    if (!selectedDay) {
      dayLabel.textContent = "Select an hour";
      dayNote.textContent = "Choose an open hour above. Saturday and Sunday are closed.";
      if (form) form.hidden = true;
      if (summary) summary.textContent = "";
      return;
    }
    dayLabel.textContent = formatLong(selectedDay.year, selectedDay.month, selectedDay.day);
    if (!selectedTime) {
      dayNote.textContent = "Select an open hour in the diary above. Each consultation ends on the hour.";
      if (form) form.hidden = true;
      if (summary) summary.textContent = "";
      return;
    }
    dayNote.textContent = "Each consultation is one hour. The last concludes at 6:00 p.m.";
    if (form) form.hidden = false;
    if (summary) {
      summary.textContent =
        formatLong(selectedDay.year, selectedDay.month, selectedDay.day) +
        " · " +
        formatSlot(selectedTime) +
        " EAT";
    }
  }

  function hideConfirmation() {
    if (confirmation) confirmation.hidden = true;
    setStatus(bookingStatus, "");
  }

  function renderAll() {
    renderWeek();
    renderCalendar();
    renderDay();
  }

  async function loadDiary() {
    if (!weekSchedule) return;
    try {
      const response = await fetch("/api/bookings", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("status");
      const data = await response.json();
      bookings = Array.isArray(data.bookings) ? data.bookings : [];
      diaryReady = true;
      setStatus(diaryStatus, "");
      renderAll();
    } catch (error) {
      diaryReady = false;
      bookings = [];
      setStatus(
        diaryStatus,
        "The diary is unavailable. Please telephone the chambers on +254 704 675028.",
        true
      );
      renderAll();
    }
  }

  form?.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!selectedDay || !selectedTime || !diaryReady) return;
    const data = new FormData(form);
    const payload = {
      date: keyOf(selectedDay.year, selectedDay.month, selectedDay.day),
      time: selectedTime,
      mode: String(data.get("mode") || ""),
      name: String(data.get("name") || "").trim(),
      email: String(data.get("email") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      country: String(data.get("country") || "").trim(),
      matter: String(data.get("matter") || "").trim(),
      notes: String(data.get("notes") || "").trim(),
    };
    setStatus(bookingStatus, "Reserving this hour…");
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(function () {
        return {};
      });
      if (!response.ok) {
        const message = body.error || "This hour could not be reserved.";
        if (response.status === 409) selectedTime = null;
        if (response.status === 409) await loadDiary();
        setStatus(bookingStatus, message, true);
        return;
      }
      form.reset();
      const virtual = form.querySelector('input[value="virtual"]');
      if (virtual) virtual.checked = true;
      form.hidden = true;
      showConfirmation(payload);
      await loadDiary();
      confirmation?.scrollIntoView({ block: "start" });
    } catch (error) {
      setStatus(
        bookingStatus,
        "The diary is unavailable. Please telephone the chambers on +254 704 675028.",
        true
      );
    } finally {
      if (submit) submit.disabled = false;
    }
  });

  function showConfirmation(payload) {
    if (!confirmation) return;
    const where =
      payload.mode === "chambers"
        ? "The consultation will be held in chambers at View Park Towers, 19th Floor, Suite 19, Utalii Lane, Nairobi."
        : "The consultation will be held by Google Meet. The chambers will send the conference link to " +
          payload.email +
          ". This page does not generate the link.";
    confirmation.hidden = false;
    if (confirmationTitle) {
      confirmationTitle.textContent = formatSlot(payload.time) + " is reserved";
    }
    if (confirmationDetail) {
      confirmationDetail.textContent =
        formatLong(selectedDay.year, selectedDay.month, selectedDay.day) +
        ". " +
        where +
        " Please write to the chambers with your particulars. The hour is already reserved on the diary.";
    }
    if (confirmationMail) {
      const subject = "Appointment reservation — " + payload.date + " " + payload.time;
      const body = [
        "Name: " + payload.name,
        "Email: " + payload.email,
        "Telephone: " + (payload.phone || "Not provided"),
        "Country: " + (payload.country || "Not provided"),
        "Meeting: " + (payload.mode === "chambers" ? "In chambers" : "Google Meet"),
        "When: " + payload.date + " " + formatSlot(payload.time) + " EAT",
        "Area: " + payload.matter,
        "",
        payload.notes || "",
      ].join("\n");
      confirmationMail.href =
        "mailto:contact@nkilimaadv.com?subject=" +
        encodeURIComponent(subject) +
        "&body=" +
        encodeURIComponent(body);
    }
    setStatus(bookingStatus, "");
    selectedTime = null;
  }

  confirmationAnother?.addEventListener("click", function () {
    hideConfirmation();
    selectedTime = null;
    renderAll();
  });

  weekPrev?.addEventListener("click", function () {
    shiftWeek(-7);
  });

  weekNext?.addEventListener("click", function () {
    shiftWeek(7);
  });

  calPrev?.addEventListener("click", function () {
    cursor.month -= 1;
    if (cursor.month < 1) {
      cursor.month = 12;
      cursor.year -= 1;
    }
    renderCalendar();
  });

  calNext?.addEventListener("click", function () {
    cursor.month += 1;
    if (cursor.month > 12) {
      cursor.month = 1;
      cursor.year += 1;
    }
    renderCalendar();
  });

  loadDiary();
})();

(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!("IntersectionObserver" in window)) return;

  document.documentElement.classList.add("motion");

  function tag(selector, kind, step) {
    document.querySelectorAll(selector).forEach(function (el, index) {
      if (el.classList.contains("reveal") || el.classList.contains("reveal-media")) return;
      el.classList.add(kind);
      el.style.setProperty("--reveal-delay", Math.min(index, 4) * step + "ms");
    });
  }

  tag(".hero-copy .kicker", "reveal", 0);
  tag(".hero h1", "reveal", 0);
  tag(".hero-subtitle", "reveal", 0);
  tag(".hero-copy .lede", "reveal", 0);
  tag(".hero-copy .actions", "reveal", 0);
  tag(".hero-meta li", "reveal", 55);
  tag(".section-head", "reveal", 0);
  tag(".deck", "reveal", 0);
  tag(".desk-board article", "reveal", 80);
  tag(".route-list li", "reveal", 70);
  tag(".practice-item > div", "reveal", 0);
  tag(".bio-copy > p", "reveal", 70);
  tag(".glance", "reveal", 0);
  tag(".affiliation-list li", "reveal", 50);
  tag(".cred-list li", "reveal", 70);
  tag(".hero-figure", "reveal-media", 0);
  tag(".hours-card", "reveal-media", 0);
  tag(".bio-portrait", "reveal-media", 0);
  tag(".practice-figure", "reveal-media", 0);

  document.querySelector(".hero h1")?.style.setProperty("--reveal-delay", "80ms");
  document.querySelector(".hero-subtitle")?.style.setProperty("--reveal-delay", "160ms");
  document.querySelector(".hero-copy .lede")?.style.setProperty("--reveal-delay", "230ms");
  document.querySelector(".hero-copy .actions")?.style.setProperty("--reveal-delay", "300ms");
  document.querySelector(".hero-figure")?.style.setProperty("--reveal-delay", "180ms");
  document.querySelector(".hours-card")?.style.setProperty("--reveal-delay", "280ms");

  const watcher = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        watcher.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
  );

  document.querySelectorAll(".reveal, .reveal-media").forEach(function (el) {
    watcher.observe(el);
  });
})();
