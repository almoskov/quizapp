(() => {
  const TOTAL = 9;

  const countsEl = document.getElementById("category-counts");
  const totalEl = document.getElementById("total");
  const errorEl = document.getElementById("error");
  const questionsEl = document.getElementById("questions");
  const rerollBtn = document.getElementById("reroll");

  let data = {};    // { category: [{ question, answer }] }
  let counts = {};  // { category: number }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const sum = (obj) => Object.values(obj).reduce((s, n) => s + n, 0);

  // Spread TOTAL as evenly as possible, respecting how many questions each category has.
  function defaultCounts() {
    const result = {};
    Object.keys(data).forEach((c) => (result[c] = 0));
    let remaining = TOTAL;
    let progress = true;
    while (remaining > 0 && progress) {
      progress = false;
      for (const c of shuffle(Object.keys(data))) {
        if (remaining === 0) break;
        if (result[c] < data[c].length) {
          result[c]++;
          remaining--;
          progress = true;
        }
      }
    }
    return result;
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = !msg;
  }

  function renderControls() {
    countsEl.innerHTML = "";
    const total = sum(counts);

    for (const [category, items] of Object.entries(data)) {
      const wrap = document.createElement("div");
      wrap.className = "count-control";

      const name = document.createElement("span");
      name.className = "name";
      name.textContent = category;

      const minus = document.createElement("button");
      minus.type = "button";
      minus.textContent = "−";
      minus.setAttribute("aria-label", `Kevesebb kérdés: ${category}`);
      minus.disabled = counts[category] === 0;
      minus.addEventListener("click", () => changeCount(category, -1));

      const value = document.createElement("output");
      value.textContent = counts[category];

      const plus = document.createElement("button");
      plus.type = "button";
      plus.textContent = "+";
      plus.setAttribute("aria-label", `Több kérdés: ${category}`);
      plus.disabled = counts[category] >= items.length || total >= TOTAL;
      plus.addEventListener("click", () => changeCount(category, 1));

      const avail = document.createElement("span");
      avail.className = "avail";
      avail.textContent = `(${items.length} elérhető)`;

      wrap.append(name, minus, value, plus, avail);
      countsEl.appendChild(wrap);
    }

    totalEl.textContent = `Összesen: ${total} / ${TOTAL}`;
    totalEl.classList.toggle("bad", total !== TOTAL);
  }

  function changeCount(category, delta) {
    counts[category] = Math.max(0, counts[category] + delta);
    renderControls();
    if (sum(counts) === TOTAL) generate();
    else rerollBtn.disabled = true;
  }

  function generate() {
    const picked = [];
    for (const [category, n] of Object.entries(counts)) {
      shuffle(data[category])
        .slice(0, n)
        .forEach((q) => picked.push({ category, ...q }));
    }

    questionsEl.innerHTML = "";
    shuffle(picked).forEach((q, i) => {
      const card = document.createElement("article");
      card.className = "card";

      const cat = document.createElement("div");
      cat.className = "category";
      cat.textContent = `${i + 1}. ${q.category}`;

      const question = document.createElement("div");
      question.className = "question";
      question.textContent = q.question;

      card.append(cat, question);

      if (q.answer !== null && q.answer !== undefined && String(q.answer).trim() !== "") {
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = "Válasz mutatása";
        const answer = document.createElement("p");
        answer.textContent = q.answer;
        details.append(summary, answer);
        card.appendChild(details);
      } else {
        const none = document.createElement("div");
        none.className = "no-answer";
        none.textContent = "Nincs megadott válasz";
        card.appendChild(none);
      }

      questionsEl.appendChild(card);
    });

    rerollBtn.disabled = false;
  }

  async function init() {
    try {
      const res = await fetch("questions.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();

      data = {};
      for (const [category, qs] of Object.entries(raw)) {
        if (!qs || typeof qs !== "object") continue;
        const items = Object.entries(qs).map(([question, answer]) => ({ question, answer }));
        if (items.length) data[category] = items;
      }

      const available = Object.values(data).reduce((s, a) => s + a.length, 0);
      if (available < TOTAL) {
        showError(`A questions.json csak ${available} kérdést tartalmaz, legalább ${TOTAL} szükséges.`);
      }

      counts = defaultCounts();
      renderControls();
      if (sum(counts) === TOTAL) generate();
      else rerollBtn.disabled = true;
    } catch (err) {
      showError(`Nem sikerült betölteni a questions.json fájlt: ${err.message}`);
      rerollBtn.disabled = true;
    }
  }

  rerollBtn.addEventListener("click", generate);
  init();
})();
