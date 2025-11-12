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

// ===================================================================
// FlowNotes Toolbar - Flow Builder Integration
// ===================================================================

const TOOLBAR_ID = "flownotes-toolbar";
const NOTE_POPOUT_ID = "flownotes-note-popout";

/**
 * Check if we're on a Flow Builder page
 */
function isFlowBuilderPage() {
	try {
		const href = window.location.href || "";
		return href.includes("/builder_platform_interaction/flowBuilder.app");
	} catch {
		return false;
	}
}

/**
 * Make an element draggable
 */
function makeDraggable(element) {
	let isDragging = false;
	let startX = 0;
	let startY = 0;
	let initialTop = 0;
	let initialLeft = 0;
	
	element.style.cursor = "move";
	
	function onMouseDown(e) {
		// Only drag if clicking on the element directly (not buttons)
		if (e.target !== element && !e.target.classList.contains("flownotes-drag-handle")) {
			return;
		}
		
		isDragging = true;
		startX = e.clientX;
		startY = e.clientY;
		
		const rect = element.getBoundingClientRect();
		initialTop = rect.top;
		initialLeft = rect.left;
		
		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);
		e.preventDefault();
	}
	
	function onMouseMove(e) {
		if (!isDragging) return;
		
		const deltaX = e.clientX - startX;
		const deltaY = e.clientY - startY;
		
		const newTop = Math.max(0, initialTop + deltaY);
		const newLeft = Math.max(0, initialLeft + deltaX);
		
		element.style.top = `${newTop}px`;
		element.style.left = `${newLeft}px`;
	}
	
	function onMouseUp() {
		if (!isDragging) return;
		isDragging = false;
		
		document.removeEventListener("mousemove", onMouseMove);
		document.removeEventListener("mouseup", onMouseUp);
		
		// Save position
		saveToolbarPosition(element);
	}
	
	element.addEventListener("mousedown", onMouseDown);
}

/**
 * Save toolbar position to localStorage
 */
function saveToolbarPosition(toolbar) {
	try {
		const rect = toolbar.getBoundingClientRect();
		const position = {
			top: rect.top,
			left: rect.left
		};
		localStorage.setItem("flownotes-toolbar-position", JSON.stringify(position));
	} catch (e) {
		console.warn("[FlowNotes] Failed to save toolbar position:", e);
	}
}

/**
 * Restore toolbar position from localStorage
 */
function restoreToolbarPosition(toolbar) {
	try {
		const saved = localStorage.getItem("flownotes-toolbar-position");
		if (!saved) return;
		
		const position = JSON.parse(saved);
		if (typeof position.top === "number" && typeof position.left === "number") {
			// Ensure position is within viewport
			const maxTop = Math.max(0, window.innerHeight - 50);
			const maxLeft = Math.max(0, window.innerWidth - 150);
			
			const top = Math.min(Math.max(0, position.top), maxTop);
			const left = Math.min(Math.max(0, position.left), maxLeft);
			
			toolbar.style.top = `${top}px`;
			toolbar.style.left = `${left}px`;
		}
	} catch (e) {
		console.warn("[FlowNotes] Failed to restore toolbar position:", e);
	}
}

/**
 * Inject the FlowNotes toolbar into the page
 */
function injectToolbar() {
	// Avoid duplicate injection
	if (document.getElementById(TOOLBAR_ID)) return;
	
	// Create toolbar container
	const toolbar = document.createElement("div");
	toolbar.id = TOOLBAR_ID;
	
	// Apply inline styles (avoids CSP issues)
	Object.assign(toolbar.style, {
		position: "fixed",
		top: "80px",
		left: "20px",
		zIndex: "2147483647",
		display: "inline-flex",
		alignItems: "center",
		gap: "8px",
		padding: "8px 12px",
		background: "rgba(28, 37, 65, 0.95)",
		color: "#e6ecf1",
		border: "1px solid rgba(255, 255, 255, 0.12)",
		borderRadius: "10px",
		boxShadow: "0 6px 24px rgba(0, 0, 0, 0.25)",
		backdropFilter: "blur(4px)",
		fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
		userSelect: "none"
	});
	
	// Toolbar title (acts as drag handle)
	const title = document.createElement("div");
	title.textContent = "FlowNotes";
	title.className = "flownotes-drag-handle";
	Object.assign(title.style, {
		fontSize: "12px",
		fontWeight: "600",
		opacity: "0.9"
	});
	
	toolbar.appendChild(title);
	
	// Note+ button
	const noteButton = document.createElement("button");
	noteButton.textContent = "Note+";
	Object.assign(noteButton.style, {
		all: "unset",
		padding: "6px 10px",
		fontSize: "12px",
		fontWeight: "600",
		background: "#5bc0be",
		color: "#08121f",
		borderRadius: "8px",
		cursor: "pointer",
		transition: "opacity 0.2s"
	});
	
	// Hover effect
	noteButton.addEventListener("mouseenter", () => {
		noteButton.style.opacity = "0.85";
	});
	noteButton.addEventListener("mouseleave", () => {
		noteButton.style.opacity = "1";
	});
	
	// Prevent drag when clicking button
	noteButton.addEventListener("mousedown", (e) => {
		e.stopPropagation();
	});
	
	// Open note popout on click
	noteButton.addEventListener("click", openNotePopout);
	
	toolbar.appendChild(noteButton);
	
	// Display button
	const displayButton = document.createElement("button");
	displayButton.textContent = "Display";
	Object.assign(displayButton.style, {
		all: "unset",
		padding: "6px 10px",
		fontSize: "12px",
		fontWeight: "600",
		background: "rgba(255, 255, 255, 0.16)",
		color: "#e6ecf1",
		borderRadius: "8px",
		cursor: "pointer",
		transition: "background 0.2s"
	});
	
	// Hover effect
	displayButton.addEventListener("mouseenter", () => {
		displayButton.style.background = "rgba(255, 255, 255, 0.24)";
	});
	displayButton.addEventListener("mouseleave", () => {
		displayButton.style.background = "rgba(255, 255, 255, 0.16)";
	});
	
	// Prevent drag when clicking button
	displayButton.addEventListener("mousedown", (e) => {
		e.stopPropagation();
	});
	
	// Display notes on click
	displayButton.addEventListener("click", displayNotes);
	
	toolbar.appendChild(displayButton);
	
	// Make toolbar draggable
	makeDraggable(toolbar);
	
	// Append to body
	document.body.appendChild(toolbar);
	
	// Restore saved position
	restoreToolbarPosition(toolbar);
	
	console.log("[FlowNotes] Toolbar injected successfully");
}

/**
 * Remove toolbar if we navigate away from Flow Builder
 */
function removeToolbar() {
	const toolbar = document.getElementById(TOOLBAR_ID);
	if (toolbar) {
		toolbar.remove();
		console.log("[FlowNotes] Toolbar removed");
	}
}

// ===================================================================
// Note Popout
// ===================================================================

/**
 * Open a note popout window
 */
function openNotePopout() {
	// If popout already exists, just focus it
	const existing = document.getElementById(NOTE_POPOUT_ID);
	if (existing) {
		const textarea = existing.querySelector("textarea");
		if (textarea) textarea.focus();
		return;
	}
	
	// Create popout container
	const popout = document.createElement("div");
	popout.id = NOTE_POPOUT_ID;
	
	Object.assign(popout.style, {
		position: "fixed",
		top: "150px",
		left: "60px",
		zIndex: "2147483647",
		width: "300px",
		padding: "8px",
		background: "rgba(28, 37, 65, 0.98)",
		color: "#e6ecf1",
		border: "1px solid rgba(255, 255, 255, 0.12)",
		borderRadius: "10px",
		boxShadow: "0 10px 30px rgba(0, 0, 0, 0.35)",
		backdropFilter: "blur(4px)",
		fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
	});
	
	// Header (with title and close button)
	const header = document.createElement("div");
	Object.assign(header.style, {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: "8px",
		cursor: "move"
	});
	header.className = "flownotes-drag-handle";
	
	const headerTitle = document.createElement("div");
	headerTitle.textContent = "New Note";
	Object.assign(headerTitle.style, {
		fontSize: "12px",
		fontWeight: "600",
		opacity: "0.9"
	});
	
	const closeButton = document.createElement("button");
	closeButton.textContent = "×";
	closeButton.title = "Close";
	Object.assign(closeButton.style, {
		all: "unset",
		width: "22px",
		height: "22px",
		lineHeight: "22px",
		textAlign: "center",
		fontSize: "18px",
		borderRadius: "6px",
		cursor: "pointer",
		background: "rgba(255, 255, 255, 0.08)",
		transition: "background 0.2s"
	});
	
	closeButton.addEventListener("mouseenter", () => {
		closeButton.style.background = "rgba(255, 255, 255, 0.15)";
	});
	closeButton.addEventListener("mouseleave", () => {
		closeButton.style.background = "rgba(255, 255, 255, 0.08)";
	});
	closeButton.addEventListener("mousedown", (e) => e.stopPropagation());
	closeButton.addEventListener("click", () => popout.remove());
	
	header.appendChild(headerTitle);
	header.appendChild(closeButton);
	
	// Textarea
	const textarea = document.createElement("textarea");
	textarea.placeholder = "Type your note here...";
	Object.assign(textarea.style, {
		width: "100%",
		height: "120px",
		padding: "8px",
		fontSize: "13px",
		lineHeight: "1.4",
		border: "1px solid rgba(255, 255, 255, 0.12)",
		borderRadius: "6px",
		background: "rgba(12, 18, 32, 0.9)",
		color: "#e6ecf1",
		resize: "vertical",
		boxSizing: "border-box",
		fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
	});
	textarea.addEventListener("mousedown", (e) => e.stopPropagation());
	
	// Footer (Save & Close button)
	const footer = document.createElement("div");
	Object.assign(footer.style, {
		display: "flex",
		justifyContent: "flex-end",
		marginTop: "8px"
	});
	
	const saveButton = document.createElement("button");
	saveButton.textContent = "Save & Close";
	Object.assign(saveButton.style, {
		all: "unset",
		padding: "6px 12px",
		fontSize: "12px",
		fontWeight: "600",
		background: "#5bc0be",
		color: "#08121f",
		borderRadius: "8px",
		cursor: "pointer",
		transition: "opacity 0.2s"
	});
	
	saveButton.addEventListener("mouseenter", () => {
		saveButton.style.opacity = "0.85";
	});
	saveButton.addEventListener("mouseleave", () => {
		saveButton.style.opacity = "1";
	});
	saveButton.addEventListener("mousedown", (e) => e.stopPropagation());
	saveButton.addEventListener("click", () => {
		saveNote(textarea.value, popout);
	});
	
	footer.appendChild(saveButton);
	
	// Assemble popout
	popout.appendChild(header);
	popout.appendChild(textarea);
	popout.appendChild(footer);
	
	// Make popout draggable
	makeDraggable(popout);
	
	// Add to page
	document.body.appendChild(popout);
	
	// Focus textarea
	setTimeout(() => textarea.focus(), 0);
	
	console.log("[FlowNotes] Note popout opened");
}

/**
 * Extract Flow ID from the current URL
 */
function getFlowIdFromUrl() {
	try {
		const url = new URL(window.location.href);
		return url.searchParams.get("flowId");
	} catch (e) {
		console.warn("[FlowNotes] Failed to parse Flow ID from URL:", e);
		return null;
	}
}

/**
 * Save a note to Salesforce
 */
async function saveNote(noteText, popout) {
	try {
		// Validate note text
		const text = (noteText || "").trim();
		if (!text) {
			alert("Please enter some text for your note.");
			return;
		}
		
		// Get Flow ID
		const flowId = getFlowIdFromUrl();
		if (!flowId) {
			alert("Could not determine Flow ID from URL. Please ensure you're on a Flow Builder page.");
			return;
		}
		
		console.log("[FlowNotes] Saving note to Salesforce...", { flowId, textLength: text.length });
		
		// Disable save button during save
		const saveButton = popout.querySelector("button");
		if (saveButton) {
			saveButton.disabled = true;
			saveButton.textContent = "Saving...";
			saveButton.style.opacity = "0.6";
		}
		
		// Create FlowNote__c record via background script
		const response = await chrome.runtime.sendMessage({
			type: "proxy",
			path: "/services/data/v60.0/sobjects/FlowNote__c",
			method: "POST",
			body: {
				FlowId__c: flowId,
				NoteText__c: text
			}
		});
		
		if (!response || !response.ok) {
			throw new Error(response?.body || response?.error || "Failed to save note");
		}
		
		// Parse response to get record ID
		let result = {};
		try {
			result = JSON.parse(response.body || "{}");
		} catch (e) {
			console.warn("[FlowNotes] Failed to parse save response:", e);
		}
		
		console.log("[FlowNotes] Note saved successfully:", result);
		
		// Close popout
		popout.remove();
		
		// Show success message
		showToast("Note saved successfully!");
		
	} catch (error) {
		console.error("[FlowNotes] Failed to save note:", error);
		alert(`Failed to save note: ${error.message}\n\nPlease check the console for details.`);
		
		// Re-enable save button
		const saveButton = popout.querySelector("button");
		if (saveButton) {
			saveButton.disabled = false;
			saveButton.textContent = "Save & Close";
			saveButton.style.opacity = "1";
		}
	}
}

/**
 * Show a temporary toast notification
 */
function showToast(message) {
	const toast = document.createElement("div");
	toast.textContent = message;
	Object.assign(toast.style, {
		position: "fixed",
		bottom: "20px",
		right: "20px",
		padding: "12px 16px",
		background: "rgba(28, 37, 65, 0.95)",
		color: "#5bc0be",
		border: "1px solid rgba(91, 192, 190, 0.3)",
		borderRadius: "8px",
		boxShadow: "0 6px 24px rgba(0, 0, 0, 0.25)",
		zIndex: "2147483647",
		fontSize: "13px",
		fontWeight: "600",
		fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
		opacity: "0",
		transition: "opacity 0.3s"
	});
	
	document.body.appendChild(toast);
	
	// Fade in
	setTimeout(() => {
		toast.style.opacity = "1";
	}, 10);
	
	// Fade out and remove
	setTimeout(() => {
		toast.style.opacity = "0";
		setTimeout(() => toast.remove(), 300);
	}, 2500);
}

// ===================================================================
// Display Notes
// ===================================================================

const DISPLAYED_NOTE_CLASS = "flownotes-displayed-note";

/**
 * Display all notes for the current flow
 */
async function displayNotes() {
	try {
		// Get Flow ID
		const flowId = getFlowIdFromUrl();
		if (!flowId) {
			alert("Could not determine Flow ID from URL. Please ensure you're on a Flow Builder page.");
			return;
		}
		
		console.log("[FlowNotes] Fetching notes for flow:", flowId);
		
		// Build SOQL query
		const soql = `SELECT Id, NoteText__c, CreatedDate FROM FlowNote__c WHERE FlowId__c = '${escapeSOQL(flowId)}' ORDER BY CreatedDate DESC`;
		
		// Query via background script
		const response = await chrome.runtime.sendMessage({
			type: "proxy",
			path: `/services/data/v60.0/query?q=${encodeURIComponent(soql)}`,
			method: "GET"
		});
		
		if (!response || !response.ok) {
			throw new Error(response?.body || response?.error || "Failed to fetch notes");
		}
		
		// Parse response
		let data = {};
		try {
			data = JSON.parse(response.body || "{}");
		} catch (e) {
			throw new Error("Failed to parse query response");
		}
		
		const notes = data.records || [];
		console.log("[FlowNotes] Found notes:", notes.length);
		
		if (notes.length === 0) {
			showToast("No notes found for this flow");
			return;
		}
		
		// Clear any existing displayed notes
		clearDisplayedNotes();
		
		// Display each note
		let yOffset = 0;
		notes.forEach((note, index) => {
			displayNotePopout(note, yOffset);
			yOffset += 30; // Stagger notes vertically
		});
		
		showToast(`Displaying ${notes.length} note${notes.length === 1 ? "" : "s"}`);
		
	} catch (error) {
		console.error("[FlowNotes] Failed to display notes:", error);
		alert(`Failed to display notes: ${error.message}\n\nPlease check the console for details.`);
	}
}

/**
 * Clear all displayed note popouts
 */
function clearDisplayedNotes() {
	document.querySelectorAll(`.${DISPLAYED_NOTE_CLASS}`).forEach(el => el.remove());
}

/**
 * Display a single note as a popout
 */
function displayNotePopout(note, yOffset = 0) {
	// Create popout container
	const popout = document.createElement("div");
	popout.className = DISPLAYED_NOTE_CLASS;
	popout.dataset.noteId = note.Id;
	
	Object.assign(popout.style, {
		position: "fixed",
		top: `${200 + yOffset}px`,
		left: "100px",
		zIndex: "2147483646",
		width: "300px",
		padding: "8px",
		background: "rgba(28, 37, 65, 0.98)",
		color: "#e6ecf1",
		border: "1px solid rgba(255, 255, 255, 0.12)",
		borderRadius: "10px",
		boxShadow: "0 10px 30px rgba(0, 0, 0, 0.35)",
		backdropFilter: "blur(4px)",
		fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
	});
	
	// Header (with title and close button)
	const header = document.createElement("div");
	Object.assign(header.style, {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: "8px",
		cursor: "move"
	});
	header.className = "flownotes-drag-handle";
	
	const headerTitle = document.createElement("div");
	headerTitle.textContent = "Note";
	Object.assign(headerTitle.style, {
		fontSize: "12px",
		fontWeight: "600",
		opacity: "0.9"
	});
	
	const closeButton = document.createElement("button");
	closeButton.textContent = "×";
	closeButton.title = "Close";
	Object.assign(closeButton.style, {
		all: "unset",
		width: "22px",
		height: "22px",
		lineHeight: "22px",
		textAlign: "center",
		fontSize: "18px",
		borderRadius: "6px",
		cursor: "pointer",
		background: "rgba(255, 255, 255, 0.08)",
		transition: "background 0.2s"
	});
	
	closeButton.addEventListener("mouseenter", () => {
		closeButton.style.background = "rgba(255, 255, 255, 0.15)";
	});
	closeButton.addEventListener("mouseleave", () => {
		closeButton.style.background = "rgba(255, 255, 255, 0.08)";
	});
	closeButton.addEventListener("mousedown", (e) => e.stopPropagation());
	closeButton.addEventListener("click", () => popout.remove());
	
	header.appendChild(headerTitle);
	header.appendChild(closeButton);
	
	// Textarea (editable)
	const textarea = document.createElement("textarea");
	textarea.value = note.NoteText__c || "";
	Object.assign(textarea.style, {
		width: "100%",
		height: "120px",
		padding: "8px",
		fontSize: "13px",
		lineHeight: "1.4",
		border: "1px solid rgba(255, 255, 255, 0.12)",
		borderRadius: "6px",
		background: "rgba(12, 18, 32, 0.9)",
		color: "#e6ecf1",
		resize: "vertical",
		boxSizing: "border-box",
		fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
	});
	textarea.addEventListener("mousedown", (e) => e.stopPropagation());
	
	// Footer with Update & Close button
	const footer = document.createElement("div");
	Object.assign(footer.style, {
		display: "flex",
		justifyContent: "flex-end",
		marginTop: "8px"
	});
	
	const updateButton = document.createElement("button");
	updateButton.textContent = "Update & Close";
	Object.assign(updateButton.style, {
		all: "unset",
		padding: "6px 12px",
		fontSize: "12px",
		fontWeight: "600",
		background: "#5bc0be",
		color: "#08121f",
		borderRadius: "8px",
		cursor: "pointer",
		transition: "opacity 0.2s"
	});
	
	updateButton.addEventListener("mouseenter", () => {
		updateButton.style.opacity = "0.85";
	});
	updateButton.addEventListener("mouseleave", () => {
		updateButton.style.opacity = "1";
	});
	updateButton.addEventListener("mousedown", (e) => e.stopPropagation());
	updateButton.addEventListener("click", () => {
		updateNote(note.Id, textarea.value, popout);
	});
	
	footer.appendChild(updateButton);
	
	// Assemble popout
	popout.appendChild(header);
	popout.appendChild(textarea);
	popout.appendChild(footer);
	
	// Make popout draggable
	makeDraggable(popout);
	
	// Add to page
	document.body.appendChild(popout);
}

/**
 * Update an existing note in Salesforce
 */
async function updateNote(noteId, noteText, popout) {
	try {
		// Validate note text
		const text = (noteText || "").trim();
		if (!text) {
			alert("Please enter some text for your note.");
			return;
		}
		
		console.log("[FlowNotes] Updating note:", noteId);
		
		// Disable update button during save
		const updateButton = popout.querySelector("button");
		if (updateButton) {
			updateButton.disabled = true;
			updateButton.textContent = "Updating...";
			updateButton.style.opacity = "0.6";
		}
		
		// Update FlowNote__c record via background script
		const response = await chrome.runtime.sendMessage({
			type: "proxy",
			path: `/services/data/v60.0/sobjects/FlowNote__c/${noteId}`,
			method: "PATCH",
			body: {
				NoteText__c: text
			}
		});
		
		if (!response || !response.ok) {
			throw new Error(response?.body || response?.error || "Failed to update note");
		}
		
		console.log("[FlowNotes] Note updated successfully");
		
		// Close popout
		popout.remove();
		
		// Show success message
		showToast("Note updated successfully!");
		
	} catch (error) {
		console.error("[FlowNotes] Failed to update note:", error);
		alert(`Failed to update note: ${error.message}\n\nPlease check the console for details.`);
		
		// Re-enable update button
		const updateButton = popout.querySelector("button");
		if (updateButton) {
			updateButton.disabled = false;
			updateButton.textContent = "Update & Close";
			updateButton.style.opacity = "1";
		}
	}
}

/**
 * Escape SOQL string literals
 */
function escapeSOQL(value) {
	return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Monitor page changes and inject/remove toolbar as needed
 */
function watchForFlowBuilder() {
	let wasOnFlowBuilder = isFlowBuilderPage();
	
	// Initial check
	if (wasOnFlowBuilder) {
		injectToolbar();
	}
	
	// Watch for URL changes (Lightning navigation)
	let lastUrl = window.location.href;
	const checkInterval = setInterval(() => {
		const currentUrl = window.location.href;
		if (currentUrl !== lastUrl) {
			lastUrl = currentUrl;
			const nowOnFlowBuilder = isFlowBuilderPage();
			
			if (nowOnFlowBuilder && !wasOnFlowBuilder) {
				injectToolbar();
			} else if (!nowOnFlowBuilder && wasOnFlowBuilder) {
				removeToolbar();
			}
			
			wasOnFlowBuilder = nowOnFlowBuilder;
		}
	}, 1000);
	
	// Also watch for DOM changes (Lightning may rebuild the page)
	const observer = new MutationObserver(() => {
		if (isFlowBuilderPage() && !document.getElementById(TOOLBAR_ID)) {
			injectToolbar();
		}
	});
	
	observer.observe(document.documentElement, {
		childList: true,
		subtree: true
	});
}

// ===================================================================
// Initialization
// ===================================================================

console.log("[FlowNotes] Content script loaded");

// Wait for page to be ready
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", watchForFlowBuilder);
} else {
	watchForFlowBuilder();
}

// Re-check after a short delay (Lightning may load late)
setTimeout(() => {
	if (isFlowBuilderPage() && !document.getElementById(TOOLBAR_ID)) {
		injectToolbar();
	}
}, 1500);


