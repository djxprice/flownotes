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
	noteBtn.addEventListener("click", () => {
		// Placeholder: later can open a note input or send message
		console.log("[FlowNotes] Note+ clicked");
	});
	root.appendChild(title);
	root.appendChild(noteBtn);
	(targetDoc.body || targetDoc.documentElement).appendChild(container);

	makeDraggable(root);
	restoreToolbarPosition(root);
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

// Initialize in all frames (Flow Builder may render within an inner frame)
ensureToolbarMounted();
// Re-check shortly after initial load in case Lightning router updated late
setTimeout(ensureToolbarMounted, 1200);
watchRouteChanges();


