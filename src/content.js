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
		element.dataset.dragging = "1"; // Mark as dragging to skip position updates
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
		delete element.dataset.dragging; // Remove dragging marker
		
		document.removeEventListener("mousemove", onMouseMove);
		document.removeEventListener("mouseup", onMouseUp);
		
		// Save position for toolbar
		if (element.id === TOOLBAR_ID) {
			saveToolbarPosition(element);
		}
		
		// Update SVG coordinates for displayed notes
		if (element.classList.contains(DISPLAYED_NOTE_CLASS)) {
			const svg = getFlowCanvasSVG();
			if (svg) {
				const rect = element.getBoundingClientRect();
				const topLeft = screenToSVG(svg, rect.left, rect.top);
				const topRight = screenToSVG(svg, rect.right, rect.top);
				const bottomLeft = screenToSVG(svg, rect.left, rect.bottom);
				
				if (topLeft && topRight && bottomLeft) {
					element.dataset.tlx = topLeft.x;
					element.dataset.tly = topLeft.y;
					element.dataset.trx = topRight.x;
					element.dataset.try = topRight.y;
					element.dataset.blx = bottomLeft.x;
					element.dataset.bly = bottomLeft.y;
					
					// Calculate and store center
					const centerX = (rect.left + rect.right) / 2;
					const centerY = (rect.top + rect.bottom) / 2;
					const center = screenToSVG(svg, centerX, centerY);
					if (center) {
						element.dataset.centerX = center.x;
						element.dataset.centerY = center.y;
					}
				}
			}
		}
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
	
	// Hide button
	const hideButton = document.createElement("button");
	hideButton.textContent = "Hide";
	Object.assign(hideButton.style, {
		all: "unset",
		padding: "6px 10px",
		fontSize: "12px",
		fontWeight: "600",
		background: "rgba(255, 255, 255, 0.08)",
		color: "#e6ecf1",
		borderRadius: "8px",
		cursor: "pointer",
		transition: "background 0.2s"
	});
	
	// Hover effect
	hideButton.addEventListener("mouseenter", () => {
		hideButton.style.background = "rgba(255, 255, 255, 0.16)";
	});
	hideButton.addEventListener("mouseleave", () => {
		hideButton.style.background = "rgba(255, 255, 255, 0.08)";
	});
	
	// Prevent drag when clicking button
	hideButton.addEventListener("mousedown", (e) => {
		e.stopPropagation();
	});
	
	// Hide all notes on click
	hideButton.addEventListener("click", () => {
		const count = document.querySelectorAll(`.${DISPLAYED_NOTE_CLASS}`).length;
		clearDisplayedNotes();
		if (count > 0) {
			showToast(`Hid ${count} note${count === 1 ? "" : "s"}`);
		}
	});
	
	toolbar.appendChild(hideButton);
	
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
// SVG Canvas Helper Functions
// ===================================================================

/**
 * Find the Flow Builder canvas SVG element
 */
function getFlowCanvasSVG() {
	// The Flow Builder uses a large SVG for the canvas
	// Find the largest SVG element in the document
	const svgs = Array.from(document.querySelectorAll("svg"));
	if (svgs.length === 0) return null;
	
	let largest = svgs[0];
	let largestArea = 0;
	
	for (const svg of svgs) {
		const rect = svg.getBoundingClientRect();
		const area = rect.width * rect.height;
		if (area > largestArea) {
			largestArea = area;
			largest = svg;
		}
	}
	
	return largest;
}

/**
 * Convert screen coordinates to SVG-local coordinates
 */
function screenToSVG(svg, screenX, screenY) {
	if (!svg || typeof svg.getScreenCTM !== "function") return null;
	
	try {
		const ctm = svg.getScreenCTM();
		if (!ctm) return null;
		
		const inverse = ctm.inverse();
		const pt = new DOMPoint(screenX, screenY);
		const transformed = pt.matrixTransform(inverse);
		
		return { x: transformed.x, y: transformed.y };
	} catch (e) {
		console.warn("[FlowNotes] Failed to convert screen to SVG coords:", e);
		return null;
	}
}

/**
 * Convert SVG-local coordinates to screen coordinates
 */
function svgToScreen(svg, svgX, svgY) {
	if (!svg || typeof svg.getScreenCTM !== "function") return null;
	
	try {
		const ctm = svg.getScreenCTM();
		if (!ctm) return null;
		
		const pt = new DOMPoint(svgX, svgY);
		const transformed = pt.matrixTransform(ctm);
		
		// Validate the transformed coordinates are finite numbers
		if (!isFinite(transformed.x) || !isFinite(transformed.y)) {
			console.warn("[FlowNotes] SVG to screen conversion produced invalid coordinates:", {
				input: { svgX, svgY },
				output: { x: transformed.x, y: transformed.y },
				ctm: { a: ctm.a, b: ctm.b, c: ctm.c, d: ctm.d, e: ctm.e, f: ctm.f }
			});
			return null;
		}
		
		return { x: transformed.x, y: transformed.y };
	} catch (e) {
		console.warn("[FlowNotes] Failed to convert SVG to screen coords:", e);
		return null;
	}
}

/**
 * Get current canvas scale (zoom level)
 */
function getCanvasScale() {
	const svg = getFlowCanvasSVG();
	if (!svg || typeof svg.getScreenCTM !== "function") return 1;
	
	try {
		const ctm = svg.getScreenCTM();
		if (!ctm) return 1;
		
		// Scale is the magnitude of the transformation matrix
		const scaleX = Math.hypot(ctm.a, ctm.b);
		const scaleY = Math.hypot(ctm.c, ctm.d);
		
		// Return average scale
		return (scaleX + scaleY) / 2;
	} catch (e) {
		return 1;
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
	
	// Footer (Draw button and Save & Close button)
	const footer = document.createElement("div");
	Object.assign(footer.style, {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		marginTop: "8px",
		gap: "8px"
	});
	
	// Draw button
	const drawButton = document.createElement("button");
	drawButton.textContent = "📐 Draw";
	drawButton.title = "Draw a rectangle on the canvas to highlight elements";
	Object.assign(drawButton.style, {
		all: "unset",
		padding: "6px 12px",
		fontSize: "12px",
		fontWeight: "600",
		background: "rgba(255, 255, 255, 0.1)",
		color: "#e6ecf1",
		border: "1px solid rgba(255, 255, 255, 0.2)",
		borderRadius: "8px",
		cursor: "pointer",
		transition: "background 0.2s"
	});
	
	drawButton.addEventListener("mouseenter", () => {
		drawButton.style.background = "rgba(255, 255, 255, 0.15)";
	});
	drawButton.addEventListener("mouseleave", () => {
		drawButton.style.background = "rgba(255, 255, 255, 0.1)";
	});
	drawButton.addEventListener("mousedown", (e) => e.stopPropagation());
	drawButton.addEventListener("click", () => {
		startDrawingMode(popout);
	});
	
	// Save button
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
	
	footer.appendChild(drawButton);
	footer.appendChild(saveButton);
	
	// Assemble popout
	popout.appendChild(header);
	popout.appendChild(textarea);
	popout.appendChild(footer);
	
	// Make popout draggable
	makeDraggable(popout);
	
	// Add to page
	document.body.appendChild(popout);
	
	// Convert initial position to SVG coordinates so it can follow canvas
	const svg = getFlowCanvasSVG();
	if (svg) {
		const rect = popout.getBoundingClientRect();
		
		// Convert all four corners to SVG coordinates
		const topLeft = screenToSVG(svg, rect.left, rect.top);
		const topRight = screenToSVG(svg, rect.right, rect.top);
		const bottomLeft = screenToSVG(svg, rect.left, rect.bottom);
		const bottomRight = screenToSVG(svg, rect.right, rect.bottom);
		
		if (topLeft && topRight && bottomLeft && bottomRight) {
			// Store SVG coordinates in dataset
			popout.dataset.tlx = topLeft.x;
			popout.dataset.tly = topLeft.y;
			popout.dataset.trx = topRight.x;
			popout.dataset.try = topRight.y;
			popout.dataset.blx = bottomLeft.x;
			popout.dataset.bly = bottomLeft.y;
			popout.dataset.brx = bottomRight.x;
			popout.dataset.bry = bottomRight.y;
			
			// Mark it as a note that should be updated
			popout.className = DISPLAYED_NOTE_CLASS;
			
			// Store base dimensions
			popout.dataset.baseHeight = rect.height;
			
			// Add transform origin
			popout.style.transformOrigin = "top left";
			
			console.log("[FlowNotes] New note positioned with SVG coordinates");
		}
	}
	
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
		
		// Get popout position and dimensions
		const rect = popout.getBoundingClientRect();
		
		// Convert screen coordinates to SVG-local coordinates for canvas-relative positioning
		const svg = getFlowCanvasSVG();
		let cornerCoords = null;
		let centerCoords = null;
		
		if (svg) {
			// Convert all four corners to SVG coordinates
			const topLeft = screenToSVG(svg, rect.left, rect.top);
			const topRight = screenToSVG(svg, rect.right, rect.top);
			const bottomLeft = screenToSVG(svg, rect.left, rect.bottom);
			const bottomRight = screenToSVG(svg, rect.right, rect.bottom);
			
			// Calculate center
			const centerX = (rect.left + rect.right) / 2;
			const centerY = (rect.top + rect.bottom) / 2;
			const center = screenToSVG(svg, centerX, centerY);
			
			if (topLeft && topRight && bottomLeft && bottomRight && center) {
				cornerCoords = {
					TLX__c: Number(topLeft.x.toFixed(5)),
					TLY__c: Number(topLeft.y.toFixed(5)),
					TRX__c: Number(topRight.x.toFixed(5)),
					TRY__c: Number(topRight.y.toFixed(5)),
					BLX__c: Number(bottomLeft.x.toFixed(5)),
					BLY__c: Number(bottomLeft.y.toFixed(5)),
					BRX__c: Number(bottomRight.x.toFixed(5)),
					BRY__c: Number(bottomRight.y.toFixed(5))
				};
				centerCoords = {
					CenterX__c: Number(center.x.toFixed(5)),
					CenterY__c: Number(center.y.toFixed(5))
				};
				
				console.log("[FlowNotes] Saved canvas-relative coords:", { cornerCoords, centerCoords });
			}
		}
		
		// Create FlowNote__c record via background script
		const payload = {
			FlowId__c: flowId,
			NoteText__c: text,
			...(cornerCoords || {}),
			...(centerCoords || {})
		};
		
		// Store the base dimensions in chrome.storage for scaling reference
		const storageKey = `flownotes:dimensions:${flowId}`;
		try {
			await chrome.storage.local.set({
				[storageKey]: {
					width: rect.width,
					height: rect.height,
					scale: getCanvasScale()
				}
			});
		} catch (e) {
			console.warn("[FlowNotes] Failed to store dimensions:", e);
		}
		
		const response = await chrome.runtime.sendMessage({
			type: "proxy",
			path: "/services/data/v60.0/sobjects/FlowNote__c",
			method: "POST",
			body: payload
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
		
		// Build SOQL query - include all position fields
		const soql = `SELECT Id, NoteText__c, CreatedDate, TLX__c, TLY__c, TRX__c, TRY__c, BLX__c, BLY__c, BRX__c, BRY__c, CenterX__c, CenterY__c FROM FlowNote__c WHERE FlowId__c = '${escapeSOQL(flowId)}' ORDER BY CreatedDate DESC`;
		
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
	
	// Store SVG coordinates for repositioning
	if (note.TLX__c != null) popout.dataset.tlx = note.TLX__c;
	if (note.TLY__c != null) popout.dataset.tly = note.TLY__c;
	if (note.TRX__c != null) popout.dataset.trx = note.TRX__c;
	if (note.TRY__c != null) popout.dataset.try = note.TRY__c;
	if (note.BLX__c != null) popout.dataset.blx = note.BLX__c;
	if (note.BLY__c != null) popout.dataset.bly = note.BLY__c;
	if (note.CenterX__c != null) popout.dataset.centerX = note.CenterX__c;
	if (note.CenterY__c != null) popout.dataset.centerY = note.CenterY__c;
	
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
		fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
		transformOrigin: "top left"
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
	
	const buttonContainer = document.createElement("div");
	Object.assign(buttonContainer.style, {
		display: "flex",
		gap: "4px"
	});
	
	const deleteButton = document.createElement("button");
	deleteButton.textContent = "🗑";
	deleteButton.title = "Delete note";
	Object.assign(deleteButton.style, {
		all: "unset",
		width: "22px",
		height: "22px",
		lineHeight: "22px",
		textAlign: "center",
		fontSize: "14px",
		borderRadius: "6px",
		cursor: "pointer",
		background: "rgba(255, 77, 77, 0.2)",
		transition: "background 0.2s"
	});
	
	deleteButton.addEventListener("mouseenter", () => {
		deleteButton.style.background = "rgba(255, 77, 77, 0.3)";
	});
	deleteButton.addEventListener("mouseleave", () => {
		deleteButton.style.background = "rgba(255, 77, 77, 0.2)";
	});
	deleteButton.addEventListener("mousedown", (e) => e.stopPropagation());
	deleteButton.addEventListener("click", () => {
		if (confirm("Are you sure you want to delete this note?")) {
			deleteNote(note.Id, popout);
		}
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
	
	buttonContainer.appendChild(deleteButton);
	buttonContainer.appendChild(closeButton);
	
	header.appendChild(headerTitle);
	header.appendChild(buttonContainer);
	
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
 * Delete a note from Salesforce
 */
async function deleteNote(noteId, popout) {
	try {
		console.log("[FlowNotes] Deleting note:", noteId);
		
		// Delete FlowNote__c record via background script
		const response = await chrome.runtime.sendMessage({
			type: "proxy",
			path: `/services/data/v60.0/sobjects/FlowNote__c/${noteId}`,
			method: "DELETE"
		});
		
		if (!response || !response.ok) {
			throw new Error(response?.body || response?.error || "Failed to delete note");
		}
		
		console.log("[FlowNotes] Note deleted successfully");
		
		// Close popout
		popout.remove();
		
		// Show success message
		showToast("Note deleted successfully!");
		
	} catch (error) {
		console.error("[FlowNotes] Failed to delete note:", error);
		alert(`Failed to delete note: ${error.message}\n\nPlease check the console for details.`);
	}
}

/**
 * Update positions and scales of all displayed notes based on canvas transform
 */
function updateDisplayedNotePositions() {
	const svg = getFlowCanvasSVG();
	if (!svg) return;
	
	const notes = document.querySelectorAll(`.${DISPLAYED_NOTE_CLASS}`);
	
	for (const note of notes) {
		// Skip if currently dragging
		if (note.dataset.dragging === "1") continue;
		
		// Get stored SVG coordinates
		const tlx = parseFloat(note.dataset.tlx);
		const tly = parseFloat(note.dataset.tly);
		const trx = parseFloat(note.dataset.trx);
		const try_ = parseFloat(note.dataset.try);
		const blx = parseFloat(note.dataset.blx);
		const bly = parseFloat(note.dataset.bly);
		
		// Validate coordinates exist
		if (isNaN(tlx) || isNaN(tly) || isNaN(trx) || isNaN(try_) || isNaN(blx) || isNaN(bly)) {
			continue;
		}
		
		// Convert SVG coordinates to current screen position
		const topLeft = svgToScreen(svg, tlx, tly);
		const topRight = svgToScreen(svg, trx, try_);
		const bottomLeft = svgToScreen(svg, blx, bly);
		
		// Validate conversions succeeded
		if (!topLeft || !topRight || !bottomLeft) {
			// Coordinate conversion failed - preserve last known position
			console.warn("[FlowNotes] Coordinate conversion failed at current zoom level");
			continue;
		}
		
		// Validate converted coordinates are reasonable (not NaN or Infinity)
		if (!isFinite(topLeft.x) || !isFinite(topLeft.y) || 
		    !isFinite(topRight.x) || !isFinite(topRight.y) ||
		    !isFinite(bottomLeft.x) || !isFinite(bottomLeft.y)) {
			console.warn("[FlowNotes] Invalid coordinates after conversion:", { topLeft, topRight, bottomLeft });
			continue;
		}
		
		// Calculate width and height from corners
		const width = Math.abs(topRight.x - topLeft.x);
		const height = Math.abs(bottomLeft.y - topLeft.y);
		
		// Validate dimensions are reasonable
		if (width < 1 || height < 1 || width > 10000 || height > 10000) {
			console.warn("[FlowNotes] Invalid dimensions:", { width, height });
			continue;
		}
		
		// Get last valid position for comparison
		const lastValidLeft = parseFloat(note.dataset.lastValidLeft);
		const lastValidTop = parseFloat(note.dataset.lastValidTop);
		
		// Check for suspicious position jumps (coordinate system errors at extreme zoom)
		if (!isNaN(lastValidLeft) && !isNaN(lastValidTop)) {
			const distanceMoved = Math.hypot(
				topLeft.x - lastValidLeft,
				topLeft.y - lastValidTop
			);
			
			// Get current scale to detect extreme zoom
			const currentScale = getCanvasScale();
			
			// If at low scale AND position jumped significantly, it's suspicious
			// Scale < 0.5 means zoomed out, and jumps > 300px are likely errors
			if (currentScale < 0.5 && distanceMoved > 300) {
				console.warn("[FlowNotes] Suspicious position jump at extreme zoom:", {
					scale: currentScale,
					computed: { x: topLeft.x, y: topLeft.y },
					lastValid: { x: lastValidLeft, y: lastValidTop },
					distanceMoved
				});
				// Hide note instead of showing at wrong position
				note.style.opacity = "0";
				continue;
			}
			
			// Additional check: if position is in upper-left corner (< 200, 200) 
			// and last position was elsewhere, this is suspicious
			if (topLeft.x < 200 && topLeft.y < 200 && 
			    (Math.abs(lastValidLeft) > 300 || Math.abs(lastValidTop) > 300) &&
			    distanceMoved > 400) {
				console.warn("[FlowNotes] Suspicious jump to upper-left corner:", {
					computed: { x: topLeft.x, y: topLeft.y },
					lastValid: { x: lastValidLeft, y: lastValidTop },
					distanceMoved
				});
				// Hide note instead of showing at wrong position
				note.style.opacity = "0";
				continue;
			}
		}
		
		// Store last valid position before updating
		note.dataset.lastValidTop = topLeft.y;
		note.dataset.lastValidLeft = topLeft.x;
		
		// Position at top-left
		note.style.top = `${topLeft.y}px`;
		note.style.left = `${topLeft.x}px`;
		
		// Calculate scale factor
		const baseWidth = 300; // Original width
		const baseHeight = parseFloat(note.dataset.baseHeight) || 200;
		
		const scaleX = width / baseWidth;
		const scaleY = height / baseHeight;
		
		// Apply uniform scale (use minimum to maintain aspect ratio)
		const scale = Math.min(scaleX, scaleY);
		const clampedScale = Math.max(0.5, Math.min(2.0, scale)); // Clamp between 0.5x and 2x
		
		// Validate scale is reasonable
		if (!isFinite(clampedScale) || clampedScale <= 0) {
			console.warn("[FlowNotes] Invalid scale:", clampedScale);
			continue;
		}
		
		note.style.transform = `scale(${clampedScale})`;
		
		// Adjust visibility based on scale
		// Make sure note is visible (might have been hidden by suspicious position detection)
		if (clampedScale < 0.6) {
			note.style.opacity = "0.5";
		} else {
			note.style.opacity = "1";
		}
		
		// Ensure note is displayed (might have been hidden)
		note.style.display = "";
	}
	
	// Update all rectangle positions
	const rectangles = document.querySelectorAll(".flownotes-canvas-rectangle");
	for (const rect of rectangles) {
		updateRectanglePosition(rect);
	}
}

/**
 * Start continuous position/scale updates for displayed notes
 */
function startDisplayedNotesUpdateLoop() {
	function update() {
		updateDisplayedNotePositions();
		requestAnimationFrame(update);
	}
	requestAnimationFrame(update);
}

/**
 * Escape SOQL string literals
 */
function escapeSOQL(value) {
	return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// ===================================================================
// Canvas Drawing Feature
// ===================================================================

let drawingState = null; // Track drawing state: { startX, startY, previewRect, notePopout }

/**
 * Start drawing mode - user can draw a rectangle on canvas
 */
function startDrawingMode(notePopout) {
	console.log("[FlowNotes] Starting drawing mode...");
	
	// Cancel any existing drawing mode
	if (drawingState) {
		cancelDrawingMode();
	}
	
	// Change cursor to crosshair for entire document
	document.body.style.cursor = "crosshair !important";
	// Also add a style element to override canvas cursor
	const cursorStyle = document.createElement("style");
	cursorStyle.id = "flownotes-drawing-cursor";
	cursorStyle.textContent = "* { cursor: crosshair !important; }";
	document.head.appendChild(cursorStyle);
	
	// Show instructions
	showToast("Click on the canvas to set the first corner");
	
	// Add event listeners for drawing
	document.addEventListener("click", handleDrawingClick, true);
	document.addEventListener("keydown", handleDrawingEscape, true);
	
	// Store reference to note popout
	drawingState = {
		notePopout: notePopout,
		startX: null,
		startY: null,
		previewRect: null
	};
	
	console.log("[FlowNotes] Drawing mode active - waiting for first click");
}

/**
 * Handle click events during drawing mode
 */
function handleDrawingClick(e) {
	// Ignore clicks on the note popout itself
	if (e.target.closest(`#${NOTE_POPOUT_ID}`) || 
	    e.target.closest(`.${DISPLAYED_NOTE_CLASS}`)) {
		return;
	}
	
	e.preventDefault();
	e.stopPropagation();
	
	if (!drawingState.startX) {
		// First click - set start corner
		drawingState.startX = e.clientX;
		drawingState.startY = e.clientY;
		
		console.log("[FlowNotes] First corner set:", { x: drawingState.startX, y: drawingState.startY });
		showToast("Move mouse to size the rectangle, then click again");
		
		// Create preview rectangle
		createPreviewRectangle(drawingState.startX, drawingState.startY);
		
		// Add mousemove listener for preview
		document.addEventListener("mousemove", handleDrawingMouseMove, true);
		
	} else {
		// Second click - finalize rectangle
		const endX = e.clientX;
		const endY = e.clientY;
		
		console.log("[FlowNotes] Second corner set:", { x: endX, y: endY });
		
		// Finalize the rectangle
		finalizeRectangle(drawingState.startX, drawingState.startY, endX, endY, drawingState.notePopout);
		
		// Clean up drawing mode
		cancelDrawingMode();
	}
}

/**
 * Handle mouse move during drawing to show preview
 */
function handleDrawingMouseMove(e) {
	if (!drawingState || !drawingState.previewRect) return;
	
	const currentX = e.clientX;
	const currentY = e.clientY;
	
	// Calculate rectangle dimensions
	const left = Math.min(drawingState.startX, currentX);
	const top = Math.min(drawingState.startY, currentY);
	const width = Math.abs(currentX - drawingState.startX);
	const height = Math.abs(currentY - drawingState.startY);
	
	// Update preview rectangle
	drawingState.previewRect.style.left = `${left}px`;
	drawingState.previewRect.style.top = `${top}px`;
	drawingState.previewRect.style.width = `${width}px`;
	drawingState.previewRect.style.height = `${height}px`;
}

/**
 * Handle Escape key to cancel drawing
 */
function handleDrawingEscape(e) {
	if (e.key === "Escape") {
		console.log("[FlowNotes] Drawing cancelled by user");
		showToast("Drawing cancelled");
		cancelDrawingMode();
	}
}

/**
 * Create preview rectangle element
 */
function createPreviewRectangle(startX, startY) {
	const rect = document.createElement("div");
	rect.id = "flownotes-draw-preview";
	
	Object.assign(rect.style, {
		position: "fixed",
		left: `${startX}px`,
		top: `${startY}px`,
		width: "0px",
		height: "0px",
		border: "2px dashed #5bc0be",
		background: "rgba(91, 192, 190, 0.1)",
		pointerEvents: "none",
		zIndex: "2147483646"
	});
	
	document.body.appendChild(rect);
	drawingState.previewRect = rect;
	
	console.log("[FlowNotes] Preview rectangle created");
}

/**
 * Finalize rectangle and store coordinates
 */
function finalizeRectangle(startX, startY, endX, endY, notePopout) {
	console.log("[FlowNotes] Finalizing rectangle:", { startX, startY, endX, endY });
	
	// Convert screen coordinates to SVG coordinates
	const svg = getFlowCanvasSVG();
	if (!svg) {
		console.warn("[FlowNotes] Could not find SVG canvas");
		showToast("Error: Canvas not found");
		return;
	}
	
	// Calculate actual corners (normalize so we have top-left and bottom-right)
	const left = Math.min(startX, endX);
	const top = Math.min(startY, endY);
	const right = Math.max(startX, endX);
	const bottom = Math.max(startY, endY);
	
	// Convert to SVG coordinates
	const topLeftSVG = screenToSVG(svg, left, top);
	const topRightSVG = screenToSVG(svg, right, top);
	const bottomLeftSVG = screenToSVG(svg, left, bottom);
	const bottomRightSVG = screenToSVG(svg, right, bottom);
	
	if (!topLeftSVG || !topRightSVG || !bottomLeftSVG || !bottomRightSVG) {
		console.warn("[FlowNotes] Failed to convert rectangle coordinates");
		showToast("Error: Could not convert coordinates");
		return;
	}
	
	// Store rectangle coordinates in the note popout's dataset
	notePopout.dataset.rectTLX = topLeftSVG.x;
	notePopout.dataset.rectTLY = topLeftSVG.y;
	notePopout.dataset.rectTRX = topRightSVG.x;
	notePopout.dataset.rectTRY = topRightSVG.y;
	notePopout.dataset.rectBLX = bottomLeftSVG.x;
	notePopout.dataset.rectBLY = bottomLeftSVG.y;
	notePopout.dataset.rectBRX = bottomRightSVG.x;
	notePopout.dataset.rectBRY = bottomRightSVG.y;
	
	console.log("[FlowNotes] Rectangle coordinates stored in note:", {
		topLeft: topLeftSVG,
		topRight: topRightSVG,
		bottomLeft: bottomLeftSVG,
		bottomRight: bottomRightSVG
	});
	
	// Create a permanent rectangle element on the canvas
	createPermanentRectangle(notePopout);
	
	showToast("Rectangle drawn! Save the note to persist it.");
}

/**
 * Create a permanent rectangle element that follows canvas pan/zoom
 */
function createPermanentRectangle(noteOrDataset) {
	// Get rectangle SVG coordinates from dataset
	const rectTLX = parseFloat(noteOrDataset.dataset.rectTLX);
	const rectTLY = parseFloat(noteOrDataset.dataset.rectTLY);
	const rectTRX = parseFloat(noteOrDataset.dataset.rectTRX);
	const rectTRY = parseFloat(noteOrDataset.dataset.rectTRY);
	const rectBLX = parseFloat(noteOrDataset.dataset.rectBLX);
	const rectBLY = parseFloat(noteOrDataset.dataset.rectBLY);
	const rectBRX = parseFloat(noteOrDataset.dataset.rectBRX);
	const rectBRY = parseFloat(noteOrDataset.dataset.rectBRY);
	
	// Validate coordinates
	if (isNaN(rectTLX) || isNaN(rectTLY) || isNaN(rectTRX) || isNaN(rectTRY) ||
	    isNaN(rectBLX) || isNaN(rectBLY) || isNaN(rectBRX) || isNaN(rectBRY)) {
		console.warn("[FlowNotes] Invalid rectangle coordinates, cannot create rectangle");
		return null;
	}
	
	// Create rectangle element
	const rect = document.createElement("div");
	rect.className = "flownotes-canvas-rectangle";
	const noteId = noteOrDataset.dataset.noteId || noteOrDataset.id;
	rect.dataset.noteId = noteId;
	
	// Store SVG coordinates in rectangle's dataset for repositioning
	rect.dataset.rectTLX = rectTLX;
	rect.dataset.rectTLY = rectTLY;
	rect.dataset.rectTRX = rectTRX;
	rect.dataset.rectTRY = rectTRY;
	rect.dataset.rectBLX = rectBLX;
	rect.dataset.rectBLY = rectBLY;
	rect.dataset.rectBRX = rectBRX;
	rect.dataset.rectBRY = rectBRY;
	
	Object.assign(rect.style, {
		position: "fixed",
		border: "2px solid #5bc0be",
		background: "rgba(91, 192, 190, 0.05)",
		pointerEvents: "none",
		zIndex: "2147483644" // Below notes but above canvas
	});
	
	document.body.appendChild(rect);
	
	// Position it immediately
	updateRectanglePosition(rect);
	
	console.log("[FlowNotes] Permanent rectangle created for note:", noteId);
	
	return rect;
}

/**
 * Update a single rectangle's position based on SVG coordinates
 */
function updateRectanglePosition(rect) {
	const svg = getFlowCanvasSVG();
	if (!svg) return;
	
	// Get SVG coordinates from dataset
	const tlx = parseFloat(rect.dataset.rectTLX);
	const tly = parseFloat(rect.dataset.rectTLY);
	const trx = parseFloat(rect.dataset.rectTRX);
	const try_ = parseFloat(rect.dataset.rectTRY);
	const blx = parseFloat(rect.dataset.rectBLX);
	const bly = parseFloat(rect.dataset.rectBLY);
	
	// Validate
	if (isNaN(tlx) || isNaN(tly) || isNaN(trx) || isNaN(try_) || isNaN(blx) || isNaN(bly)) {
		return;
	}
	
	// Convert to screen coordinates
	const topLeft = svgToScreen(svg, tlx, tly);
	const topRight = svgToScreen(svg, trx, try_);
	const bottomLeft = svgToScreen(svg, blx, bly);
	
	if (!topLeft || !topRight || !bottomLeft) {
		return;
	}
	
	// Calculate dimensions
	const left = topLeft.x;
	const top = topLeft.y;
	const width = Math.abs(topRight.x - topLeft.x);
	const height = Math.abs(bottomLeft.y - topLeft.y);
	
	// Update position
	rect.style.left = `${left}px`;
	rect.style.top = `${top}px`;
	rect.style.width = `${width}px`;
	rect.style.height = `${height}px`;
}

/**
 * Cancel drawing mode and clean up
 */
function cancelDrawingMode() {
	// Remove event listeners
	document.removeEventListener("click", handleDrawingClick, true);
	document.removeEventListener("mousemove", handleDrawingMouseMove, true);
	document.removeEventListener("keydown", handleDrawingEscape, true);
	
	// Remove preview rectangle if it exists
	if (drawingState && drawingState.previewRect) {
		drawingState.previewRect.remove();
	}
	
	// Reset cursor
	document.body.style.cursor = "";
	const cursorStyle = document.getElementById("flownotes-drawing-cursor");
	if (cursorStyle) {
		cursorStyle.remove();
	}
	
	// Clear state
	drawingState = null;
	
	console.log("[FlowNotes] Drawing mode cancelled");
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

// Start continuous update loop for displayed notes (canvas-relative positioning + zoom scaling)
startDisplayedNotesUpdateLoop();


