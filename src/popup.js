/* eslint-disable no-undef */

const statusEl = document.getElementById("status");
const checkBtn = document.getElementById("checkBtn");
const logoutBtn = document.getElementById("logoutBtn");

function renderDisconnected() {
	statusEl.innerHTML = `<p class="dim">No active Salesforce session detected. Open a Salesforce tab and sign in, then click “Check Salesforce Session”.</p>`;
	checkBtn.hidden = false;
	logoutBtn.hidden = true;
}

function renderConnected(user, auth) {
	const name = user?.name || user?.preferred_username || "Authenticated";
	const orgDomain = new URL(auth.instanceUrl).host;
	statusEl.innerHTML = `
		<div class="user">
			<div class="label">User</div><div>${name}</div>
			<div class="label">Org</div><div>${orgDomain}</div>
		</div>
	`;
	checkBtn.hidden = false;
	logoutBtn.hidden = false;
}

async function refreshStatus() {
	statusEl.innerHTML = `<p class="dim">Checking connection…</p>`;
	const res = await chrome.runtime.sendMessage({ type: "getStatus" });
	if (res?.ok && res.connected && res.auth && res.user) {
		renderConnected(res.user, res.auth);
	} else {
		renderDisconnected();
	}
}

checkBtn.addEventListener("click", async () => {
	checkBtn.disabled = true;
	checkBtn.textContent = "Checking…";
	try {
		await refreshStatus();
	} catch (e) {
		renderDisconnected();
	} finally {
		checkBtn.disabled = false;
		checkBtn.textContent = "Check Salesforce Session";
	}
});

logoutBtn.addEventListener("click", async () => {
	await chrome.runtime.sendMessage({ type: "logout" });
	renderDisconnected();
});

refreshStatus();


