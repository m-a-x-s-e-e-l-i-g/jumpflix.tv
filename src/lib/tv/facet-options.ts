import type {
	FacetEnvironment,
	FacetFilmStyle,
	FacetMood,
	FacetMovement,
	FacetTheme,
	FacetType
} from './types';

export const FACET_TYPE_OPTIONS: FacetType[] = [
	'fiction',
	'documentary',
	'session',
	'event',
	'tutorial',
	'music-video',
	'talk',
	'vlog'
];

export const FACET_TYPE_LABELS: Record<FacetType, string> = {
	fiction: 'Fiction',
	documentary: 'Documentary',
	session: 'Session',
	event: 'Event',
	tutorial: 'Tutorial',
	'music-video': 'Music Video',
	talk: 'Talk',
	vlog: 'Vlog'
};

export const FACET_TYPE_DESCRIPTIONS: Record<FacetType, string> = {
	fiction: 'Narrative-driven parkour film with storyline',
	documentary: 'Real stories and insights into parkour culture',
	session: 'Team edit or session footage from training',
	event: 'Jam, competition, or organized gathering',
	tutorial: 'Educational content teaching parkour techniques',
	'music-video': 'Music-driven edit with a track-focused structure',
	talk: 'Talk or presentation format with ideas, interviews, or lectures',
	vlog: 'More personal, diary-like, or day-in-the-life parkour storytelling'
};

export const FACET_MOOD_OPTIONS: FacetMood[] = [
	'energetic',
	'chill',
	'gritty',
	'wholesome',
	'artistic'
];

export const FACET_MOOD_LABELS: Record<FacetMood, string> = {
	energetic: 'Energetic',
	chill: 'Chill',
	gritty: 'Gritty',
	wholesome: 'Wholesome',
	artistic: 'Artistic'
};

export const FACET_MOOD_DESCRIPTIONS: Record<FacetMood, string> = {
	energetic: 'Fast, high-energy pacing and an amped-up overall vibe',
	chill: 'Relaxed pacing with a calmer, easygoing atmosphere',
	gritty: 'Rough textures, hard edges, and a rawer emotional tone',
	wholesome: 'Warm community energy with a positive, uplifting feel',
	artistic: 'More expressive, poetic, or stylized in mood and presentation'
};

export const FACET_MOVEMENT_OPTIONS: FacetMovement[] = [
	'flow',
	'big-sends',
	'style',
	'descents',
	'technical',
	'speed',
	'oldskool',
	'contemporary'
];

export const FACET_MOVEMENT_LABELS: Record<FacetMovement, string> = {
	flow: 'Flow',
	'big-sends': 'Big Sends',
	style: 'Style',
	descents: 'Descents',
	technical: 'Technical',
	speed: 'Speed',
	oldskool: 'Oldskool',
	contemporary: 'Contemporary'
};

export const FACET_MOVEMENT_DESCRIPTIONS: Record<FacetMovement, string> = {
	flow: 'Continuous movement chains and smooth line-building',
	'big-sends': 'Commitment-heavy moves, gaps, and larger consequences',
	style: 'Distinct personal expression, shape, and movement flavor',
	descents: 'Drops, downclimbs, and vertical movement through space',
	technical: 'Precision, problem-solving, and dense movement detail',
	speed: 'Chase energy, fast lines, and momentum-focused movement',
	oldskool: 'Earlier-school movement language and classic parkour feel',
	contemporary: 'Modern movement vocabulary and newer stylistic cues'
};

export const FACET_ENVIRONMENT_OPTIONS: FacetEnvironment[] = [
	'street',
	'rooftops',
	'nature',
	'urbex',
	'gym'
];

export const FACET_ENVIRONMENT_LABELS: Record<FacetEnvironment, string> = {
	street: 'Street',
	rooftops: 'Rooftops',
	nature: 'Nature',
	urbex: 'Urbex',
	gym: 'Gym'
};

export const FACET_ENVIRONMENT_DESCRIPTIONS: Record<FacetEnvironment, string> = {
	street: 'Urban streets, plazas, rails, and public architecture',
	rooftops: 'Movement across roofs, ledges, and elevated city spaces',
	nature: 'Forests, rocks, trails, or natural terrain and obstacles',
	urbex: 'Abandoned, decayed, or industrial explored locations',
	gym: 'Indoor training spaces, setups, and gym-built lines'
};

export const FACET_FILM_STYLE_OPTIONS: FacetFilmStyle[] = [
	'cinematic',
	'street-cinematic',
	'skateish',
	'raw',
	'pov',
	'longtakes',
	'music-driven',
	'montage',
	'slowmo',
	'gonzo',
	'vintage',
	'minimalist',
	'experimental'
];

export const FACET_FILM_STYLE_LABELS: Record<FacetFilmStyle, string> = {
	cinematic: 'Cinematic',
	'street-cinematic': 'Street Cinematic',
	skateish: 'Skateish',
	raw: 'Raw',
	pov: 'POV',
	longtakes: 'Long Takes',
	'music-driven': 'Music Driven',
	montage: 'Montage',
	slowmo: 'Slow Motion',
	gonzo: 'Gonzo',
	vintage: 'Vintage',
	minimalist: 'Minimalist',
	experimental: 'Experimental'
};

export const FACET_FILM_STYLE_DESCRIPTIONS: Record<FacetFilmStyle, string> = {
	cinematic: 'Composed, polished visuals with a film-forward sensibility',
	'street-cinematic': 'Polished filmmaking that still keeps a street-level edge',
	skateish: 'Loose, kinetic camera language influenced by skate videos',
	raw: 'Direct, unvarnished footage with minimal polish',
	pov: 'First-person or head-mounted perspective drives the viewing experience',
	longtakes: 'Long uninterrupted shots emphasize continuity and movement',
	'music-driven': 'Editing rhythm and structure are led strongly by the soundtrack',
	montage: 'Built around sequences, cutdowns, and collaged moments',
	slowmo: 'Leans on slowed footage for detail, drama, or emphasis',
	gonzo: 'Messier, closer, and more embedded in the action',
	vintage: 'Older visual texture, archival feel, or retro treatment',
	minimalist: 'Restrained framing and editing with very little excess',
	experimental: 'Unusual structure, format, or visual decision-making'
};

export const FACET_THEME_OPTIONS: FacetTheme[] = [
	'journey',
	'team',
	'event',
	'competition',
	'educational',
	'travel',
	'creative',
	'showcase',
	'entertainment'
];

export const FACET_THEME_LABELS: Record<FacetTheme, string> = {
	journey: 'Journey',
	team: 'Team',
	event: 'Event',
	competition: 'Competition',
	educational: 'Educational',
	travel: 'Travel',
	creative: 'Creative',
	showcase: 'Showcase',
	entertainment: 'Entertainment'
};

export const FACET_THEME_DESCRIPTIONS: Record<FacetTheme, string> = {
	journey: 'Built around progression, reflection, or a larger path over time',
	team: 'Focused on a crew, collective, or shared group identity',
	event: 'Centered on a jam, gathering, screening, or organized moment',
	competition: 'Competition format, battles, rankings, or contest framing',
	educational: 'Trying to teach, explain, or break down ideas clearly',
	travel: 'Driven by places, trips, and movement through new locations',
	creative: 'Made primarily as an expressive or artistic piece',
	showcase: 'Designed to present standout lines, athletes, or a body of work',
	entertainment: 'Leans into fun, humor, spectacle, or broad watchability'
};

export type ManualFacetKey = 'type' | 'mood' | 'movement' | 'environment' | 'filmStyle' | 'theme';

export type ManualFacetValueByKey = {
	type: FacetType;
	mood: FacetMood;
	movement: FacetMovement;
	environment: FacetEnvironment;
	filmStyle: FacetFilmStyle;
	theme: FacetTheme;
};

type ManualFacetDbColumn =
	| 'facet_type'
	| 'facet_mood'
	| 'facet_movement'
	| 'facet_environment'
	| 'facet_film_style'
	| 'facet_theme';

export type ManualFacetConfig<K extends ManualFacetKey = ManualFacetKey> = {
	key: K;
	navLabel: string;
	singularLabel: string;
	pluralLabel: string;
	dbColumn: ManualFacetDbColumn;
	mode: 'single' | 'multiple';
	options: ManualFacetValueByKey[K][];
	labels: Record<ManualFacetValueByKey[K], string>;
	descriptions: Record<ManualFacetValueByKey[K], string>;
};

export const MANUAL_FACET_KEYS: ManualFacetKey[] = [
	'type',
	'mood',
	'movement',
	'environment',
	'filmStyle',
	'theme'
];

export const MANUAL_FACET_CONFIGS: {
	[K in ManualFacetKey]: ManualFacetConfig<K>;
} = {
	type: {
		key: 'type',
		navLabel: 'Type',
		singularLabel: 'type facet',
		pluralLabel: 'type facets',
		dbColumn: 'facet_type',
		mode: 'single',
		options: FACET_TYPE_OPTIONS,
		labels: FACET_TYPE_LABELS,
		descriptions: FACET_TYPE_DESCRIPTIONS
	},
	mood: {
		key: 'mood',
		navLabel: 'Mood',
		singularLabel: 'mood facet',
		pluralLabel: 'mood facets',
		dbColumn: 'facet_mood',
		mode: 'multiple',
		options: FACET_MOOD_OPTIONS,
		labels: FACET_MOOD_LABELS,
		descriptions: FACET_MOOD_DESCRIPTIONS
	},
	movement: {
		key: 'movement',
		navLabel: 'Movement',
		singularLabel: 'movement facet',
		pluralLabel: 'movement facets',
		dbColumn: 'facet_movement',
		mode: 'multiple',
		options: FACET_MOVEMENT_OPTIONS,
		labels: FACET_MOVEMENT_LABELS,
		descriptions: FACET_MOVEMENT_DESCRIPTIONS
	},
	environment: {
		key: 'environment',
		navLabel: 'Environment',
		singularLabel: 'environment facet',
		pluralLabel: 'environment facets',
		dbColumn: 'facet_environment',
		mode: 'single',
		options: FACET_ENVIRONMENT_OPTIONS,
		labels: FACET_ENVIRONMENT_LABELS,
		descriptions: FACET_ENVIRONMENT_DESCRIPTIONS
	},
	filmStyle: {
		key: 'filmStyle',
		navLabel: 'Film Style',
		singularLabel: 'film style facet',
		pluralLabel: 'film style facets',
		dbColumn: 'facet_film_style',
		mode: 'single',
		options: FACET_FILM_STYLE_OPTIONS,
		labels: FACET_FILM_STYLE_LABELS,
		descriptions: FACET_FILM_STYLE_DESCRIPTIONS
	},
	theme: {
		key: 'theme',
		navLabel: 'Theme',
		singularLabel: 'theme facet',
		pluralLabel: 'theme facets',
		dbColumn: 'facet_theme',
		mode: 'single',
		options: FACET_THEME_OPTIONS,
		labels: FACET_THEME_LABELS,
		descriptions: FACET_THEME_DESCRIPTIONS
	}
};

export function isManualFacetKey(value: string): value is ManualFacetKey {
	return MANUAL_FACET_KEYS.includes(value as ManualFacetKey);
}

export function isManualFacetValue<K extends ManualFacetKey>(
	facetKey: K,
	value: string
): value is ManualFacetValueByKey[K] {
	return MANUAL_FACET_CONFIGS[facetKey].options.includes(value as ManualFacetValueByKey[K]);
}

export function getManualFacetLabel(facetKey: ManualFacetKey, value: string): string {
	const labels = MANUAL_FACET_CONFIGS[facetKey].labels as Record<string, string>;
	return labels[value] ?? value;
}

export function getManualFacetDescription(facetKey: ManualFacetKey, value: string): string {
	const descriptions = MANUAL_FACET_CONFIGS[facetKey].descriptions as Record<string, string>;
	return descriptions[value] ?? '';
}