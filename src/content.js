/* eslint-disable no-undef */
// Content script runs on Salesforce origins to perform same-origin fetches using the user's cookies.
// This avoids CORS and cookie access limitations from the background context.
async function doFetch(request) {
	const { path, method = "GET", body, headers } = request;
	let url = path;
	if (!/^https?:\/\//i.test(path)) {
		if (path.startsWith("/")) {
			url = `${location.origin}${path}`;
		} else {
			url = `${location.origin}/${path}`;
		}
	}
	const init = {
		method,
		headers: headers || {},
		credentials: "include"
	};
	if (body) {
		init.body = typeof body === "string" ? body : JSON.stringify(body);
		if (!init.headers["Content-Type"] && !init.headers["content-type"]) {
			init.headers["Content-Type"] = "application/json";
		}
	}
	const res = await fetch(url, init);
	const text = await res.text();
	return {
		ok: res.ok,
		status: res.status,
		body: text,
		contentType: res.headers.get("content-type") || ""
	};
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
	(async () => {
		if (!msg || typeof msg !== "object") return;
		if (msg.type === "ping") {
			sendResponse({ ok: true, location: window.location.href });
			return;
		}
		if (msg.type === "proxy") {
			try {
				const result = await doFetch(msg.request || {});
				sendResponse({ ok: true, result });
			} catch (e) {
				sendResponse({ ok: false, error: e?.message || String(e) });
			}
			return;
		}
	})();
	return true;
});

// -------------------------------------------------------------------
// Flow canvas toolbar injection
// -------------------------------------------------------------------
const FLOW_TOOLBAR_ID = "flownotes-toolbar";
let lastUrlObserved = location.href;
let toolbarElRef = null;

function isFlowBuilderLocation() {
	// Strict match on the top window URL for Flow Builder canvas
	try {
		if (window !== window.top) return false;
		const href = window.location.href || "";
		return href.includes("/builder_platform_interaction/flowBuilder.app");
	} catch {
		return false;
	}
}

function ensureToolbarMounted() {
	try {
		const targetDoc = getTargetDocument();
		if (!targetDoc) return;
		if (targetDoc.getElementById(FLOW_TOOLBAR_ID)) return;
		injectToolbar(targetDoc);
		// Debug marker
		console.log("[FlowNotes] Toolbar injected");
	} catch (e) {
		console.warn("[FlowNotes] inject error", e);
	}
}

function getTargetDocument() {
	// Prefer top document if same-origin, fallback to current
	try {
		if (window.top && window.top.document && window.top.location.host === window.location.host) {
			return window.top.document;
		}
	} catch {}
	return document;
}

function injectToolbar(targetDoc) {
	const container = targetDoc.createElement("div");
	container.id = FLOW_TOOLBAR_ID;
	// Use Shadow DOM to isolate styles; if it fails, fallback to light DOM
	let root;
	try {
		const shadow = container.attachShadow({ mode: "open" });
		root = targetDoc.createElement("div");
		shadow.appendChild(root);
	} catch {
		root = targetDoc.createElement("div");
		container.appendChild(root);
	}
	// Apply inline styles to avoid CSP issues with <style> tags
	Object.assign(root.style, {
		position: "fixed",
		top: "100px",
		left: "24px",
		zIndex: "2147483647",
		display: "inline-flex",
		alignItems: "center",
		gap: "8px",
		background: "rgba(28,37,65,0.95)",
		color: "#e6ecf1",
		border: "1px solid rgba(255,255,255,0.12)",
		boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
		borderRadius: "10px",
		padding: "8px 10px",
		userSelect: "none",
		cursor: "move",
		backdropFilter: "blur(4px)"
	});
	const title = targetDoc.createElement("div");
	title.style.font = "600 12px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
	title.style.opacity = "0.9";
	title.textContent = "FlowNotes";
	const noteBtn = targetDoc.createElement("button");
	noteBtn.style.all = "unset";
	noteBtn.style.font = "600 12px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
	noteBtn.style.padding = "6px 10px";
	noteBtn.style.background = "#5bc0be";
	noteBtn.style.color = "#08121f";
	noteBtn.style.borderRadius = "8px";
	noteBtn.style.cursor = "pointer";
	noteBtn.textContent = "Note+";
	// Prevent drag start when clicking the button
	noteBtn.addEventListener("mousedown", (e) => e.stopPropagation());
	noteBtn.addEventListener("click", openNotePopover);
	root.appendChild(title);
	root.appendChild(noteBtn);
	(targetDoc.body || targetDoc.documentElement).appendChild(container);

	makeDraggable(root);
	restoreToolbarPosition(root);
	toolbarElRef = root;
}

function makeDraggable(moveEl) {
	let isDragging = false;
	let startX = 0;
	let startY = 0;
	let startTop = 0;
	let startLeft = 0;

	function onMouseDown(e) {
		isDragging = true;
		startX = e.clientX;
		startY = e.clientY;
		const rect = moveEl.getBoundingClientRect();
		startTop = rect.top;
		startLeft = rect.left;
		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("mouseup", onMouseUp);
		e.preventDefault();
	}
	function onMouseMove(e) {
		if (!isDragging) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		const nextTop = Math.max(0, startTop + dy);
		const nextLeft = Math.max(0, startLeft + dx);
		moveEl.style.position = "fixed";
		moveEl.style.top = `${nextTop}px`;
		moveEl.style.left = `${nextLeft}px`;
		moveEl.style.right = "auto";
	}
	function onMouseUp() {
		if (!isDragging) return;
		isDragging = false;
		window.removeEventListener("mousemove", onMouseMove);
		window.removeEventListener("mouseup", onMouseUp);
		persistToolbarPosition(moveEl);
	}
	moveEl.addEventListener("mousedown", onMouseDown);
}

function storageKeyForPosition() {
	return `flownotes:toolbar:pos:${location.host}`;
}
function persistToolbarPosition(moveEl) {
	const rect = moveEl.getBoundingClientRect();
	const pos = { top: rect.top, left: rect.left };
	try {
		localStorage.setItem(storageKeyForPosition(), JSON.stringify(pos));
	} catch {}
}
function restoreToolbarPosition(moveEl) {
	try {
		const raw = localStorage.getItem(storageKeyForPosition());
		if (!raw) return;
		const pos = JSON.parse(raw);
		if (typeof pos?.top === "number" && typeof pos?.left === "number") {
			// Clamp into viewport
			const maxTop = Math.max(0, (window.innerHeight || 800) - 40);
			const maxLeft = Math.max(0, (window.innerWidth || 1200) - 160);
			const clampedTop = Math.min(Math.max(0, pos.top), maxTop);
			const clampedLeft = Math.min(Math.max(0, pos.left), maxLeft);
			moveEl.style.position = "fixed";
			moveEl.style.top = `${clampedTop}px`;
			moveEl.style.left = `${clampedLeft}px`;
			moveEl.style.right = "auto";
		}
	} catch {}
}

function watchRouteChanges() {
	const check = () => {
		if (lastUrlObserved !== location.href) {
			lastUrlObserved = location.href;
			ensureToolbarMounted();
		}
	};
	setInterval(check, 1000);
	window.addEventListener("hashchange", check, true);
	window.addEventListener("popstate", check, true);
	// Observe DOM mutations as Lightning often swaps frames/content
	const mo = new MutationObserver(() => ensureToolbarMounted());
	mo.observe(document.documentElement, { childList: true, subtree: true });
}

// -------------------------------------------------------------------
// Note popout
// -------------------------------------------------------------------
const NOTE_POPOUT_ID = "flownotes-note-popout";

function openNotePopover() {
	const doc = getTargetDocument();
	let pop = doc.getElementById(NOTE_POPOUT_ID);
	if (pop) {
		const ta = pop.querySelector("textarea");
		if (ta) ta.focus();
		return;
	}
	pop = doc.createElement("div");
	pop.id = NOTE_POPOUT_ID;
	Object.assign(pop.style, {
		position: "fixed",
		zIndex: "2147483647",
		background: "rgba(28,37,65,0.98)",
		color: "#e6ecf1",
		border: "1px solid rgba(255,255,255,0.12)",
		boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
		borderRadius: "10px",
		width: "300px",
		padding: "8px",
		backdropFilter: "blur(4px)"
	});
	// Position near toolbar if available
	let defaultTop = 160;
	let defaultLeft = 24;
	try {
		if (toolbarElRef) {
			const r = toolbarElRef.getBoundingClientRect();
			defaultTop = Math.min((window.innerHeight || 800) - 200, r.bottom + 10);
			defaultLeft = Math.max(10, Math.min((window.innerWidth || 1200) - 320, r.left));
		}
	} catch {}
	pop.style.top = `${defaultTop}px`;
	pop.style.left = `${defaultLeft}px`;

	// Header (draggable)
	const header = doc.createElement("div");
	Object.assign(header.style, {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		gap: "8px",
		marginBottom: "6px",
		cursor: "move"
	});
	const title = doc.createElement("div");
	title.textContent = "Note";
	title.style.font = "600 12px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
	title.style.opacity = "0.9";
	const closeBtn = doc.createElement("button");
	closeBtn.textContent = "×";
	closeBtn.title = "Close";
	Object.assign(closeBtn.style, {
		all: "unset",
		width: "22px",
		height: "22px",
		lineHeight: "22px",
		textAlign: "center",
		borderRadius: "6px",
		cursor: "pointer",
		background: "rgba(255,255,255,0.08)"
	});
	closeBtn.addEventListener("mousedown", (e) => e.stopPropagation());
	closeBtn.addEventListener("click", () => pop.remove());
	header.appendChild(title);
	header.appendChild(closeBtn);

	// Text area
	const ta = doc.createElement("textarea");
	Object.assign(ta.style, {
		width: "100%",
		height: "120px",
		resize: "vertical",
		border: "1px solid rgba(255,255,255,0.12)",
		background: "rgba(12,18,32,0.9)",
		color: "#e6ecf1",
		borderRadius: "6px",
		padding: "8px",
		font: "13px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
		boxSizing: "border-box"
	});
	ta.placeholder = "Type a quick note…";
	ta.addEventListener("mousedown", (e) => e.stopPropagation());

	// Footer with Save & Close
	const footer = doc.createElement("div");
	Object.assign(footer.style, {
		display: "flex",
		alignItems: "center",
		justifyContent: "flex-end",
		gap: "8px",
		marginTop: "8px"
	});
	const saveBtn = doc.createElement("button");
	saveBtn.textContent = "Save & Close";
	Object.assign(saveBtn.style, {
		all: "unset",
		font: "600 12px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
		padding: "6px 10px",
		background: "#5bc0be",
		color: "#08121f",
		borderRadius: "8px",
		cursor: "pointer"
	});
	saveBtn.addEventListener("mousedown", (e) => e.stopPropagation());
	saveBtn.addEventListener("click", async () => {
		try {
			const noteText = (ta.value || "").trim();
			const topHref = (() => {
				try { return window.top.location.href || window.location.href; } catch { return window.location.href; }
			})();
			const flowId = parseFlowIdFromUrl(topHref);
			if (!flowId) {
				alert("Could not determine Flow Id from URL. Note not saved.");
				return;
			}
			const rect = pop.getBoundingClientRect();
			const payload = {
				FlowId__c: flowId,
				NoteText__c: noteText,
				PosTop__c: Math.round(rect.top),
				PosLeft__c: Math.round(rect.left),
				CanvasUrl__c: topHref
			};
			await createFlowNote(payload);
			pop.remove();
		} catch (err) {
			console.warn("[FlowNotes] Save failed", err);
			alert("Failed to save note. See console for details.");
		}
	});
	footer.appendChild(saveBtn);

	pop.appendChild(header);
	pop.appendChild(ta);
	pop.appendChild(footer);
	(doc.body || doc.documentElement).appendChild(pop);
	makeDraggable(pop);
	setTimeout(() => ta.focus(), 0);
}

function parseFlowIdFromUrl(href) {
	try {
		const u = new URL(href);
		return u.searchParams.get("flowId");
	} catch {
		return null;
	}
}

async function createFlowNote(fields) {
	// Describe object to filter to valid creatable fields (handles orgs missing fields)
	const allowed = await getCreatableFieldSet("FlowNote__c");
	const filtered = {};
	for (const [k, v] of Object.entries(fields || {})) {
		if (allowed.has(k)) filtered[k] = v;
	}
	// Route via background proxy to call the org instance with SID Authorization
	const res = await chrome.runtime.sendMessage({
		type: "proxy",
		path: "/services/data/v60.0/sobjects/FlowNote__c",
		method: "POST",
		body: filtered
	});
	if (!res?.ok) {
		const detail = (res?.body || res?.error || "").toString();
		// Fallback: remove any field names referenced in INVALID_FIELD errors and retry once
		const missing = extractMissingFieldNames(detail);
		if (missing.length > 0) {
			const withoutMissing = {};
			for (const [k, v] of Object.entries(filtered)) {
				if (!missing.includes(k)) withoutMissing[k] = v;
			}
			const retry = await chrome.runtime.sendMessage({
				type: "proxy",
				path: "/services/data/v60.0/sobjects/FlowNote__c",
				method: "POST",
				body: withoutMissing
			});
			if (retry?.ok) {
				console.warn("[FlowNotes] Saved after removing missing fields:", missing.join(", "));
				try { return JSON.parse(retry.body || "{}"); } catch { return { ok: true }; }
			}
		}
		throw new Error(`HTTP ${res?.status || ""} ${detail}`.trim());
	}
	try {
		return JSON.parse(res.body || "{}");
	} catch {
		return { ok: true };
	}
}

function extractMissingFieldNames(detail) {
	const out = [];
	try {
		const arr = JSON.parse(detail);
		if (Array.isArray(arr)) {
			for (const e of arr) {
				const m = String(e?.message || "");
				const match = m.match(/No such column '([^']+)'/);
				if (match && match[1]) out.push(match[1]);
			}
		}
	} catch {
		// not JSON; ignore
	}
	return out;
}

const describeCache = new Map();
async function getCreatableFieldSet(sobject) {
	if (describeCache.has(sobject)) return describeCache.get(sobject);
	const res = await chrome.runtime.sendMessage({
		type: "proxy",
		path: `/services/data/v60.0/sobjects/${encodeURIComponent(sobject)}/describe`,
		method: "GET"
	});
	const set = new Set();
	if (res?.ok) {
		try {
			const desc = JSON.parse(res.body || "{}");
			const fields = Array.isArray(desc?.fields) ? desc.fields : [];
			for (const f of fields) {
				if (f?.createable) set.add(f.name);
			}
		} catch {
			// ignore
		}
	}
	// Always allow FlowId__c in case describe failed but it's standard in our package
	set.add("FlowId__c");
	describeCache.set(sobject, set);
	return set;
}

// Initialize in all frames (Flow Builder may render within an inner frame)
ensureToolbarMounted();
// Re-check shortly after initial load in case Lightning router updated late
setTimeout(ensureToolbarMounted, 1200);
watchRouteChanges();


