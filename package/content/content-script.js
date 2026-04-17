const A={watch_later:"#E91E63",learn_later:"#9C27B0",read_later:"#2196F3",buy_later:"#4CAF50",compare_later:"#FF9800",work:"#607D8B",temporary:"#9E9E9E",unknown:"#795548",research:"#0ea5e9",finance:"#22c55e",social:"#8b5cf6",news:"#f97316"},C={"bottom-right":"ghost-dock--bottom-right","bottom-left":"ghost-dock--bottom-left","top-right":"ghost-dock--top-right","top-left":"ghost-dock--top-left"};let l=[],m=null,p=!1,d=null,f=[],c=null;async function S(){try{const e=await chrome.runtime.sendMessage({type:"GET_TRANSLATIONS"});e.success&&e.data&&(c=e.data)}catch{c=null}}function k(e,t="info"){const s=document.getElementById("ghost-toast");s&&s.remove();const o=document.createElement("div");o.id="ghost-toast",o.className=`ghost-toast ${t}`,o.textContent=e,document.body.appendChild(o),requestAnimationFrame(()=>o.classList.add("show")),setTimeout(()=>{o.classList.remove("show"),setTimeout(()=>o.remove(),200)},2e3)}async function G(){if(document.getElementById("ghost-dock"))return;console.log("GhostTabs: Initializing..."),await S();const e=await chrome.runtime.sendMessage({type:"GET_SETTINGS"});if(!e.success){console.error("Failed to get settings");return}if(m=e.data,console.log("GhostTabs: Settings loaded",m),!m.showGhostShelfOverlay){console.log("GhostTabs: Overlay disabled in settings");return}console.log("GhostTabs: Creating dock..."),p=!m.ghostShelfStartCollapsed,chrome.runtime.onMessage.addListener(t=>{console.log("Content script received message:",t.type),(t.type==="GHOST_TABS_UPDATED"||t.type==="REFRESH_GHOST_TABS")&&(console.log("Reloading ghost tabs..."),g().then(s=>{T().then(()=>{const o=document.getElementById("ghost-dock");o&&s&&(o.innerHTML=v(),w(o),console.log("Dock updated with",l.length,"tabs"))})}))}),await g(),await T(),D(),setInterval(async()=>{await S();const t=await g();await T();const s=document.getElementById("ghost-dock");s&&t&&(s.innerHTML=v(),w(s))},5e3)}async function g(){const e=await chrome.runtime.sendMessage({type:"GET_GHOST_TABS"});if(e.success){const t=e.data||[],s=t.map(n=>n.id).sort(),o=f.slice().sort(),i=s.length>f.length||s.some(n=>!f.includes(n)),a=f.some(n=>!s.includes(n));return i||a||s.length!==o.length?(f=t.map(n=>n.id),l=t,!0):(l=t,!1)}return!1}let b={};async function T(){try{const e=await chrome.runtime.sendMessage({type:"GET_AI_METADATA"});e.success&&(b=e.data||{})}catch{b={}}}function D(){const e=document.createElement("div");e.id="ghost-dock",e.className=`ghost-dock ${C[m.ghostShelfPosition]}`,p&&e.classList.add("ghost-dock--expanded"),e.innerHTML=v(),document.body.appendChild(e),w(e)}function v(){const e=l.length;if(l.length===0)return`
      <div class="ghost-dock__dock">
        <div class="ghost-dock__icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="4" width="18" height="16" rx="2" fill="url(#grad2)" fill-opacity="0.9"/>
            <rect x="5" y="6" width="14" height="2" rx="1" fill="rgba(255,255,255,0.5)"/>
            <circle cx="7.5" cy="11.5" r="1.5" fill="rgba(255,255,255,0.6)"/>
            <circle cx="11.5" cy="11.5" r="1.5" fill="rgba(255,255,255,0.6)"/>
            <circle cx="15.5" cy="11.5" r="1.5" fill="rgba(255,255,255,0.6)"/>
            <path d="M7 15c1 0 3-.5 5-.5s4 .5 5 .5" stroke="rgba(255,255,255,0.6)" stroke-width="1.5" stroke-linecap="round" fill="none"/>
            <rect x="3" y="4" width="18" height="16" rx="2" stroke="rgba(255,255,255,0.15)" stroke-width="1" fill="none"/>
            <defs>
              <linearGradient id="grad2" x1="3" y1="4" x2="21" y2="20" gradientUnits="userSpaceOnUse">
                <stop stop-color="#0066b2"/>
                <stop offset="1" stop-color="#0078d4"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      <div class="ghost-dock__shelf">
        <div class="ghost-dock__empty">No ghost tabs</div>
      </div>
    `;const t=n=>{let r=0;n.pinned&&(r+=30),(n.restoreCount||0)>0&&(r+=20),r+=Math.min((n.totalActiveTimeMs||0)/1e3,20);const _=n.parkedAt||n.lastActiveAt||0;if(_){const y=(Date.now()-_)/36e5;r+=Math.max(0,10-y/24)}return r},s=[...l].sort((n,r)=>t(r)-t(n)).slice(0,12),i=s.filter(n=>t(n)>=15).slice(0,3).map(n=>H(n)).join(""),a=s.map(n=>B(n)).join("");return`
    <div class="ghost-dock__dock">
      <div class="ghost-dock__icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="4" width="18" height="16" rx="2" fill="url(#grad)" fill-opacity="0.9"/>
          <rect x="5" y="6" width="14" height="2" rx="1" fill="rgba(255,255,255,0.5)"/>
          <circle cx="7.5" cy="11.5" r="1.5" fill="rgba(255,255,255,0.6)"/>
          <circle cx="11.5" cy="11.5" r="1.5" fill="rgba(255,255,255,0.6)"/>
          <circle cx="15.5" cy="11.5" r="1.5" fill="rgba(255,255,255,0.6)"/>
          <path d="M7 15c1 0 3-.5 5-.5s4 .5 5 .5" stroke="rgba(255,255,255,0.6)" stroke-width="1.5" stroke-linecap="round" fill="none"/>
          <rect x="3" y="4" width="18" height="16" rx="2" stroke="rgba(255,255,255,0.15)" stroke-width="1" fill="none"/>
          <defs>
            <linearGradient id="grad" x1="3" y1="4" x2="21" y2="20" gradientUnits="userSpaceOnUse">
              <stop stop-color="#0066b2"/>
              <stop offset="1" stop-color="#0078d4"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      ${e>0?`<span class="ghost-dock__badge">${e>99?"99+":e}</span>`:""}
    </div>
    <div class="ghost-dock__shelf">
      ${i?`
        <div class="ghost-dock__resume-bar">
          <span class="ghost-dock__resume-label">Resume</span>
          <div class="ghost-dock__resume-tabs">${i}</div>
        </div>
      `:""}
      <div class="ghost-dock__tab-rail">${a}</div>
    </div>
  `}function B(e){const t=h=>{let u=0;h.pinned&&(u+=30),(h.restoreCount||0)>0&&(u+=20),u+=Math.min((h.totalActiveTimeMs||0)/1e3,20);const x=h.parkedAt||h.lastActiveAt||0;if(x){const R=(Date.now()-x)/36e5;u+=Math.max(0,10-R/24)}return u},s=t(e)>=15,o=t(e)>=10,i=e.faviconUrl||`https://www.google.com/s2/favicons?domain=${encodeURIComponent(e.domain)}&sz=32`,a=b[e.id],n=(a==null?void 0:a.aiIntent)||e.intent,r=A[n]||A.unknown,_=I(e.parkedAt),y=`Resume this: ${e.title||e.domain} (${_})`;return`
    <div class="ghost-dock__tab ${s?"ghost-dock__tab--resume":""} ${o&&!s?"ghost-dock__tab--priority":""}" data-id="${e.id}" title="${y}">
      <img class="ghost-dock__tab-favicon" src="${i}" alt="" />
      <span class="ghost-dock__tab-title">${L(e.title||e.domain)}</span>
      ${s?'<span class="ghost-dock__tab-resume-dot"></span>':""}
      <span class="ghost-dock__tab-indicator" style="background-color: ${r}"></span>
    </div>
  `}function H(e){const t=e.faviconUrl||`https://www.google.com/s2/favicons?domain=${encodeURIComponent(e.domain)}&sz=32`,s=I(e.parkedAt);return`
    <div class="ghost-dock__resume-tab" data-id="${e.id}" title="Resume: ${e.title||e.domain} (${s})">
      <img class="ghost-dock__resume-favicon" src="${t}" alt="" />
      <span class="ghost-dock__resume-title">${L(e.title||e.domain)}</span>
    </div>
  `}function I(e){if(!e)return"Unknown";const t=Math.floor((Date.now()-e)/1e3);return t<60?"Just now":t<3600?`${Math.floor(t/60)}m ago`:t<86400?`${Math.floor(t/3600)}h ago`:`${Math.floor(t/86400)}d ago`}function L(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function w(e){const t=e.querySelector(".ghost-dock__dock");t&&(t.addEventListener("click",s=>{s.target.closest(".ghost-dock__dock")&&(d?(clearTimeout(d),d=null,M()):d=setTimeout(()=>{d=null,O()},400))}),t.addEventListener("dblclick",s=>{s.preventDefault(),d&&(clearTimeout(d),d=null),M()}),e.querySelectorAll(".ghost-dock__tab").forEach(s=>{const o=s;o.addEventListener("click",async i=>{i.preventDefault(),i.stopPropagation();const a=o.dataset.id;a&&await $(a)}),o.addEventListener("contextmenu",async i=>{i.preventDefault(),i.stopPropagation();const a=o.dataset.id;a&&await N(a)})}),e.querySelectorAll(".ghost-dock__resume-tab").forEach(s=>{const o=s;o.addEventListener("click",async i=>{i.preventDefault(),i.stopPropagation();const a=o.dataset.id;a&&await $(a)})}))}function O(){p=!p;const e=document.getElementById("ghost-dock");e&&e.classList.toggle("ghost-dock--expanded",p)}async function M(){var t;const e=await chrome.runtime.sendMessage({type:"PARK_CURRENT_TAB"});e.success&&((t=e.data)!=null&&t.skipped?k((c==null?void 0:c.toastAlreadySaved)||"Already in Ghost Shelf","warning"):k((c==null?void 0:c.toastSaved)||"Saved to GhostTabs","success"),await g()&&E())}async function $(e){(await chrome.runtime.sendMessage({type:"RESTORE_TAB",payload:{id:e}})).success?(k((c==null?void 0:c.toastRestored)||"Restored","success"),await g()&&E()):k((c==null?void 0:c.toastFailedRestore)||"Failed to restore","warning")}async function N(e){(await chrome.runtime.sendMessage({type:"DELETE_TAB",payload:{id:e}})).success&&(k((c==null?void 0:c.toastRemoved)||"Removed","info"),await g()&&E())}function E(){const e=document.getElementById("ghost-dock");e&&(e.innerHTML="",e.innerHTML=v(),w(e))}G().catch(console.error);
