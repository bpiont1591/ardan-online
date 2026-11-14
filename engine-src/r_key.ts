  function onKey(e: KeyboardEvent): void {
    const tg = e.target as HTMLElement | null;
    if (tg && tg !== canvas && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA")) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].indexOf(e.key) >= 0) e.preventDefault();
    if (e.type === "keyup") { keys[k] = false; return; }
    if (e.repeat && keys[k]) return;
    keys[k] = true;
    if (!P.cls) {
      if (/^[1-3]$/.test(k)) selCls = CLSORDER[Number(k) - 1];
      else if (k === "ArrowLeft" || k === "ArrowUp") selCls = CLSORDER[(CLSORDER.indexOf(selCls) + 2) % 3];
      else if (k === "ArrowRight" || k === "ArrowDown") selCls = CLSORDER[(CLSORDER.indexOf(selCls) + 1) % 3];
      else if (k === "Enter" || k === " ") pickClass(selCls);
      for (const kk of Object.keys(keys)) keys[kk] = false;
      return;
    }
    if (k === "Escape") { if (dlg) dlg = null; else panel = ""; return; }
    if (dlg) {
      if (k === "e" || k === "Enter" || k === " ") talkKey();
      else if (/^[1-9]$/.test(k) && dlg.opts[Number(k) - 1]) dlg.opts[Number(k) - 1].fn();
      return;
    }
    if (k === " " || k === "f") act({ a: "atk" });
    else if (k === "e" || k === "Enter") act({ a: "talk" });
    else if (k === "1" || k === "2" || k === "3") act({ a: "sk", i: Number(k) - 1 });
    else if (k === "i" || k === "b") { panel = panel === "inv" ? "" : "inv"; invSel = -1; }
    else if (k === "q" || k === "j") panel = panel === "quest" ? "" : "quest";
    else if (k === "m") { panel = panel === "map" ? "" : "map"; mapTab = "area"; }
    else if (k === "h") act({ a: "pot" });
    else if (k === "g") act({ a: "mpot" });
    else if (k === "t") { const act = activeQuests(); if (act.length) { P.track = act[(act.indexOf(P.track) + 1) % act.length]; guideT = 0; log("Śledzone zadanie: " + QUESTS[P.track].n, "#9fd3ff"); } }
    else if (k === "+" || k === "=") P.mmz = Math.min(2, (P.mmz || 0) + 1);
    else if (k === "-") P.mmz = Math.max(0, (P.mmz || 0) - 1);
  }
