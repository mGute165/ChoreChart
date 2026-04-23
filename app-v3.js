const sb = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);

const authScreen = document.getElementById("authScreen");
const appScreen = document.getElementById("appScreen");
const sessionBar = document.getElementById("sessionBar");
const userChip = document.getElementById("userChip");
const householdTitle = document.getElementById("householdTitle");
const kidsWrap = document.getElementById("kidsWrap");
const choreKid = document.getElementById("choreKid");
const activityWrap = document.getElementById("activityWrap");
const authMessage = document.getElementById("authMessage");

let currentProfile = null;
let currentHouseholdId = null;
let kids = [];
let chores = [];
let completions = [];

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();

    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    document.querySelectorAll(".pane").forEach((x) => x.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");

    setAuthMessage("");
  });
});

document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setAuthMessage("Creating household...");

  const householdName = document.getElementById("signupHousehold").value.trim();
  const displayName = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;

  try {
    const { error: signUpError } = await sb.auth.signUp({
      email,
      password
    });

    if (signUpError && !signUpError.message.toLowerCase().includes("already registered")) {
      setAuthMessage(signUpError.message, true);
      return;
    }

    const { data: loginData, error: loginError } = await sb.auth.signInWithPassword({
      email,
      password
    });

    if (loginError) {
      setAuthMessage("Signup worked but login failed: " + loginError.message, true);
      return;
    }

    if (!loginData.session) {
      setAuthMessage("No login session. Confirm Email must be OFF in Supabase.", true);
      return;
    }

    const { error: rpcError } = await sb.rpc("create_household_and_profile", {
      household_name: householdName,
      display_name: displayName
    });

    if (rpcError) {
      setAuthMessage(rpcError.message, true);
      return;
    }

    setAuthMessage("Household created. Loading app...");
    await bootApp();
  } catch (err) {
    setAuthMessage(err.message || "Signup failed.", true);
  }
});
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setAuthMessage("Logging in...");

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  try {
    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setAuthMessage(error.message, true);
      return;
    }

    if (!data.session) {
      setAuthMessage("Login failed: no active session returned.", true);
      return;
    }

    setAuthMessage("Login successful. Loading app...");
    await bootApp();
  } catch (err) {
    setAuthMessage(err.message || "Login failed.", true);
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await sb.auth.signOut();

  currentProfile = null;
  currentHouseholdId = null;

  authScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
  sessionBar.classList.add("hidden");

  setAuthMessage("");
});

document.getElementById("refreshBtn").addEventListener("click", async () => {
  await loadHouseholdData();
});

document.getElementById("kidForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("kidName").value.trim();
  const totalPoints = parseInt(document.getElementById("kidPoints").value || "0", 10);

  const { error } = await sb.from("kids").insert({
    household_id: currentHouseholdId,
    name,
    total_points: totalPoints
  });

  if (error) {
    alert(error.message);
    return;
  }

  e.target.reset();
  document.getElementById("kidPoints").value = 0;

  await loadHouseholdData();
});

document.getElementById("choreForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const kid_id = choreKid.value;
  const name = document.getElementById("choreName").value.trim();
  const points = parseInt(document.getElementById("chorePoints").value || "0", 10);
  const is_mandatory = document.getElementById("choreMandatory").value === "true";

  const { error } = await sb.from("chores").insert({
    household_id: currentHouseholdId,
    kid_id,
    name,
    points,
    is_mandatory
  });

  if (error) {
    alert(error.message);
    return;
  }

  e.target.reset();
  document.getElementById("chorePoints").value = 10;
  document.getElementById("choreMandatory").value = "true";

  await loadHouseholdData();
});

async function bootApp() {
  try {
    const { data: sessionData } = await sb.auth.getSession();
    const session = sessionData.session;

    if (!session) {
      authScreen.classList.remove("hidden");
      appScreen.classList.add("hidden");
      sessionBar.classList.add("hidden");
      return;
    }

    const { data: profileRows, error } = await sb
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .limit(1);

    if (error) {
      setAuthMessage(error.message, true);
      return;
    }

    if (!profileRows || !profileRows.length) {
      setAuthMessage("No profile found for this login. If you created this user before the fix, delete the user in Supabase Auth and sign up again.", true);
      return;
    }

    currentProfile = profileRows[0];
    currentHouseholdId = currentProfile.household_id;

    authScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    sessionBar.classList.remove("hidden");

    userChip.textContent = currentProfile.display_name || session.user.email;

    await loadHouseholdData();
  } catch (err) {
    setAuthMessage(err.message || "Could not load app.", true);
  }
}

async function loadHouseholdData() {
  const [{ data: householdRows }, { data: kidRows }, { data: choreRows }] =
    await Promise.all([
      sb.from("households").select("*").eq("id", currentHouseholdId).limit(1),
      sb.from("kids").select("*").eq("household_id", currentHouseholdId).order("name"),
      sb.from("chores").select("*").eq("household_id", currentHouseholdId).order("name")
    ]);

  kids = kidRows || [];
  chores = choreRows || [];

  const today = new Date().toISOString().slice(0, 10);

  const { data: completionRows } = await sb
    .from("completions")
    .select("*")
    .eq("household_id", currentHouseholdId)
    .eq("date", today);

  completions = completionRows || [];

  householdTitle.textContent = householdRows?.[0]?.name || "Household";

  renderKidOptions();
  renderKids();
  await renderActivity();
}

function renderKidOptions() {
  choreKid.innerHTML = "";

  for (const kid of kids) {
    const opt = document.createElement("option");
    opt.value = kid.id;
    opt.textContent = kid.name;
    choreKid.appendChild(opt);
  }
}

function renderKids() {
  kidsWrap.innerHTML = "";

  const kidTmpl = document.getElementById("kidTemplate");
  const choreTmpl = document.getElementById("choreTemplate");

  for (const kid of kids) {
    const card = kidTmpl.content.firstElementChild.cloneNode(true);

    card.querySelector(".kid-name").textContent = kid.name;
    card.querySelector(".points-line").textContent =
      `Total points: ${kid.total_points || 0} ($${((kid.total_points || 0) / 100).toFixed(2)})`;

    const choreBox = card.querySelector(".chores");
    const kidChores = chores.filter((c) => c.kid_id === kid.id);

    if (!kidChores.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "No chores yet.";
      choreBox.appendChild(empty);
    }

    for (const chore of kidChores) {
      const btn = choreTmpl.content.firstElementChild.cloneNode(true);

      btn.querySelector(".chore-label").textContent = chore.name;
      btn.querySelector(".chore-meta").textContent =
        `${chore.points} pts • ${chore.is_mandatory ? "mandatory" : "optional"}`;

      const today = new Date().toISOString().slice(0, 10);

      const alreadyDone = completions.some((c) =>
        c.kid_id === kid.id &&
        c.chore_id === chore.id &&
        c.date === today &&
        c.status === "done"
      );

      if (alreadyDone) {
        btn.classList.add("done");
      }

      btn.addEventListener("click", async () => {
        await markDone(kid, chore);
      });

      choreBox.appendChild(btn);
    }

    kidsWrap.appendChild(card);
  }
}

async function markDone(kid, chore) {
  const today = new Date().toISOString().slice(0, 10);

  const existing = completions.find((c) =>
    c.kid_id === kid.id &&
    c.chore_id === chore.id &&
    c.date === today
  );

  const { error } = await sb.from("completions").upsert(
    {
      household_id: currentHouseholdId,
      kid_id: kid.id,
      chore_id: chore.id,
      date: today,
      status: "done",
      updated_by: currentProfile.id
    },
    {
      onConflict: "household_id,kid_id,chore_id,date"
    }
  );

  if (error) {
    alert(error.message);
    return;
  }

  if (!existing || existing.status !== "done") {
    await sb
      .from("kids")
      .update({
        total_points: (kid.total_points || 0) + (chore.points || 0)
      })
      .eq("id", kid.id);

    await sb.from("activity_log").insert({
      household_id: currentHouseholdId,
      kid_id: kid.id,
      chore_id: chore.id,
      message: `${kid.name} completed ${chore.name} for ${chore.points} points.`,
      created_by: currentProfile.id
    });
  }

  await loadHouseholdData();
}

async function renderActivity() {
  const { data } = await sb
    .from("activity_log")
    .select("*")
    .eq("household_id", currentHouseholdId)
    .order("created_at", { ascending: false })
    .limit(20);

  activityWrap.innerHTML = "";

  if (!data || !data.length) {
    activityWrap.textContent = "No activity yet.";
    return;
  }

  for (const item of data) {
    const row = document.createElement("div");
    row.className = "kid-card";
    row.innerHTML = `
      <div>${item.message}</div>
      <div class="small">${item.created_at || ""}</div>
    `;
    activityWrap.appendChild(row);
  }
}

function setAuthMessage(msg, isError = false) {
  authMessage.textContent = msg || "";
  authMessage.style.color = isError ? "#b91c1c" : "#0f766e";
}

(async function init() {
  const { data } = await sb.auth.getSession();

  if (data.session) {
    await bootApp();
  }
})();
