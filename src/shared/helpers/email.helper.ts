function escapeEmailDisplayName(displayName: string): string {
    return displayName.replace(/[\\"]/g, '\\$&');
}

export function formatEmailAddress(address: string, displayName?: string): string {
    const normalizedDisplayName = (displayName || '').trim();
    if (!normalizedDisplayName) return address;
    return `"${escapeEmailDisplayName(normalizedDisplayName)}" <${address}>`;
}
