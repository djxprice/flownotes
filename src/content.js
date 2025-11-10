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
	// Display button
	const displayBtn = targetDoc.createElement("button");
	displayBtn.style.all = "unset";
	displayBtn.style.font = "600 12px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
	displayBtn.style.padding = "6px 10px";
	displayBtn.style.background = "rgba(255,255,255,0.16)";
	displayBtn.style.color = "#e6ecf1";
	displayBtn.style.borderRadius = "8px";
	displayBtn.style.cursor = "pointer";
	displayBtn.textContent = "Display";
	displayBtn.addEventListener("mousedown", (e) => e.stopPropagation());
	displayBtn.addEventListener("click", displayNotesForCurrentFlow);
	root.appendChild(title);
	root.appendChild(noteBtn);
	root.appendChild(displayBtn);
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
		moveEl.dataset.dragging = "1";
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
		delete moveEl.dataset.dragging;
		window.removeEventListener("mousemove", onMouseMove);
		window.removeEventListener("mouseup", onMouseUp);
		persistToolbarPosition(moveEl);
		// If this is a displayed note, update its canvas-relative dataset so it stays anchored
		if (moveEl.classList.contains(DISPLAY_NOTE_CLASS)) {
			const rect = moveEl.getBoundingClientRect();
			const svg = getCanvasSvg();
			if (svg && typeof svg.getScreenCTM === "function") {
				try {
					const inv = svg.getScreenCTM().inverse();
					const pt = new DOMPoint(rect.left, rect.top);
					const local = pt.matrixTransform(inv);
					moveEl.dataset.canvasTop = String(Math.round(local.y));
					moveEl.dataset.canvasLeft = String(Math.round(local.x));
				} catch {
					const canvasRect = getCanvasRect();
					moveEl.dataset.canvasTop = String(Math.round(rect.top - canvasRect.top));
					moveEl.dataset.canvasLeft = String(Math.round(rect.left - canvasRect.left));
				}
			} else {
				const canvasRect = getCanvasRect();
				moveEl.dataset.canvasTop = String(Math.round(rect.top - canvasRect.top));
				moveEl.dataset.canvasLeft = String(Math.round(rect.left - canvasRect.left));
			}
		}
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
			// Measure relative to Flow canvas bounding rect (viewport relative) for scroll-proof positioning
			const canvasRect = getCanvasRect();
			const relTop = Math.round(rect.top - canvasRect.top);
			const relLeft = Math.round(rect.left - canvasRect.left);
			const payload = {
				FlowId__c: flowId,
				NoteText__c: noteText,
				PosTop__c: relTop,
				PosLeft__c: relLeft,
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
	// Describe object to filter to valid fields based on FLS
	const access = await getFieldAccess("FlowNote__c");
	const desired = fields || {};
	const createPayload = {};
	const deferredUpdate = {};
	for (const [k, v] of Object.entries(desired)) {
		if (access.createable.has(k)) {
			createPayload[k] = v;
		} else if (access.updateable.has(k)) {
			deferredUpdate[k] = v;
		}
	}
	// Create
	const createRes = await chrome.runtime.sendMessage({
		type: "proxy",
		path: "/services/data/v60.0/sobjects/FlowNote__c",
		method: "POST",
		body: createPayload
	});
	if (!createRes?.ok) {
		const detail = (createRes?.body || createRes?.error || "").toString();
		// Fallback: remove any invalid fields and retry once
		const missing = extractMissingFieldNames(detail);
		if (missing.length > 0) {
			const withoutMissing = {};
			for (const [k, v] of Object.entries(createPayload)) {
				if (!missing.includes(k)) withoutMissing[k] = v;
			}
			const retry = await chrome.runtime.sendMessage({
				type: "proxy",
				path: "/services/data/v60.0/sobjects/FlowNote__c",
				method: "POST",
				body: withoutMissing
			});
			if (!retry?.ok) {
				throw new Error(`HTTP ${retry?.status || ""} ${retry?.body || retry?.error || ""}`.trim());
			}
			let created = {};
			try { created = JSON.parse(retry.body || "{}"); } catch {}
			await maybePatchDeferred(created?.id, deferredUpdate, access);
			return created;
		}
		throw new Error(`HTTP ${createRes?.status || ""} ${detail}`.trim());
	}
	let created = {};
	try { created = JSON.parse(createRes.body || "{}"); } catch {}
	await maybePatchDeferred(created?.id, deferredUpdate, access);
	return created;
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
async function getFieldAccess(sobject) {
	if (describeCache.has(sobject)) return describeCache.get(sobject);
	const res = await chrome.runtime.sendMessage({
		type: "proxy",
		path: `/services/data/v60.0/sobjects/${encodeURIComponent(sobject)}/describe`,
		method: "GET"
	});
	const access = { createable: new Set(), updateable: new Set() };
	if (res?.ok) {
		try {
			const desc = JSON.parse(res.body || "{}");
			const fields = Array.isArray(desc?.fields) ? desc.fields : [];
			for (const f of fields) {
				if (f?.createable) access.createable.add(f.name);
				if (f?.updateable) access.updateable.add(f.name);
			}
		} catch {
			// ignore
		}
	}
	// Always allow FlowId__c in case describe failed but it's standard in our package
	access.createable.add("FlowId__c");
	describeCache.set(sobject, access);
	return access;
}

async function maybePatchDeferred(recordId, deferredUpdate, access) {
	if (!recordId) return;
	const updatePayload = {};
	for (const [k, v] of Object.entries(deferredUpdate || {})) {
		if (access.updateable.has(k)) updatePayload[k] = v;
	}
	if (Object.keys(updatePayload).length === 0) return;
	const res = await chrome.runtime.sendMessage({
		type: "proxy",
		path: `/services/data/v60.0/sobjects/FlowNote__c/${encodeURIComponent(recordId)}`,
		method: "PATCH",
		body: updatePayload
	});
	if (!res?.ok) {
		console.warn("[FlowNotes] Patch deferred fields failed", res?.status, res?.body || res?.error);
	}
}

// -------------------------------------------------------------------
// Display notes for current flow
// -------------------------------------------------------------------
const DISPLAY_NOTE_CLASS = "flownotes-note-display";
const MIN_VISIBLE_SCALE = 0.5;
const MAX_SCALE = 2.0;
let baselineCanvasRect = null;

async function displayNotesForCurrentFlow() {
	try {
		const href = (() => { try { return window.top.location.href; } catch { return window.location.href; } })();
		const flowId = parseFlowIdFromUrl(href);
		if (!flowId) {
			alert("Could not determine Flow Id from URL.");
			return;
		}
		clearDisplayedNotes();
		// Set baseline canvas rect for scaling
		baselineCanvasRect = getCanvasRect();
		const soql = `SELECT Id, NoteText__c, PosTop__c, PosLeft__c, CanvasUrl__c FROM FlowNote__c WHERE FlowId__c = '${escapeSoqlLiteral(flowId)}' ORDER BY CreatedDate ASC`;
		const res = await chrome.runtime.sendMessage({
			type: "proxy",
			path: `/services/data/v60.0/query?q=${encodeURIComponent(soql)}`,
			method: "GET"
		});
		if (!res?.ok) {
			throw new Error(`HTTP ${res?.status || ""} ${res?.body || res?.error || ""}`);
		}
		let data = {};
		try { data = JSON.parse(res.body || "{}"); } catch {}
		const records = Array.isArray(data?.records) ? data.records : [];
		const doc = getTargetDocument();
		let idx = 0;
		for (const r of records) {
			renderDisplayNote(doc, r, idx++);
		}
		if (records.length === 0) {
			alert("No notes found for this flow.");
		}
	} catch (e) {
		console.warn("[FlowNotes] Display failed", e);
		alert("Failed to display notes. See console for details.");
	}
}

function clearDisplayedNotes() {
	const doc = getTargetDocument();
	doc.querySelectorAll(`.${DISPLAY_NOTE_CLASS}`).forEach(el => el.remove());
}

function renderDisplayNote(doc, rec, index) {
	const el = doc.createElement("div");
	el.className = DISPLAY_NOTE_CLASS;
	Object.assign(el.style, {
		position: "fixed",
		zIndex: "2147483647",
		background: "rgba(255,255,160,0.95)",
		color: "#202020",
		border: "1px solid rgba(0,0,0,0.2)",
		boxShadow: "0 8px 18px rgba(0,0,0,0.25)",
		borderRadius: "8px",
		width: "260px",
		maxWidth: "40vw",
		padding: "8px"
	});
	// Save canvas-relative coords in dataset for responsive layout
	const savedTop = (typeof rec?.PosTop__c === "number") ? rec.PosTop__c : 120 + index * 24;
	const savedLeft = (typeof rec?.PosLeft__c === "number") ? rec.PosLeft__c : 24;
	el.dataset.canvasTop = String(savedTop);
	el.dataset.canvasLeft = String(savedLeft);

	// Header
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
	title.textContent = `Note`;
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
		background: "rgba(0,0,0,0.08)"
	});
	closeBtn.addEventListener("mousedown", (e) => e.stopPropagation());
	closeBtn.addEventListener("click", () => el.remove());
	header.appendChild(title);
	header.appendChild(closeBtn);

	// Body
	const body = doc.createElement("div");
	Object.assign(body.style, {
		whiteSpace: "pre-wrap",
		font: "13px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
	});
	body.textContent = rec?.NoteText__c || "(no text)";

	el.appendChild(header);
	el.appendChild(body);
	(doc.body || doc.documentElement).appendChild(el);
	makeDraggable(el);
	// Initial layout
	layoutDisplayedNotes();
}

function escapeSoqlLiteral(value) {
	return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function getCanvasSvg() {
	const doc = getTargetDocument();
	const svgs = Array.from(doc.querySelectorAll("svg"));
	if (svgs.length === 0) return null;
	let best = null;
	let bestArea = 0;
	for (const svg of svgs) {
		const r = svg.getBoundingClientRect();
		const area = Math.max(0, r.width) * Math.max(0, r.height);
		if (area > bestArea) {
			bestArea = area;
			best = svg;
		}
	}
	return best || svgs[0];
}

function getCanvasRect() {
	const doc = getTargetDocument();
	const svgs = Array.from(doc.querySelectorAll("svg"));
	if (svgs.length === 0) {
		// Fallback to viewport with some padding
		const vw = window.innerWidth || 1200;
		const vh = window.innerHeight || 800;
		return { top: 0, left: 0, width: vw, height: vh };
	}
	// Choose the largest visible SVG as the canvas
	let best = null;
	let bestArea = 0;
	for (const svg of svgs) {
		const r = svg.getBoundingClientRect();
		const area = Math.max(0, r.width) * Math.max(0, r.height);
		if (area > bestArea) {
			bestArea = area;
			best = r;
		}
	}
	return best || svgs[0].getBoundingClientRect();
}

// Reposition displayed notes to stay anchored to the canvas rect
let lastCanvasRectKey = "";
function layoutDisplayedNotes() {
	const rect = getCanvasRect();
	const svg = getCanvasSvg();
	if (!baselineCanvasRect) baselineCanvasRect = rect;
	let scaleX = 1, scaleY = 1;
	if (svg && typeof svg.getScreenCTM === "function") {
		try {
			const m = svg.getScreenCTM();
			scaleX = Math.hypot(m.a, m.b) || 1;
			scaleY = Math.hypot(m.c, m.d) || 1;
		} catch {
			scaleX = rect.width && baselineCanvasRect.width ? rect.width / baselineCanvasRect.width : 1;
			scaleY = rect.height && baselineCanvasRect.height ? rect.height / baselineCanvasRect.height : 1;
		}
	} else {
		scaleX = rect.width && baselineCanvasRect.width ? rect.width / baselineCanvasRect.width : 1;
		scaleY = rect.height && baselineCanvasRect.height ? rect.height / baselineCanvasRect.height : 1;
	}
	// Use uniform scaling; only clamp upper bound
	let scale = Math.min(MAX_SCALE, Math.min(scaleX, scaleY) || 1);
	scaleX = scaleY = scale;
	const key = `${Math.round(rect.top)}|${Math.round(rect.left)}|${Math.round(rect.width)}|${Math.round(rect.height)}`;
	lastCanvasRectKey = key;
	const doc = getTargetDocument();
	const nodes = doc.querySelectorAll(`.${DISPLAY_NOTE_CLASS}`);
	for (const el of nodes) {
		// Skip while dragging
		if (el.dataset.dragging === "1") continue;
		const savedTop = Number(el.dataset.canvasTop || 0);
		const savedLeft = Number(el.dataset.canvasLeft || 0);
		let anchorTop = rect.top + (savedTop * scaleY);
		let anchorLeft = rect.left + (savedLeft * scaleX);
		if (svg && typeof svg.getScreenCTM === "function") {
			try {
				const m = svg.getScreenCTM();
				const pt = new DOMPoint(savedLeft, savedTop);
				const sp = pt.matrixTransform(m);
				anchorLeft = sp.x;
				anchorTop = sp.y;
			} catch {}
		}
		// Allow a small margin to reduce flicker at screen edges
		const margin = 10;
		const inView =
			anchorTop >= -margin &&
			anchorLeft >= -margin &&
			anchorTop <= (window.innerHeight || 800) + margin &&
			anchorLeft <= (window.innerWidth || 1200) + margin;
		if (!inView) {
			el.style.display = "none";
			continue;
		}
		el.style.display = "";
		el.style.transformOrigin = "top left";
		el.style.transform = `scale(${scaleX}, ${scaleY})`;
		el.style.top = `${Math.round(anchorTop)}px`;
		el.style.left = `${Math.round(anchorLeft)}px`;
	}
}
// Initialize in all frames (Flow Builder may render within an inner frame)
ensureToolbarMounted();
// Re-check shortly after initial load in case Lightning router updated late
setTimeout(ensureToolbarMounted, 1200);
watchRouteChanges();
// Keep notes anchored on scroll/resize/canvas changes
window.addEventListener("scroll", () => layoutDisplayedNotes(), true);
window.addEventListener("resize", () => layoutDisplayedNotes(), true);
(function trackCanvas() {
	let lastKey = "";
	function tick() {
		const r = getCanvasRect();
		const key = `${Math.round(r.top)}|${Math.round(r.left)}|${Math.round(r.width)}|${Math.round(r.height)}`;
		if (key !== lastKey) {
			lastKey = key;
			layoutDisplayedNotes();
		}
		requestAnimationFrame(tick);
	}
	requestAnimationFrame(tick);
})();


