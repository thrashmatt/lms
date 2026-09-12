export function isSidebarItemEnabled(settings, key) {
	return Boolean(Number(settings?.[key]))
}
