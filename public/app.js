const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

let jobs = [];
let candidates = [];
let interviews = [];
let currentCandidate = null;

const statuses = ["New", "Review", "Interview", "Rejected", "Hired"];

async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

function json(method, body) {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}

function notice(message, error = false) {
  $("#notice").textContent = message;
  $("#notice").classList.toggle("error", error);
}

function el(tag, text = "", className = "") {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}

function empty(box, message) {
  box.replaceChildren(el("p", message, "empty"));
}

function options(select, items, label, placeholder = "Choose an option") {
  const previousValue = select.value;

  select.replaceChildren(
    new Option(placeholder, ""),
    ...items.map(item => new Option(label(item), item.id))
  );

  if (items.some(item => String(item.id) === previousValue)) {
    select.value = previousValue;
  }
}

// Navigation tabs
$$(".tabs button").forEach(button => {
  button.addEventListener("click", () => {
    $$(".tabview").forEach(view => {
      view.classList.toggle("active", view.id === button.dataset.tab);
    });

    $$(".tabs button").forEach(item => {
      item.classList.toggle("active", item === button);
    });
  });
});

// Fetch and display the latest records
async function refresh() {
  try {
    [jobs, candidates, interviews] = await Promise.all([
      api("/api/jobs"),
      api("/api/candidates"),
      api("/api/interviews")
    ]);

    $("#jobCount").textContent = jobs.length;
    $("#candidateCount").textContent = candidates.length;

    $("#hiredCount").textContent = candidates.filter(
      candidate => candidate.status === "Hired"
    ).length;

    $("#interviewCount").textContent = interviews.filter(
      interview =>
        interview.outcome === "Scheduled" &&
        new Date(interview.scheduled_at) >= new Date()
    ).length;

    options($("#jobSelect"), jobs, job => job.title, "Choose a role");
    options($("#compareJob"), jobs, job => job.title, "Choose a role");
    options($("#interviewJob"), jobs, job => job.title, "Choose a role");

    options(
      $("#interviewCandidate"),
      candidates,
      candidate => candidate.name,
      "Choose a candidate"
    );

    options(
      $("#compareA"),
      candidates,
      candidate => candidate.name,
      "Candidate A"
    );

    options(
      $("#compareB"),
      candidates,
      candidate => candidate.name,
      "Candidate B"
    );

    renderPipeline();
    renderCandidates();
    renderInterviews();
    renderRoles();

    await renderRanking();
    await renderComparison();
  } catch (error) {
    notice(error.message, true);
  }
}

function renderPipeline() {
  const box = $("#pipeline");
  box.replaceChildren();

  statuses.forEach(status => {
    const tile = el("div", "", "stage");

    const count = candidates.filter(
      candidate => candidate.status === status
    ).length;

    tile.append(el("strong", count), el("span", status));
    box.append(tile);
  });
}

function statusSelect(candidate) {
  const select = el("select");

  select.setAttribute("aria-label", "Status for " + candidate.name);

  statuses.forEach(status => {
    select.add(new Option(status, status));
  });

  select.value = candidate.status;

  select.addEventListener("change", async () => {
    try {
      await api(
        "/api/candidates/" + candidate.id + "/status",
        json("PATCH", { status: select.value })
      );

      await refresh();
      notice("Candidate status updated.");
    } catch (error) {
      notice(error.message, true);
    }
  });

  return select;
}

// Candidate profile and editor
function openProfile(id) {
  const candidate = candidates.find(item => item.id === id);
  if (!candidate) return;

  currentCandidate = id;

  const box = $("#profileBody");
  box.replaceChildren();

  const details = [
    ["Email", candidate.email],
    ["Phone", candidate.phone || "—"],
    ["Experience", candidate.experience + " years"],
    ["Skills", candidate.skills || "—"],
    ["Status", candidate.status],
    ["Resume text", candidate.resume_text || "—"],
    ["Recruiter notes", candidate.notes || "—"]
  ];

  details.forEach(([label, value]) => {
    const row = el("div", "", "detail");
    row.append(el("strong", label), el("p", value));
    box.append(row);
  });

  const form = $("#editCandidateForm");

  [
    "name",
    "email",
    "phone",
    "skills",
    "experience",
    "resume_text",
    "notes"
  ].forEach(field => {
    form.elements[field].value = candidate[field] ?? "";
  });

  $("#profileDialog").showModal();
}

function renderCandidates() {
  const box = $("#candidateList");
  const query = $("#candidateSearch").value.toLowerCase();
  const statusFilter = $("#statusFilter").value;

  box.replaceChildren();

  const filtered = candidates.filter(candidate => {
    const matchesStatus =
      !statusFilter || candidate.status === statusFilter;

    const matchesSearch = [
      candidate.name,
      candidate.email,
      candidate.skills
    ].some(value => value.toLowerCase().includes(query));

    return matchesStatus && matchesSearch;
  });

  if (!filtered.length) {
    empty(box, "No matching candidates.");
    return;
  }

  filtered.forEach(candidate => {
    const row = el("article", "", "listItem");
    const info = el("div");

    info.append(
      el("h3", candidate.name),
      el("p", `${candidate.email} · ${candidate.experience} years`),
      el("small", candidate.skills || "No skills listed")
    );

    const actions = el("div", "", "actions");
    const view = el("button", "View details", "secondary");

    view.addEventListener("click", () => openProfile(candidate.id));
    actions.append(view, statusSelect(candidate));

    row.append(info, actions);
    box.append(row);
  });
}

function renderInterviews() {
  const box = $("#interviewList");
  box.replaceChildren();

  if (!interviews.length) {
    empty(box, "No interviews scheduled yet.");
    return;
  }

  interviews.forEach(interview => {
    const row = el("article", "", "listItem");
    const info = el("div");

    info.append(
      el("h3", interview.candidate_name),
      el(
        "p",
        `${interview.job_title} · ${
          new Date(interview.scheduled_at).toLocaleString()
        } · ${interview.format}`
      ),
      el("small", interview.notes || "No notes")
    );

    const select = el("select");
    select.setAttribute(
      "aria-label",
      "Outcome for " + interview.candidate_name
    );

    ["Scheduled", "Completed", "Cancelled"].forEach(outcome => {
      select.add(new Option(outcome, outcome));
    });

    select.value = interview.outcome;

    select.addEventListener("change", async () => {
      try {
        await api(
          "/api/interviews/" + interview.id,
          json("PATCH", { outcome: select.value })
        );

        await refresh();
        notice("Interview updated.");
      } catch (error) {
        notice(error.message, true);
      }
    });

    row.append(info, select);
    box.append(row);
  });
}

function renderRoles() {
  const box = $("#roleList");
  box.replaceChildren();

  if (!jobs.length) {
    empty(box, "No roles added yet.");
    return;
  }

  jobs.forEach(job => {
    const row = el("article", "", "listItem");

    row.append(
      el("h3", job.title),
      el(
        "p",
        `Required skills: ${job.skills || "None specified"} · ${
          job.min_experience
        } years minimum`
      ),
      el("p", job.description)
    );

    box.append(row);
  });
}

async function renderRanking() {
  const box = $("#ranking");
  const jobId = $("#jobSelect").value;

  if (!jobId) {
    empty(box, "Add or select a role to see candidate matches.");
    return;
  }

  try {
    const result = await api(
      "/api/jobs/" + encodeURIComponent(jobId) + "/rank"
    );

    box.replaceChildren();

    if (!result.ranking.length) {
      empty(box, "Add candidates to see the shortlist.");
      return;
    }

    result.ranking.forEach(candidate => {
      const card = el("article", "", "matchCard");
      const info = el("div");

      info.append(
        el("h3", candidate.name),
        el("p", `${candidate.experience} years · ${candidate.status}`)
      );

      const tags = el("div");

      candidate.matched.forEach(skill => {
        tags.append(el("span", "✓ " + skill, "pill"));
      });

      candidate.missing.forEach(skill => {
        tags.append(el("span", "Missing: " + skill, "pill missing"));
      });

      info.append(tags);

      const actions = el("div", "", "actions");
      const score = el("strong", candidate.score + "%", "score");
      const view = el("button", "View profile", "secondary");

      view.addEventListener("click", () => openProfile(candidate.id));

      actions.append(score, view);
      card.append(info, actions);
      box.append(card);
    });
  } catch (error) {
    notice(error.message, true);
  }
}

async function renderComparison() {
  const box = $("#comparison");
  const jobId = $("#compareJob").value;
  const candidateA = $("#compareA").value;
  const candidateB = $("#compareB").value;

  if (!jobId || !candidateA || !candidateB) {
    empty(box, "Select a role and two candidates to compare.");
    return;
  }

  if (candidateA === candidateB) {
    empty(box, "Choose two different candidates.");
    return;
  }

  try {
    const result = await api(
      "/api/jobs/" + encodeURIComponent(jobId) + "/rank"
    );

    box.replaceChildren();

    [candidateA, candidateB].forEach(id => {
      const candidate = result.ranking.find(
        item => String(item.id) === id
      );

      if (!candidate) return;

      const card = el("article", "", "compareCard");

      card.append(
        el("h3", candidate.name),
        el("strong", candidate.score + "% match", "score")
      );

      const details = [
        ["Current status", candidate.status],
        ["Experience", candidate.experience + " years"],
        ["Skills", candidate.skills || "—"],
        ["Matched skills", candidate.matched.join(", ") || "None"],
        ["Missing skills", candidate.missing.join(", ") || "None"],
        ["Recruiter notes", candidate.notes || "—"]
      ];

      details.forEach(([label, value]) => {
        const row = el("div", "", "detail");
        row.append(el("strong", label), el("p", value));
        card.append(row);
      });

      const view = el("button", "View full profile", "secondary");
      view.addEventListener("click", () => openProfile(candidate.id));

      card.append(view);
      box.append(card);
    });
  } catch (error) {
    notice(error.message, true);
  }
}

// Store the form reference BEFORE awaiting the API request.
function attach(formId, endpoint) {
  $(formId).addEventListener("submit", async event => {
    event.preventDefault();

    const form = event.currentTarget;

    try {
      const body = Object.fromEntries(new FormData(form));

      await api(endpoint, json("POST", body));

      form.reset();
      await refresh();
      notice("Saved successfully.");
    } catch (error) {
      notice(error.message, true);
    }
  });
}

attach("#jobForm", "/api/jobs");
attach("#candidateForm", "/api/candidates");
attach("#interviewForm", "/api/interviews");

$("#editCandidateForm").addEventListener("submit", async event => {
  event.preventDefault();

  const form = event.currentTarget;
  const candidateId = currentCandidate;

  try {
    const body = Object.fromEntries(new FormData(form));

    await api(
      "/api/candidates/" + candidateId,
      json("PATCH", body)
    );

    $("#profileDialog").close();
    await refresh();
    notice("Profile updated.");
  } catch (error) {
    notice(error.message, true);
  }
});

$("#candidateSearch").addEventListener("input", renderCandidates);
$("#statusFilter").addEventListener("change", renderCandidates);
$("#jobSelect").addEventListener("change", renderRanking);

["#compareJob", "#compareA", "#compareB"].forEach(selector => {
  $(selector).addEventListener("change", renderComparison);
});

refresh();
