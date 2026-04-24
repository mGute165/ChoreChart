const db = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const views = { auth:$("authView"), home:$("homeView"), kid:$("kidView"), admin:$("adminView") };
let session=null, profile=null, household=null, kids=[], chores=[], completions=[], selectedKidId=null;
let profiles=[];
let selectedTimelineKidId=null;
let adminUnlockedUntil = Number(sessionStorage.getItem("adminUnlockedUntil") || "0");
const DAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const AVATARS=["🦖","🚀","🏎️","🤖","🎮","🦄","🧜‍♀️","👑","🐶","🐱","🦸","⚽","🌈","🦋","🐉","⭐","🔥","🍭","🏀","🎸"];
const THEMES=[{id:"race",name:"Race Cars",emoji:"🏎️",color:"#ef4444",bg:"linear-gradient(135deg,#fee2e2,#fff7ed)"},{id:"space",name:"Space",emoji:"🚀",color:"#7c3aed",bg:"linear-gradient(135deg,#312e81,#c4b5fd)"},{id:"dino",name:"Dinosaurs",emoji:"🦖",color:"#16a34a",bg:"linear-gradient(135deg,#dcfce7,#fef9c3)"},{id:"games",name:"Video Games",emoji:"🎮",color:"#2563eb",bg:"linear-gradient(135deg,#dbeafe,#ede9fe)"},{id:"unicorn",name:"Unicorns",emoji:"🦄",color:"#db2777",bg:"linear-gradient(135deg,#fce7f3,#e0f2fe)"},{id:"ocean",name:"Ocean",emoji:"🌊",color:"#0891b2",bg:"linear-gradient(135deg,#cffafe,#dbeafe)"},{id:"sports",name:"Sports",emoji:"⚽",color:"#ea580c",bg:"linear-gradient(135deg,#ffedd5,#fef3c7)"},{id:"heroes",name:"Superheroes",emoji:"🦸",color:"#dc2626",bg:"linear-gradient(135deg,#fee2e2,#dbeafe)"}];
const PALETTES=[{id:"blue",name:"Bright Blue",p:"#1d4ed8",s:"#93c5fd"},{id:"green",name:"Neon Green",p:"#16a34a",s:"#bbf7d0"},{id:"pink",name:"Candy Pink",p:"#db2777",s:"#fbcfe8"},{id:"purple",name:"Purple Pop",p:"#7c3aed",s:"#ddd6fe"},{id:"orange",name:"Sunset",p:"#ea580c",s:"#fed7aa"}];
const BACKGROUNDS=[{id:"default",name:"Sky Candy",css:"linear-gradient(180deg,#eff6ff,#fdf2f8 45%,#ecfeff)"},{id:"rainbow",name:"Soft Rainbow",css:"linear-gradient(135deg,#fee2e2,#fef3c7,#dcfce7,#dbeafe,#ede9fe)"},{id:"night",name:"Night Glow",css:"linear-gradient(135deg,#0f172a,#1e3a8a,#312e81)"},{id:"mint",name:"Mint",css:"linear-gradient(135deg,#ecfdf5,#d1fae5,#e0f2fe)"},{id:"sun",name:"Sunshine",css:"linear-gradient(135deg,#fef3c7,#fed7aa,#fee2e2)"}];

function todayISO(){const tz=household?.timezone||"America/Phoenix";return new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function parseISODate(s){const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)}
function addDays(date,days){const d=new Date(date);d.setDate(d.getDate()+days);return d}
function isoFromDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function dayName(iso){return DAYS[parseISODate(iso).getDay()]}
function weekStartISO(offset=0){const t=parseISODate(todayISO());return isoFromDate(addDays(t,-t.getDay()+offset*7))}
function weekDates(startISO){const s=parseISODate(startISO);return Array.from({length:7},(_,i)=>isoFromDate(addDays(s,i)))}
function money(points){return `$${((points||0)/100).toFixed(2)}`}
function getTheme(id){return THEMES.find(t=>t.id===id)||THEMES[0]} function getPalette(id){return PALETTES.find(p=>p.id===id)||PALETTES[0]} function getBackground(id){return BACKGROUNDS.find(b=>b.id===id)||BACKGROUNDS[0]}
function choreDueOn(chore,iso){if(chore.frequency==="weekly")return true;return (chore.required_days||"").split(",").includes(dayName(iso))}
function completionFor(choreId,iso){return completions.find(c=>c.chore_id===choreId&&c.date===iso)}
function effectiveStatus(chore,iso){const c=completionFor(chore.id,iso);if(c)return c.status;if(!choreDueOn(chore,iso))return"na";if(iso<todayISO()&&chore.chore_type==="mandatory")return"missed";return"open"}
function flash(msg,type="success"){$("flashWrap").innerHTML=`<div class="flash ${type}">${msg}</div>`;setTimeout(()=>$("flashWrap").innerHTML="",6000)}
function openAuthTab(panelId){document.querySelectorAll(".tab,.tab-panel").forEach(x=>x.classList.remove("active"));const tab=document.querySelector(`[data-tab="${panelId}"]`);if(tab)tab.classList.add("active");$(panelId)?.classList.add("active")}
function showView(name){Object.values(views).forEach(v=>v.classList.add("hidden"));views[name].classList.remove("hidden");["homeBtn","adminBtn","logoutBtn","mobileNav"].forEach(id=>$(id).classList.toggle("hidden",!session))}
function applyBackground(){document.body.style.background=getBackground(household?.main_background||"default").css}

function fillStaticOptions(){const fill=(el,arr)=>el.innerHTML=arr.map(x=>`<option value="${x.id}">${x.name||x.id}</option>`).join("");$("newKidAvatar").innerHTML=AVATARS.map(a=>`<option value="${a}">${a}</option>`).join("");fill($("newKidTheme"),THEMES);fill($("newKidPalette"),PALETTES);fill($("mainBackgroundInput"),BACKGROUNDS);$("dayChecks").innerHTML=DAYS.map(d=>`<span class="chip"><label><input type="checkbox" value="${d}" checked> ${d}</label></span>`).join("")}
function wireEvents(){document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>openAuthTab(b.dataset.tab)));$("signupForm").addEventListener("submit",signup);$("loginForm").addEventListener("submit",login);$("joinForm").addEventListener("submit",joinFamily);$("forgotForm").addEventListener("submit",forgotPassword);$("resetForm").addEventListener("submit",resetPassword);$("forgotLink").addEventListener("click",e=>{e.preventDefault();openAuthTab("forgotBox")});$("logoutBtn").addEventListener("click",logout);$("homeBtn").addEventListener("click",()=>{renderHome();showView("home")});$("adminBtn").addEventListener("click",()=>{showAdminWithLock()});$("brandHome").addEventListener("click",e=>{e.preventDefault();if(session){renderHome();showView("home")}});$("syncBtn").addEventListener("click",loadAllData);$("mobileHome").addEventListener("click",e=>{e.preventDefault();renderHome();showView("home")});$("mobileAdmin").addEventListener("click",e=>{e.preventDefault();showAdminWithLock()});$("mobileRefresh").addEventListener("click",async e=>{e.preventDefault();await loadAllData()});$("addKidForm").addEventListener("submit",addKid);$("familySettingsForm").addEventListener("submit",saveFamilySettings);$("adminUnlockForm").addEventListener("submit",unlockAdmin);$("addChoreForm").addEventListener("submit",addChoreToKids);$("saveAdminChangesBtn").addEventListener("click",saveAdminChanges)}


function isAdminUnlocked() {
  return Date.now() < adminUnlockedUntil;
}

function showAdminWithLock() {
  showView("admin");
  if (isAdminUnlocked()) {
    $("adminLockCard").classList.add("hidden");
    $("adminContent").classList.remove("hidden");
    renderAdmin();
  } else {
    $("adminLockCard").classList.remove("hidden");
    $("adminContent").classList.add("hidden");
  }
}

async function unlockAdmin(e) {
  e.preventDefault();
  try {
    const { data: userData } = await db.auth.getUser();
    const email = userData?.user?.email;
    const password = $("adminUnlockPassword").value;
    if (!email) throw new Error("Could not find logged-in email.");
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    adminUnlockedUntil = Date.now() + (15 * 60 * 1000);
    sessionStorage.setItem("adminUnlockedUntil", String(adminUnlockedUntil));
    $("adminUnlockPassword").value = "";
    $("adminLockCard").classList.add("hidden");
    $("adminContent").classList.remove("hidden");
    renderAdmin();
    flash("Admin unlocked for 15 minutes.");
  } catch (err) {
    flash(err.message || "Admin unlock failed.", "error");
  }
}

async function signup(e){e.preventDefault();try{flash("Creating family...");const email=$("signupEmail").value.trim(),password=$("signupPassword").value,displayName=$("signupName").value.trim(),householdName=$("signupHousehold").value.trim();const {error:su}=await db.auth.signUp({email,password});if(su&&!su.message.toLowerCase().includes("already registered"))throw su;const {data,error:li}=await db.auth.signInWithPassword({email,password});if(li)throw li;session=data.session;const {error:rpc}=await db.rpc("create_household_and_profile",{household_name:householdName,display_name:displayName});if(rpc)throw rpc;await loadProfileAndData();showView("home");flash("Family created.")}catch(err){flash(err.message||"Signup failed.","error")}}
async function login(e){e.preventDefault();try{const {data,error}=await db.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});if(error)throw error;session=data.session;await loadProfileAndData();showView("home");flash("Logged in.")}catch(err){flash(err.message||"Login failed.","error")}}

async function joinFamily(e){
  e.preventDefault();
  try{
    flash("Joining family...");
    const email=$("joinEmail").value.trim();
    const password=$("joinPassword").value;
    const displayName=$("joinName").value.trim();
    const inviteCode=$("joinCode").value.trim().toUpperCase();

    const {error:su}=await db.auth.signUp({email,password});
    if(su && !su.message.toLowerCase().includes("already registered")) throw su;

    const {data,error:li}=await db.auth.signInWithPassword({email,password});
    if(li) throw li;
    session=data.session;

    const {error:rpc}=await db.rpc("join_household_with_code",{
      invite_code_input: inviteCode,
      display_name: displayName
    });
    if(rpc) throw rpc;

    await loadProfileAndData();
    showView("home");
    flash("Joined family.");
  }catch(err){
    flash(err.message || "Could not join family.","error");
  }
}

async function forgotPassword(e){e.preventDefault();try{const email=$("forgotEmail").value.trim();const redirectTo=`${window.location.origin}${window.location.pathname}`;const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo});if(error)throw error;flash("Password reset email sent. Open the email link, then set a new password here.")}catch(err){flash(err.message||"Could not send reset email.","error")}}
async function resetPassword(e){e.preventDefault();try{const p1=$("resetPassword").value,p2=$("resetPasswordConfirm").value;if(p1.length<6)return flash("Password must be at least 6 characters.","error");if(p1!==p2)return flash("Passwords do not match.","error");const {error}=await db.auth.updateUser({password:p1});if(error)throw error;flash("Password updated.");await loadProfileAndData();showView("home")}catch(err){flash(err.message||"Could not update password.","error")}}
async function logout(){await db.auth.signOut();session=profile=household=null;adminUnlockedUntil=0;sessionStorage.removeItem("adminUnlockedUntil");showView("auth")}
async function loadProfileAndData(){const {data:sess}=await db.auth.getSession();session=sess.session;if(!session)throw new Error("No active login session.");const {data,error}=await db.from("profiles").select("*").eq("id",session.user.id).single();if(error)throw error;profile=data;await loadAllData()}
async function loadAllData(){const [h,k,c,comp,prof,act]=await Promise.all([db.from("households").select("*").eq("id",profile.household_id).single(),db.from("kids").select("*").eq("household_id",profile.household_id).order("created_at"),db.from("chores").select("*").eq("household_id",profile.household_id).order("created_at"),db.from("completions").select("*").eq("household_id",profile.household_id).gte("date",isoFromDate(addDays(parseISODate(todayISO()),-180))),db.from("profiles").select("*").eq("household_id",profile.household_id),db.from("activity_log").select("*").eq("household_id",profile.household_id).order("created_at",{ascending:false}).limit(500)]);if(h.error)throw h.error;household=h.data;kids=k.data||[];chores=c.data||[];completions=comp.data||[];profiles=prof.data||[];window.activityLog=act.data||[];await autoMarkMissed();applyBackground();renderHome();renderAdmin();renderTimelineButtons()}
async function autoMarkMissed(){const today=todayISO(),inserts=[],updates=new Map();for(const chore of chores){if(chore.chore_type!=="mandatory")continue;const kid=kids.find(k=>k.id===chore.kid_id);if(!kid)continue;for(let d=parseISODate(kid.start_date||today);d<parseISODate(today);d=addDays(d,1)){const iso=isoFromDate(d);if(!choreDueOn(chore,iso)||completionFor(chore.id,iso))continue;inserts.push({household_id:household.id,kid_id:kid.id,chore_id:chore.id,date:iso,status:"missed",updated_by:profile.id});updates.set(kid.id,(updates.get(kid.id)||0)-(chore.points||0))}}if(!inserts.length)return;await db.from("completions").upsert(inserts,{onConflict:"household_id,kid_id,chore_id,date"});
for(const ins of inserts){
  const k=kids.find(x=>x.id===ins.kid_id);
  const c=chores.find(x=>x.id===ins.chore_id);
  await db.from("activity_log").insert({household_id:household.id,kid_id:ins.kid_id,chore_id:ins.chore_id,message:`${k?.name||"Child"} did not complete ${c?.name||"chore"} on ${ins.date}.`,event_type:"status_change",status:"missed",created_by:profile.id});
}
for(const [kidId,delta] of updates){const kid=kids.find(k=>k.id===kidId);kid.total_points=(kid.total_points||0)+delta;await db.from("kids").update({total_points:kid.total_points}).eq("id",kidId)}completions.push(...inserts)}


function actorName(userId){
  const p=profiles.find(x=>x.id===userId);
  return p?.display_name || "Unknown";
}
function localTimeParts(isoString){
  try{
    const tz=household?.timezone||"America/Phoenix";
    const d=new Date(isoString);
    const hour=new Intl.DateTimeFormat("en-US",{timeZone:tz,hour:"2-digit",hour12:false}).format(d);
    const pretty=new Intl.DateTimeFormat("en-US",{timeZone:tz,month:"short",day:"2-digit",year:"numeric",hour:"numeric",minute:"2-digit"}).format(d);
    return {hour:parseInt(hour,10),pretty};
  }catch(e){
    return {hour:0,pretty:isoString||""};
  }
}
function timelineClassAndIcon(item){
  const msg=(item.message||"").toLowerCase();
  const status=item.status || "";
  const parts=localTimeParts(item.created_at);
  if(status==="done" && parts.hour>=22) return {cls:"late",icon:"✅",label:"Marked done after 10PM"};
  if(status==="done" || msg.includes(" as done")) return {cls:"good",icon:"✅",label:"Chore done"};
  if(status==="missed" || msg.includes(" as missed") || msg.includes("not done")) return {cls:"bad",icon:"❌",label:"Chore not done"};
  if(status==="excused") return {cls:"neutral",icon:"🙂",label:"Excused"};
  if(item.event_type==="point_adjustment" && Number(item.point_delta||0)>0) return {cls:"money-up",icon:"⬆️",label:"Points adjusted up"};
  if(item.event_type==="point_adjustment" && Number(item.point_delta||0)<0) return {cls:"money-down",icon:"⬇️",label:"Points adjusted down"};
  if(msg.includes("total points") || msg.includes("adjust")) return {cls:"neutral",icon:"💵",label:"Admin adjustment"};
  return {cls:"neutral",icon:"📝",label:"Change"};
}
function renderTimelineButtons(){
  const wrap=$("timelineKidButtons");
  if(!wrap) return;
  wrap.innerHTML=kids.map(k=>`<button class="btn alt" data-timeline-kid="${k.id}">${k.avatar||"⭐"} ${k.name}</button>`).join("") || `<span class="small">Add kids first.</span>`;
  document.querySelectorAll("[data-timeline-kid]").forEach(b=>b.onclick=()=>{selectedTimelineKidId=b.dataset.timelineKid;renderTimeline(selectedTimelineKidId)});
  if(selectedTimelineKidId) renderTimeline(selectedTimelineKidId);
}
function renderTimeline(kidId){
  const list=$("timelineList");
  if(!list) return;
  const kid=kids.find(k=>k.id===kidId);
  if(!kid){list.innerHTML="";return;}
  const items=(window.activityLog||[]).filter(x=>x.kid_id===kidId).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  if(!items.length){
    list.innerHTML=`<div class="small">No timeline events yet for ${kid.name}.</div>`;
    return;
  }
  list.innerHTML=items.map(item=>{
    const kind=timelineClassAndIcon(item);
    const t=localTimeParts(item.created_at);
    const chore=chores.find(c=>c.id===item.chore_id);
    const admin=actorName(item.created_by || item.admin_id);
    const delta=item.point_delta ? ` · ${Number(item.point_delta)>0?"+":""}${item.point_delta} pts` : "";
    return `<div class="timeline-event ${kind.cls}">
      <div class="timeline-icon">${kind.icon}</div>
      <div>
        <strong>${kind.label}${delta}</strong>
        <div>${item.message || ""}</div>
        <div class="timeline-meta">${t.pretty} · Changed by: ${admin}${chore?` · Chore: ${chore.name}`:""}</div>
      </div>
    </div>`;
  }).join("");
}

function renderHome(){$("householdTitle").textContent=household?.name||"Family Chore Chart";$("kidCards").innerHTML=kids.map(k=>{const theme=getTheme(k.theme),pal=getPalette(k.palette),count=chores.filter(c=>c.kid_id===k.id).length;return `<div class="card kid-card" data-kid="${k.id}" style="background:${theme.bg};border-color:${pal.s}"><div class="gear" data-settings="${k.id}">⚙️</div><div class="avatar">${k.avatar||theme.emoji}</div><div class="name">${k.name}</div><div class="small">${count} chore(s)</div><div style="font-weight:900;margin-top:8px">${k.total_points||0} pts · ${money(k.total_points)}</div></div>`}).join("")||`<div class="card"><h2>No kids yet</h2><p>Open Admin to add kids and chores.</p></div>`;document.querySelectorAll("[data-kid]").forEach(card=>card.addEventListener("click",e=>{if(e.target.dataset.settings)return;selectedKidId=card.dataset.kid;renderKid(selectedKidId);showView("kid")}));document.querySelectorAll("[data-settings]").forEach(g=>g.addEventListener("click",e=>{e.stopPropagation();selectedKidId=g.dataset.settings;showAdminWithLock();setTimeout(()=>document.querySelector(`[data-admin-kid="${selectedKidId}"]`)?.scrollIntoView({behavior:"smooth"}),50)}));renderKidChecks()}
function renderKidChecks(){$("kidChecks").innerHTML=kids.map(k=>`<span class="chip"><label><input type="checkbox" value="${k.id}" checked> ${k.name}</label></span>`).join("");$("newKidStart").value=todayISO()}
function renderKid(kidId,offset=0){const kid=kids.find(k=>k.id===kidId);if(!kid)return;const theme=getTheme(kid.theme),pal=getPalette(kid.palette),dates=weekDates(weekStartISO(offset)),childChores=chores.filter(c=>c.kid_id===kid.id),daily=childChores.filter(c=>c.frequency==="daily"),weekly=childChores.filter(c=>c.frequency==="weekly");const row=chore=>`<tr><td><strong>${chore.name}</strong><br><span class="small">${chore.points} pts · ${chore.chore_type==="mandatory"?"required":"extra"}</span></td>${dates.map(d=>{const st=effectiveStatus(chore,d);if(st==="na")return`<td><button class="cell-btn cell-na" disabled>—</button></td>`;const label=st==="done"?"Undo":st==="missed"?"❌":st==="excused"?"🙂":"Mark";const next=st==="done"?"open":"done";return`<td><button class="cell-btn cell-${st}" data-mark-kid="${kid.id}" data-chore="${chore.id}" data-date="${d}" data-next-status="${next}" ${d!==todayISO()?"disabled":""}>${label}</button></td>`}).join("")}</tr>`;$("kidView").innerHTML=`<div class="calendar" style="background:${theme.bg}"><div class="calendar-head" style="background:${pal.p}"><div class="hero"><div><h2>${kid.avatar||theme.emoji} ${kid.name}'s Chores</h2><div>${kid.total_points||0} pts · ${money(kid.total_points)}</div></div><button class="btn alt" id="backHomeFromKid">Back Home</button></div></div><div class="summary"><div class="tile"><strong>${daily.length}</strong><br><span class="small">Daily chores</span></div><div class="tile"><strong>${weekly.length}</strong><br><span class="small">Weekly chores</span></div><div class="tile"><strong>${money(kid.total_points)}</strong><br><span class="small">Total earned</span></div></div><div class="card"><h3>Daily Chores</h3><div class="table-wrap"><table><thead><tr><th>Chore</th>${dates.map(d=>`<th>${dayName(d)}<br>${d.slice(5)}</th>`).join("")}</tr></thead><tbody>${daily.map(row).join("")||`<tr><td colspan="8">No daily chores.</td></tr>`}</tbody></table></div></div><div class="card"><h3>Weekly / Extra Chores</h3><div class="table-wrap"><table><thead><tr><th>Chore</th>${dates.map(d=>`<th>${dayName(d)}<br>${d.slice(5)}</th>`).join("")}</tr></thead><tbody>${weekly.map(row).join("")||`<tr><td colspan="8">No weekly chores.</td></tr>`}</tbody></table></div></div></div>`;$("backHomeFromKid").onclick=()=>{renderHome();showView("home")};document.querySelectorAll("[data-mark-kid]").forEach(b=>b.onclick=()=>setCompletion(b.dataset.markKid,b.dataset.chore,b.dataset.date,b.dataset.nextStatus,b.dataset.nextStatus==="done"))}
function renderAdmin(){if(!household)return;$("familyNameInput").value=household.name||"";$("familyInviteCode").textContent=household.invite_code || "Not set";$("timezoneInput").value=household.timezone||"America/Phoenix";$("mainBackgroundInput").innerHTML=BACKGROUNDS.map(b=>`<option value="${b.id}" ${household.main_background===b.id?"selected":""}>${b.name}</option>`).join("");$("adminKids").innerHTML=kids.map(k=>{const child=chores.filter(c=>c.kid_id===k.id);return`<div class="admin-kid" data-admin-kid="${k.id}"><h3>${k.avatar||"⭐"} ${k.name}</h3><div class="grid two kid-settings"><label>Name<input data-kid-field="${k.id}" data-field="name" value="${esc(k.name)}"></label><label>Avatar<select data-kid-field="${k.id}" data-field="avatar">${AVATARS.map(a=>`<option value="${a}" ${k.avatar===a?"selected":""}>${a}</option>`).join("")}</select></label><label>Theme<select data-kid-field="${k.id}" data-field="theme">${THEMES.map(t=>`<option value="${t.id}" ${k.theme===t.id?"selected":""}>${t.emoji} ${t.name}</option>`).join("")}</select></label><label>Palette<select data-kid-field="${k.id}" data-field="palette">${PALETTES.map(p=>`<option value="${p.id}" ${k.palette===p.id?"selected":""}>${p.name}</option>`).join("")}</select></label><label>Total Points / Spending Adjustment<input data-kid-field="${k.id}" data-field="total_points" type="number" value="${k.total_points||0}"></label><label>Start Date<input data-kid-field="${k.id}" data-field="start_date" type="date" value="${k.start_date||todayISO()}"></label></div><h4>Chores</h4>${child.map(c=>`<div class="admin-chore-row"><input data-chore-field="${c.id}" data-field="name" value="${esc(c.name)}"><input data-chore-field="${c.id}" data-field="points" type="number" value="${c.points||0}"><select data-chore-field="${c.id}" data-field="frequency"><option value="daily" ${c.frequency==="daily"?"selected":""}>Daily</option><option value="weekly" ${c.frequency==="weekly"?"selected":""}>Weekly</option></select><select data-chore-field="${c.id}" data-field="chore_type"><option value="mandatory" ${c.chore_type==="mandatory"?"selected":""}>Required</option><option value="extra" ${c.chore_type==="extra"?"selected":""}>Extra</option></select><input data-chore-field="${c.id}" data-field="required_days" value="${esc(c.required_days||"")}" placeholder="Sun,Mon,Tue"><button class="btn red" data-delete-chore="${c.id}">Delete</button></div>`).join("")||`<div class="small">No chores yet.</div>`}<h4>This Week Admin Status</h4>${renderAdminWeek(k,child)}</div>`}).join("")||`<p>No kids added yet.</p>`;document.querySelectorAll("[data-delete-chore]").forEach(b=>b.onclick=async()=>{if(confirm("Delete this chore?")){await db.from("chores").delete().eq("id",b.dataset.deleteChore);await loadAllData()}});renderTimelineButtons()}
function renderAdminWeek(kid,childChores){const dates=weekDates(weekStartISO());return`<div class="table-wrap"><table><thead><tr><th>Chore</th>${dates.map(d=>`<th>${dayName(d)}<br>${d.slice(5)}</th>`).join("")}</tr></thead><tbody>${childChores.map(c=>`<tr><td><strong>${c.name}</strong></td>${dates.map(d=>{if(!choreDueOn(c,d))return`<td>—</td>`;const st=effectiveStatus(c,d);return`<td><select data-status-kid="${kid.id}" data-status-chore="${c.id}" data-status-date="${d}"><option value="open" ${st==="open"?"selected":""}>Open</option><option value="done" ${st==="done"?"selected":""}>Done</option><option value="missed" ${st==="missed"?"selected":""}>Not Done</option><option value="excused" ${st==="excused"?"selected":""}>Okay / Excused</option></select></td>`}).join("")}</tr>`).join("")}</tbody></table></div>`}
function esc(v){return String(v??"").replaceAll('"',"&quot;")}
async function addKid(e){e.preventDefault();const row={household_id:household.id,name:$("newKidName").value.trim(),avatar:$("newKidAvatar").value,theme:$("newKidTheme").value,palette:$("newKidPalette").value,start_date:$("newKidStart").value||todayISO(),total_points:0};const {error}=await db.from("kids").insert(row);if(error)return flash(error.message,"error");e.target.reset();await loadAllData();flash("Child added.")}
async function saveFamilySettings(e){e.preventDefault();const updates={name:$("familyNameInput").value.trim(),timezone:$("timezoneInput").value,main_background:$("mainBackgroundInput").value};const {error}=await db.from("households").update(updates).eq("id",household.id);if(error)return flash(error.message,"error");Object.assign(household,updates);applyBackground();flash("Family settings saved.")}
async function addChoreToKids(e){e.preventDefault();const selected=Array.from($("kidChecks").querySelectorAll("input:checked")).map(x=>x.value);if(!selected.length)return flash("Pick at least one child.","error");const days=Array.from($("dayChecks").querySelectorAll("input:checked")).map(x=>x.value).join(",");const rows=selected.map(kid_id=>({household_id:household.id,kid_id,name:$("newChoreName").value.trim(),points:parseInt($("newChorePoints").value||"0",10),frequency:$("newChoreFrequency").value,chore_type:$("newChoreType").value,required_days:$("newChoreFrequency").value==="daily"?days:""}));const {error}=await db.from("chores").insert(rows);if(error)return flash(error.message,"error");e.target.reset();$("newChorePoints").value=10;fillStaticOptions();renderKidChecks();await loadAllData();flash("Chore added.")}
async function saveAdminChanges(){try{const ku=[];document.querySelectorAll("[data-kid-field]").forEach(el=>{let e=ku.find(x=>x.id===el.dataset.kidField);if(!e){e={id:el.dataset.kidField,data:{}};ku.push(e)}e.data[el.dataset.field]=el.dataset.field==="total_points"?parseInt(el.value||"0",10):el.value});for(const u of ku){
      const oldKid=kids.find(k=>k.id===u.id);
      const oldPoints=Number(oldKid?.total_points||0);
      const newPoints=Number(u.data.total_points ?? oldPoints);
      await db.from("kids").update(u.data).eq("id",u.id);
      if(newPoints!==oldPoints){
        const delta=newPoints-oldPoints;
        await db.from("activity_log").insert({
          household_id:household.id,
          kid_id:u.id,
          chore_id:null,
          message:`${profile?.display_name||"Admin"} adjusted ${oldKid?.name||"child"}'s total points from ${oldPoints} to ${newPoints}.`,
          event_type:"point_adjustment",
          point_delta:delta,
          created_by:profile.id
        });
      }
    }const cu=[];document.querySelectorAll("[data-chore-field]").forEach(el=>{let e=cu.find(x=>x.id===el.dataset.choreField);if(!e){e={id:el.dataset.choreField,data:{}};cu.push(e)}e.data[el.dataset.field]=el.dataset.field==="points"?parseInt(el.value||"0",10):el.value});for(const u of cu)await db.from("chores").update(u.data).eq("id",u.id);for(const s of Array.from(document.querySelectorAll("[data-status-chore]")))await setCompletion(s.dataset.statusKid,s.dataset.statusChore,s.dataset.statusDate,s.value,false);await loadAllData();flash("Admin changes saved.")}catch(err){flash(err.message||"Save failed.","error")}}
async function setCompletion(kidId,choreId,date,status,celebrate=false){const chore=chores.find(c=>c.id===choreId),kid=kids.find(k=>k.id===kidId),old=completionFor(choreId,date);let delta=0;if(old?.status==="done")delta-=chore.points||0;if(old?.status==="missed"&&chore.chore_type==="mandatory")delta+=chore.points||0;if(status==="done")delta+=chore.points||0;if(status==="missed"&&chore.chore_type==="mandatory")delta-=chore.points||0;const {error}=await db.from("completions").upsert({household_id:household.id,kid_id:kidId,chore_id:choreId,date,status,updated_by:profile.id},{onConflict:"household_id,kid_id,chore_id,date"});if(error)return flash(error.message,"error");if(delta&&kid){kid.total_points=(kid.total_points||0)+delta;await db.from("kids").update({total_points:kid.total_points}).eq("id",kidId)}await db.from("activity_log").insert({household_id:household.id,kid_id:kidId,chore_id:choreId,message:`${profile?.display_name||"Someone"} marked ${kid?.name||"Child"}\'s ${chore?.name||"chore"} as ${status}.`,event_type:"status_change",status:status,created_by:profile.id});await loadAllData();if(selectedKidId)renderKid(selectedKidId);if(celebrate&&status==="done")celebration(kid)}
function celebration(kid){const theme=getTheme(kid.theme),praises=[`${kid.name}, awesome job!`,`${kid.name}, you crushed it!`,`Great work, ${kid.name}!`,`${kid.name}, you did amazing!`],box=$("celebrate");box.classList.remove("hidden");box.innerHTML=`<div class="msg">${theme.emoji} ${praises[Math.floor(Math.random()*praises.length)]}</div>`;for(let i=0;i<24;i++){const p=document.createElement("div");p.className="particle";p.textContent=[theme.emoji,"⭐","🎉","✨"][i%4];p.style.left=`${45+Math.random()*10}%`;p.style.top=`${30+Math.random()*20}%`;p.style.setProperty("--x",`${(Math.random()-.5)*520}px`);p.style.setProperty("--y",`${(Math.random()-.5)*360}px`);box.appendChild(p)}setTimeout(()=>{box.innerHTML="";box.classList.add("hidden")},2300)}
async function init(){fillStaticOptions();wireEvents();const {data}=await db.auth.getSession();session=data.session;const params=new URLSearchParams(window.location.hash.replace("#","?"));const isRecovery=params.get("type")==="recovery"||window.location.href.includes("type=recovery");if(isRecovery){showView("auth");openAuthTab("resetBox");flash("Enter your new password.");return}if(!session)return showView("auth");await loadProfileAndData();showView("home")}
init();