/* eslint-disable no-undef */
// Background service worker for FlowNotes
// Session piggyback mode: detect Salesforce session cookie and proxy API calls

async function findSalesforceTab() {
	const tabs = await chrome.tabs.query({
		url: [
			"https://*.salesforce.com/*",
			"https://*.force.com/*",
			"https://*.visualforce.com/*",
			"https://*.salesforce-sites.com/*"
		]
	});
	// Prefer active tab in current window
	const activeInWindow = tabs.find(t => t.active && !t.url.includes("/setup/one/one.app"));
	return activeInWindow || tabs[0] || null;
}

async function ensureContentScript(tabId) {
	try {
		const pong = await chrome.tabs.sendMessage(tabId, { type: "ping" });
		if (pong?.ok) return true;
	} catch {
		// will try injection
	}
	try {
		await chrome.scripting.executeScript({
			target: { tabId },
			files: ["src/content.js"]
		});
		const pong2 = await chrome.tabs.sendMessage(tabId, { type: "ping" });
		return !!pong2?.ok;
	} catch {
		return false;
	}
}

async function getAuthState() {
	const { auth } = await chrome.storage.local.get({ auth: null });
	return auth;
}

async function proxyViaContent(tabId, request) {
	const response = await chrome.tabs.sendMessage(tabId, { type: "proxy", request });
	if (!response?.ok) {
		throw new Error(response?.error || "Proxy failed");
	}
	return response.result;
}

function deriveInstanceOriginFromHost(host) {
	// Convert *.lightning.force.com → *.my.salesforce.com
	if (host.endsWith(".lightning.force.com")) {
		const prefix = host.replace(".lightning.force.com", "");
		return `https://${prefix}.my.salesforce.com`;
	}
	// Experience Cloud or Visualforce often still use the same instance for API
	if (host.endsWith(".force.com") || host.endsWith(".visualforce.com") || host.endsWith(".salesforce-sites.com")) {
		// Heuristic: attempt subdomain before first dot as mydomain
		const parts = host.split(".");
		if (parts.length >= 3) {
			const myDomain = parts[0];
			return `https://${myDomain}.my.salesforce.com`;
		}
	}
	// Already a salesforce.com host
	return `https://${host}`;
}

async function tryGetSidForUrls(urls) {
	for (const u of urls) {
		try {
			const cookie = await chrome.cookies.get({ url: u, name: "sid" });
			if (cookie?.value) return { sid: cookie.value, url: u };
		} catch {
			// continue
		}
	}
	return { sid: null, url: null };
}

async function fetchWithSidJson(instanceOrigin, sid, path) {
	const res = await fetch(`${instanceOrigin}${path}`, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${sid}`,
			Accept: "application/json"
		}
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`HTTP ${res.status}: ${text}`);
	}
	return await res.json();
}

async function detectSessionAndUser() {
	const tab = await findSalesforceTab();
	if (!tab || !tab.url) return { connected: false, reason: "No Salesforce tab" };
	const url = new URL(tab.url);
	const currentOrigin = `${url.protocol}//${url.host}`;
	const instanceOrigin = deriveInstanceOriginFromHost(url.host);
	try {
		// 1) Prefer cookie-based API call from background with Authorization header
		const cookieCandidates = [
			instanceOrigin,
			currentOrigin,
			"https://login.salesforce.com"
		];
		const { sid } = await tryGetSidForUrls(cookieCandidates);
		if (sid) {
			const user = await fetchWithSidJson(instanceOrigin, sid, "/services/data/v60.0/chatter/users/me");
			const auth = { instanceUrl: instanceOrigin, userId: user.id };
			await chrome.storage.local.set({ auth });
			return { connected: true, auth, user, tabId: tab.id, baseUrl: instanceOrigin };
		}
		// 2) Fallback: use content script same-origin fetch (if server accepts cookie auth)
		const ready = await ensureContentScript(tab.id);
		if (!ready) throw new Error("Content script not injected");
		const result = await proxyViaContent(tab.id, { path: "/services/data/v60.0/chatter/users/me", method: "GET" });
		if (!result.ok) throw new Error(`User fetch failed: ${result.status}`);
		const user = JSON.parse(result.body);
		const auth = { instanceUrl: currentOrigin, userId: user.id };
		await chrome.storage.local.set({ auth });
		return { connected: true, auth, user, tabId: tab.id, baseUrl: currentOrigin };
	} catch (e) {
		return { connected: false, reason: e?.message || "Fetch failed" };
	}
}

chrome.runtime.onInstalled.addListener(async () => {
	// no-op for content-script mode
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	(async () => {
		try {
			if (message?.type === "getStatus") {
				const status = await detectSessionAndUser();
				sendResponse({ ok: true, ...status });
				return;
			}
			if (message?.type === "proxy") {
				// { path, method, body }
				const tab = await findSalesforceTab();
				if (!tab?.id) throw new Error("No Salesforce tab");
				const url = new URL(tab.url);
				const currentOrigin = `${url.protocol}//${url.host}`;
				const instanceOrigin = deriveInstanceOriginFromHost(url.host);
				// Try instance-origin fetch with SID first
				try {
					const { sid } = await tryGetSidForUrls([instanceOrigin, currentOrigin, "https://login.salesforce.com"]);
					if (sid) {
						const headers = new Headers();
						headers.set("Authorization", `Bearer ${sid}`);
						headers.set("Accept", "application/json");
						if (message.body) headers.set("Content-Type", "application/json");
						const resp = await fetch(`${instanceOrigin}${message.path}`, {
							method: message.method || "GET",
							headers,
							body: message.body ? JSON.stringify(message.body) : undefined
						});
						const bodyText = await resp.text();
						sendResponse({ ok: resp.ok, status: resp.status, body: bodyText, contentType: resp.headers.get("content-type") });
						return;
					}
				} catch {
					// fall through to content-script proxy
				}
				// Fallback to same-origin content script proxy
				const ready = await ensureContentScript(tab.id);
				if (!ready) throw new Error("Content script not injected");
				const result = await proxyViaContent(tab.id, { path: message.path, method: message.method, body: message.body });
				sendResponse({ ok: result.ok, status: result.status, body: result.body, contentType: result.contentType });
				return;
			}
			if (message?.type === "logout") {
				// Clear cached auth only; does not sign out Salesforce
				await chrome.storage.local.remove(["auth"]);
				sendResponse({ ok: true });
				return;
			}
			sendResponse({ ok: false, error: "Unknown message type" });
		} catch (error) {
			sendResponse({ ok: false, error: error?.message || String(error) });
		}
	})();
	// Required to keep the message channel open for async response
	return true;
});


