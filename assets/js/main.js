/* ============================================================
   PICBO.AI — shared interactions
   ============================================================ */
(function(){
  "use strict";

  /* ---------- Loading screen ---------- */
  window.addEventListener("load", function(){
    var l = document.getElementById("loader");
    if(l){ setTimeout(function(){ l.classList.add("hide"); }, 420); }
  });

  /* ---------- Theme toggle (persist for session) ---------- */
  var THEME_KEY = "picbo_theme";
  function applyTheme(t){
    document.documentElement.setAttribute("data-theme", t);
    try{ sessionStorage.setItem(THEME_KEY, t); }catch(e){}
  }
  try{
    var saved = sessionStorage.getItem(THEME_KEY);
    if(saved) applyTheme(saved);
  }catch(e){}
  document.querySelectorAll(".theme-toggle").forEach(function(btn){
    btn.addEventListener("click", function(){
      var cur = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
      applyTheme(cur === "light" ? "dark" : "light");
    });
  });

  /* ---------- Sticky nav shadow ---------- */
  var nav = document.querySelector(".nav");
  if(nav){
    window.addEventListener("scroll", function(){
      nav.classList.toggle("scrolled", window.scrollY > 12);
    }, { passive:true });
  }

  /* ---------- Mobile menu ---------- */
  var burger = document.querySelector(".nav-burger");
  var mmenu = document.querySelector(".mobile-menu");
  if(burger && mmenu){
    burger.addEventListener("click", function(){ mmenu.classList.add("open"); });
    mmenu.addEventListener("click", function(e){
      if(e.target === mmenu || e.target.closest(".mobile-close") || e.target.closest("a")) mmenu.classList.remove("open");
    });
  }

  /* ---------- Cursor glow ---------- */
  var glow = document.querySelector(".cursor-glow");
  if(glow && window.matchMedia("(pointer:fine)").matches){
    window.addEventListener("mousemove", function(e){
      glow.style.opacity = 1;
      glow.style.transform = "translate(" + e.clientX + "px," + e.clientY + "px) translate(-50%,-50%)";
    });
    document.addEventListener("mouseleave", function(){ glow.style.opacity = 0; });
  }

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll(".reveal, .reveal-stagger");
  if("IntersectionObserver" in window && revealEls.length){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      });
    }, { threshold:0.14 });
    revealEls.forEach(function(el){ io.observe(el); });
  } else {
    revealEls.forEach(function(el){ el.classList.add("in"); });
  }

  /* ---------- Stagger children auto-tag ---------- */
  document.querySelectorAll(".reveal-stagger").forEach(function(group){
    Array.from(group.children).forEach(function(child, i){
      child.classList.add("r-child");
      child.style.transitionDelay = (i * 0.08) + "s";
    });
  });

  /* ---------- Counters ---------- */
  function animateCounter(el){
    var target = parseFloat(el.getAttribute("data-count"));
    var suffix = el.getAttribute("data-suffix") || "";
    var dur = 1600, start = null;
    function step(ts){
      if(!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = target * eased;
      el.textContent = (target % 1 === 0 ? Math.floor(val).toLocaleString() : val.toFixed(1)) + suffix;
      if(p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var counters = document.querySelectorAll("[data-count]");
  if("IntersectionObserver" in window && counters.length){
    var cio = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){ animateCounter(en.target); cio.unobserve(en.target); }
      });
    }, { threshold:0.6 });
    counters.forEach(function(c){ cio.observe(c); });
  }

  /* ---------- Typed prompt demo ---------- */
  var typedEl = document.querySelector("[data-typed]");
  if(typedEl){
    var prompts = [
      "cinematic product shot of a perfume bottle, studio light",
      "minimal logo for a coffee roastery, gold on black",
      "luxury real estate poster, golden hour, 4k",
      "fashion portrait, editorial lighting, film grain"
    ];
    var pi = 0, ci = 0, deleting = false;
    function tick(){
      var full = prompts[pi];
      if(!deleting){
        ci++;
        typedEl.textContent = full.slice(0, ci);
        if(ci === full.length){ deleting = true; setTimeout(tick, 1500); return; }
      } else {
        ci--;
        typedEl.textContent = full.slice(0, ci);
        if(ci === 0){ deleting = false; pi = (pi + 1) % prompts.length; }
      }
      setTimeout(tick, deleting ? 24 : 46);
    }
    tick();
  }

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll(".faq-item").forEach(function(item){
    var q = item.querySelector(".faq-q");
    var a = item.querySelector(".faq-a");
    if(!q || !a) return;
    q.addEventListener("click", function(){
      var isOpen = item.classList.contains("open");
      item.closest(".faq-list").querySelectorAll(".faq-item.open").forEach(function(o){
        o.classList.remove("open");
        o.querySelector(".faq-a").style.maxHeight = null;
      });
      if(!isOpen){
        item.classList.add("open");
        a.style.maxHeight = a.scrollHeight + "px";
      }
    });
  });

  /* ---------- Pricing tabs (category filter etc, generic) ---------- */
  document.querySelectorAll("[data-tabgroup]").forEach(function(group){
    var buttons = group.querySelectorAll("[data-tab]");
    buttons.forEach(function(btn){
      btn.addEventListener("click", function(){
        buttons.forEach(function(b){ b.classList.remove("active"); });
        btn.classList.add("active");
        var target = btn.getAttribute("data-tab");
        var panelGroup = document.querySelector(group.getAttribute("data-tabgroup"));
        if(panelGroup){
          panelGroup.querySelectorAll("[data-panel]").forEach(function(p){
            p.style.display = (p.getAttribute("data-panel") === target || target === "all") ? "" : "none";
          });
        }
      });
    });
  });

  /* ---------- Billing toggle (Monthly / Yearly) ---------- */
  var billBtns = document.querySelectorAll(".currency-switch button");
  var currentBilling = "monthly";
  if(billBtns.length){
    billBtns.forEach(function(btn){
      btn.addEventListener("click", function(){
        billBtns.forEach(function(b){ b.classList.remove("active"); });
        btn.classList.add("active");
        currentBilling = btn.getAttribute("data-billing") || "monthly";
        document.querySelectorAll(".plan-price b").forEach(function(el){
          var val = el.getAttribute("data-" + currentBilling);
          if(val === null) return;
          var num = parseFloat(val);
          el.textContent = num === 0 ? "$0" : "$" + (num % 1 === 0 ? num : num.toFixed(2));
        });
        document.querySelectorAll(".plan-price span").forEach(function(el){
          if(el.hasAttribute("data-static-label")) return;
          el.textContent = currentBilling === "yearly" ? "/mo" : "/month";
        });
        document.querySelectorAll("[data-note-monthly]").forEach(function(el){
          var note = el.getAttribute(currentBilling === "yearly" ? "data-note-yearly" : "data-note-monthly");
          if(note) el.textContent = note;
        });
      });
    });
  }

  /* ---------- Paddle-style checkout modal ---------- */
  var modal = document.getElementById("payModal");
  var openers = document.querySelectorAll("[data-open-pay]");
  var planNameEl = document.getElementById("payPlanName");
  var planPriceEl = document.getElementById("payPlanPrice");
  openers.forEach(function(btn){
    btn.addEventListener("click", function(){
      if(!modal) return;
      var plan = btn.getAttribute("data-plan") || "Pro";
      var price = btn.getAttribute(currentBilling === "yearly" ? "data-price-yearly" : "data-price-monthly") || "";
      if(planNameEl) planNameEl.textContent = plan;
      if(planPriceEl) planPriceEl.textContent = price;
      modal.classList.add("open");
      document.body.style.overflow = "hidden";
    });
  });
  if(modal){
    modal.addEventListener("click", function(e){
      if(e.target === modal || e.target.closest(".modal-close")) closeModal();
    });
  }
  function closeModal(){
    if(!modal) return;
    modal.classList.remove("open");
    document.body.style.overflow = "";
  }

  document.querySelectorAll(".copy-btn").forEach(function(btn){
    btn.addEventListener("click", function(){
      var targetId = btn.getAttribute("data-copy");
      var el = document.getElementById(targetId);
      if(!el) return;
      var text = el.textContent.replace(/\s/g, "");
      if(navigator.clipboard){
        navigator.clipboard.writeText(text).then(function(){ showToast("Copied to clipboard"); });
      }
    });
  });

  var uploadDrop = document.getElementById("uploadDrop");
  var uploadInput = document.getElementById("uploadInput");
  var uploadLabel = document.getElementById("uploadLabel");
  if(uploadDrop && uploadInput){
    uploadDrop.addEventListener("click", function(){ uploadInput.click(); });
    uploadInput.addEventListener("change", function(){
      if(uploadInput.files && uploadInput.files[0]){
        uploadDrop.classList.add("has-file");
        if(uploadLabel) uploadLabel.textContent = uploadInput.files[0].name;
      }
    });
    ["dragover","dragleave","drop"].forEach(function(evt){
      uploadDrop.addEventListener(evt, function(e){ e.preventDefault(); });
    });
  }

  var payForm = document.getElementById("payForm");
  if(payForm){
    payForm.addEventListener("submit", function(e){
      e.preventDefault();
      closeModal();
      showToast("Subscription active — welcome to Picbo");
      payForm.reset();
    });
  }

  function showToast(msg){
    var t = document.getElementById("toast");
    if(!t) return;
    t.querySelector("p").textContent = msg;
    t.classList.add("show");
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(function(){ t.classList.remove("show"); }, 3200);
  }
  window.picboToast = showToast;

  /* ---------- Card tilt ---------- */
  document.querySelectorAll("[data-tilt]").forEach(function(card){
    if(!window.matchMedia("(pointer:fine)").matches) return;
    card.addEventListener("mousemove", function(e){
      var r = card.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = "perspective(800px) rotateY(" + (x*6) + "deg) rotateX(" + (-y*6) + "deg) translateY(-4px)";
    });
    card.addEventListener("mouseleave", function(){ card.style.transform = ""; });
  });

  /* ---------- Generic tag-select toggles (styles, categories) ---------- */
  document.querySelectorAll("[data-select-tags]").forEach(function(group){
    group.querySelectorAll(".tag").forEach(function(t){
      t.addEventListener("click", function(){ t.classList.toggle("active"); });
    });
  });

  /* ---------- Onboarding (if present) ---------- */
  var obSteps = document.querySelectorAll(".ob-step");
  if(obSteps.length){
    var idx = 0;
    var progressBars = document.querySelectorAll(".ob-progress i em");
    function renderStep(){
      obSteps.forEach(function(s,i){ s.classList.toggle("active", i === idx); });
      progressBars.forEach(function(p,i){ p.style.width = i <= idx ? "100%" : "0%"; });
      var backBtn = document.getElementById("obBack");
      var nextBtn = document.getElementById("obNext");
      if(backBtn) backBtn.style.visibility = idx === 0 ? "hidden" : "visible";
      if(nextBtn) nextBtn.textContent = idx === obSteps.length - 1 ? "Enter dashboard" : "Continue";
    }
    document.querySelectorAll(".pick-grid").forEach(function(grid){
      var single = grid.getAttribute("data-single") === "true";
      grid.querySelectorAll(".pick-item").forEach(function(item){
        item.addEventListener("click", function(){
          if(single){ grid.querySelectorAll(".pick-item").forEach(function(p){ p.classList.remove("sel"); }); }
          item.classList.toggle("sel");
        });
      });
    });
    var nextBtn = document.getElementById("obNext");
    var backBtn = document.getElementById("obBack");
    if(nextBtn) nextBtn.addEventListener("click", function(){
      if(idx < obSteps.length - 1){ idx++; renderStep(); }
      else { window.location.href = "dashboard.html"; }
    });
    if(backBtn) backBtn.addEventListener("click", function(){ if(idx > 0){ idx--; renderStep(); } });
    renderStep();
  }

  /* ---------- Password strength (register page) ---------- */
  var pwInput = document.getElementById("pwInput");
  if(pwInput){
    var bars = document.querySelectorAll(".pw-strength i");
    pwInput.addEventListener("input", function(){
      var v = pwInput.value;
      var score = 0;
      if(v.length >= 6) score++;
      if(v.length >= 10) score++;
      if(/[A-Z]/.test(v) && /[0-9]/.test(v)) score++;
      if(/[^A-Za-z0-9]/.test(v)) score++;
      bars.forEach(function(b,i){
        b.style.background = i < score ? (score < 2 ? "var(--danger)" : score < 3 ? "var(--warn)" : "var(--success)") : "var(--hair)";
      });
    });
  }

  /* ---------- Register form -> mock verification screen ---------- */
  var regForm = document.getElementById("registerForm");
  if(regForm){
    regForm.addEventListener("submit", function(e){
      e.preventDefault();
      document.getElementById("regStepForm").style.display = "none";
      document.getElementById("regStepVerify").style.display = "block";
    });
  }

  /* ---------- Generation tabs on dashboard ---------- */
  var genDesc = document.getElementById("genDesc");
  document.querySelectorAll(".gen-tab").forEach(function(tab){
    tab.addEventListener("click", function(){
      tab.parentElement.querySelectorAll(".gen-tab").forEach(function(t){ t.classList.remove("active"); });
      tab.classList.add("active");
      if(genDesc){ genDesc.textContent = tab.getAttribute("data-desc") || ""; }
    });
  });

  /* ---------- Generate button demo (dashboard) ---------- */
  var genBtn = document.getElementById("genBtn");
  if(genBtn){
    genBtn.addEventListener("click", function(){
      var ta = document.getElementById("genPrompt");
      if(ta && !ta.value.trim()){ ta.focus(); return; }
      genBtn.disabled = true;
      genBtn.textContent = "Generating…";
      setTimeout(function(){
        genBtn.disabled = false;
        genBtn.textContent = "Generate";
        showToast("Generation complete — added to your library");
      }, 1800);
    });
  }

  /* ---------- Lumi AI assistant widget ---------- */
  var lumiBubble = document.getElementById("lumiBubble");
  var lumiPanel = document.getElementById("lumiPanel");
  var lumiClose = document.getElementById("lumiClose");
  var lumiForm = document.getElementById("lumiForm");
  var lumiInput = document.getElementById("lumiInput");
  var lumiThread = document.getElementById("lumiThread");

  var LUMI_RULES = [
    { test: /credit|token/i, reply: "Credits are spent per generation — 40 for a simple photo, up to 500 for a 15-second animated ad. You can check your exact balance in the sidebar, or top up anytime from Billing." },
    { test: /price|cost|plan|subscri/i, reply: "Starter is $14/mo, Pro is $29/mo (most popular, unlocks animated ads), Business is $59/mo with API access. There's also a 7-day free Pro trial — no card needed." },
    { test: /video|animat/i, reply: "Just to set expectations: the 15-second animated ad isn't generative AI video — it's Gemini-made photos assembled with pan, zoom and transitions. It renders fast and looks great for social ads." },
    { test: /photoshoot/i, reply: "Upload one clear photo of your product, and I'll help you generate a full set of angles and backgrounds that stay consistent with the original — try it from AI Generator → Product Photoshoot." },
    { test: /cancel|refund/i, reply: "You can cancel or change plans anytime from Billing — changes are prorated automatically. For refunds, reach out at Techtig9@gmail.com within 7 days of a charge." },
    { test: /hi|hello|hey/i, reply: "Hey! I'm Lumi. Ask me about credits, pricing, or which mode fits what you're making — Photo, Ad Creative, Photoshoot, or Animated Ad." }
  ];

  function lumiOpen(){
    if(!lumiPanel) return;
    lumiPanel.classList.add("open");
    if(lumiInput) lumiInput.focus();
  }
  function lumiCloseFn(){
    if(lumiPanel) lumiPanel.classList.remove("open");
  }
  if(lumiBubble) lumiBubble.addEventListener("click", lumiOpen);
  if(lumiClose) lumiClose.addEventListener("click", lumiCloseFn);

  function lumiAddMsg(text, who){
    if(!lumiThread) return;
    var row = document.createElement("div");
    row.className = "lumi-msg " + (who === "user" ? "lumi-user" : "lumi-bot");
    row.textContent = text;
    lumiThread.appendChild(row);
    lumiThread.scrollTop = lumiThread.scrollHeight;
  }

  if(lumiForm){
    lumiForm.addEventListener("submit", function(e){
      e.preventDefault();
      var val = lumiInput.value.trim();
      if(!val) return;
      lumiAddMsg(val, "user");
      lumiInput.value = "";
      setTimeout(function(){
        var match = LUMI_RULES.find(function(r){ return r.test.test(val); });
        lumiAddMsg(match ? match.reply : "Good question — in the full product I'd pull that from our help docs and your account directly. For now, try the Help Center, or reach Techtig9@gmail.com.", "bot");
      }, 550);
    });
  }

  document.querySelectorAll(".lumi-suggestion").forEach(function(btn){
    btn.addEventListener("click", function(){
      if(lumiInput){ lumiInput.value = btn.textContent; lumiForm.dispatchEvent(new Event("submit")); }
    });
  });

  /* ---------- Credit top-up mock purchase (billing page) ---------- */
  document.querySelectorAll("[data-buy-topup]").forEach(function(btn){
    btn.addEventListener("click", function(){
      showToast("Top-up added — " + btn.getAttribute("data-buy-topup") + " credits credited");
    });
  });

  /* ---------- Referral copy link (referrals page) ---------- */
  var refCopyBtn = document.getElementById("refCopyBtn");
  if(refCopyBtn){
    refCopyBtn.addEventListener("click", function(){
      var codeEl = document.getElementById("refCode");
      if(codeEl && navigator.clipboard){
        navigator.clipboard.writeText(codeEl.textContent.trim()).then(function(){ showToast("Referral link copied"); });
      }
    });
  }

  /* ---------- Team invite mock (team page) ---------- */
  var inviteForm = document.getElementById("inviteForm");
  if(inviteForm){
    inviteForm.addEventListener("submit", function(e){
      e.preventDefault();
      showToast("Invite sent");
      inviteForm.reset();
    });
  }

  /* ---------- Kinetic word-reveal (hero headline + page titles) ---------- */
  function splitKinetic(el){
    if(!el || el.dataset.kineticDone) return;
    el.dataset.kineticDone = "1";
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var textNodes = [];
    var n;
    while((n = walker.nextNode())) textNodes.push(n);
    textNodes.forEach(function(node){
      var words = node.textContent.split(/(\s+)/);
      var frag = document.createDocumentFragment();
      words.forEach(function(w){
        if(/^\s+$/.test(w) || w === ""){
          frag.appendChild(document.createTextNode(w));
        } else {
          var span = document.createElement("span");
          span.className = "kinetic-word";
          span.textContent = w;
          frag.appendChild(span);
        }
      });
      node.parentNode.replaceChild(frag, node);
    });
    var spans = el.querySelectorAll(".kinetic-word");
    spans.forEach(function(s, i){
      s.style.transitionDelay = (i * 0.045) + "s";
    });
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        spans.forEach(function(s){ s.classList.add("in"); });
      });
    });
  }
  var kineticHero = document.querySelector(".hero h1");
  if(kineticHero) splitKinetic(kineticHero);

  /* ---------- Page transitions on internal navigation ---------- */
  document.querySelectorAll('a[href*=".html"]').forEach(function(link){
    var href = link.getAttribute("href");
    if(!href || link.target === "_blank" || link.hasAttribute("download")) return;
    if(href.indexOf("http") === 0 || href.indexOf("//") === 0) return;
    link.addEventListener("click", function(e){
      if(e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      document.body.classList.add("page-exit");
      setTimeout(function(){ window.location.href = href; }, 260);
    });
  });

  /* ---------- Password visibility toggle ---------- */
  document.querySelectorAll("[data-pw-toggle]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var input = document.getElementById(btn.getAttribute("data-pw-toggle"));
      if(!input) return;
      var showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.classList.toggle("showing", !showing);
      btn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
    });
  });

  /* ---------- Library page: tabs + hash routing ---------- */
  var libTabs = document.getElementById("libTabs");
  if(libTabs){
    var navMap = { creations:"navCreations", history:"navHistory", saved:"navSaved", collections:"navCollections" };
    function setLibTab(name){
      document.querySelectorAll("[data-lib-tab]").forEach(function(t){
        t.classList.toggle("active", t.getAttribute("data-lib-tab") === name);
      });
      document.querySelectorAll("[data-lib-panel]").forEach(function(p){
        p.style.display = p.getAttribute("data-lib-panel") === name ? "" : "none";
      });
      Object.keys(navMap).forEach(function(key){
        var el = document.getElementById(navMap[key]);
        if(el) el.classList.toggle("active", key === name);
      });
    }
    document.querySelectorAll("[data-lib-tab]").forEach(function(tab){
      tab.addEventListener("click", function(){
        var name = tab.getAttribute("data-lib-tab");
        setLibTab(name);
        history.replaceState(null, "", name === "creations" ? "library.html" : "#" + name);
      });
    });
    var initial = (window.location.hash || "").replace("#", "") || "creations";
    if(!navMap[initial]) initial = "creations";
    setLibTab(initial);
  }

  /* ---------- Forgot password form ---------- */
  var forgotForm = document.getElementById("forgotForm");
  if(forgotForm){
    forgotForm.addEventListener("submit", function(e){
      e.preventDefault();
      document.getElementById("fpStepForm").style.display = "none";
      document.getElementById("fpStepSent").style.display = "block";
    });
  }

  /* ---------- Notifications: mark all as read ---------- */
  var markAllBtn = document.getElementById("markAllReadBtn");
  if(markAllBtn){
    markAllBtn.addEventListener("click", function(){
      document.querySelectorAll(".notif-row.unread").forEach(function(row){ row.classList.remove("unread"); });
      showToast("All notifications marked as read");
    });
  }

  /* ---------- Cookie consent banner ---------- */
  var COOKIE_KEY = "picbo_cookie_choice";
  try{
    if(!sessionStorage.getItem(COOKIE_KEY)){
      var banner = document.createElement("div");
      banner.className = "cookie-banner";
      banner.innerHTML =
        '<p>We use essential cookies to run Picbo.ai, plus optional analytics cookies to understand product usage. See our <a href="legal.html#cookies">Cookie Policy</a>.</p>' +
        '<div class="cookie-banner-actions">' +
        '<button class="btn btn-primary btn-sm" data-cookie-action="accept">Accept all</button>' +
        '<button class="btn btn-line btn-sm" data-cookie-action="essential">Essential only</button>' +
        '</div>';
      document.body.appendChild(banner);
      requestAnimationFrame(function(){ requestAnimationFrame(function(){ banner.classList.add("show"); }); });
      banner.querySelectorAll("[data-cookie-action]").forEach(function(btn){
        btn.addEventListener("click", function(){
          try{ sessionStorage.setItem(COOKIE_KEY, btn.getAttribute("data-cookie-action")); }catch(e){}
          banner.classList.remove("show");
          setTimeout(function(){ banner.remove(); }, 400);
        });
      });
    }
  }catch(e){}

  /* ---------- Onboarding checklist widget ---------- */
  var checklist = document.getElementById("onboardChecklist");
  if(checklist){
    var CHECKLIST_KEY = "picbo_checklist_dismissed";
    try{
      if(sessionStorage.getItem(CHECKLIST_KEY) === "1") checklist.style.display = "none";
    }catch(e){}

    var items = checklist.querySelectorAll("[data-onboard-item]");
    var bar = document.getElementById("onboardBarFill");
    var label = document.getElementById("onboardProgressLabel");
    var total = items.length + 1; // +1 for the always-done "create account" step

    function updateProgress(){
      var done = 1 + Array.from(items).filter(function(i){ return i.querySelector("input").checked; }).length;
      if(bar) bar.style.width = Math.round((done/total)*100) + "%";
      if(label) label.textContent = done + " of " + total + " done";
      if(done === total){
        setTimeout(function(){
          checklist.style.display = "none";
          try{ sessionStorage.setItem(CHECKLIST_KEY, "1"); }catch(e){}
        }, 900);
      }
    }
    items.forEach(function(item){
      item.querySelector("input").addEventListener("change", function(){
        item.classList.toggle("done", this.checked);
        updateProgress();
      });
    });

    var closeBtn = document.getElementById("onboardClose");
    if(closeBtn){
      closeBtn.addEventListener("click", function(){
        checklist.style.display = "none";
        try{ sessionStorage.setItem(CHECKLIST_KEY, "1"); }catch(e){}
      });
    }
  }

  /* ---------- Developer page: code snippet tabs ---------- */
  var codeTabs = document.getElementById("codeTabs");
  if(codeTabs){
    document.querySelectorAll("[data-code-tab]").forEach(function(tab){
      tab.addEventListener("click", function(){
        var name = tab.getAttribute("data-code-tab");
        document.querySelectorAll("[data-code-tab]").forEach(function(t){ t.classList.toggle("active", t === tab); });
        document.querySelectorAll("[data-code-panel]").forEach(function(p){
          p.style.display = p.getAttribute("data-code-panel") === name ? "" : "none";
        });
      });
    });
  }

})();
