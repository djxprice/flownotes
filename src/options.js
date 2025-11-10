/* eslint-disable no-undef */

const form = document.getElementById("form");

async function load() {
	const { loginDomain } = await chrome.storage.sync.get({ loginDomain: "login" });
	const input = form.elements.namedItem("loginDomain");
	const radios = form.querySelectorAll('input[name="loginDomain"]');
	radios.forEach(r => { r.checked = r.value === loginDomain; });
	if (input) input.value = loginDomain;
}

form.addEventListener("submit", async (e) => {
	e.preventDefault();
	const formData = new FormData(form);
	const loginDomain = formData.get("loginDomain") || "login";
	await chrome.storage.sync.set({ loginDomain });
	alert("Saved.");
});

load();


