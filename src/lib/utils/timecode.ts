export function parseTimecodeToSeconds(input: string): number | null {
	const tc = (input || '').trim();
	if (!tc) return null;
	const parts = tc.split(':').map((p) => p.trim());
	if (parts.some((p) => !/^\d+$/.test(p))) return null;

	const nums = parts.map((p) => parseInt(p, 10));
	if (nums.length === 2) {
		const [m, s] = nums;
		return m * 60 + s;
	}
	if (nums.length === 3) {
		const [h, m, s] = nums;
		return h * 3600 + m * 60 + s;
	}
	return null;
}
