import type {
	ContentWarning,
	FacetEnvironment,
	FacetFocus,
	FacetMedium,
	FacetMovement,
	FacetPresentation,
	FacetProduction,
	FacetType
} from './types';

export const FACET_TYPE_OPTIONS: FacetType[] = [
	'fiction',
	'documentary',
	'session',
	'event',
	'tutorial',
	'music-video',
	'talk'
];

export const FACET_TYPE_LABELS: Record<FacetType, string> = {
	fiction: 'Fiction',
	documentary: 'Documentary',
	session: 'Session',
	event: 'Event',
	tutorial: 'Tutorial',
	'music-video': 'Music Video',
	talk: 'Talk'
};

export const FACET_TYPE_DESCRIPTIONS: Record<FacetType, string> = {
	fiction: 'Narrative-driven parkour film with storyline',
	documentary: 'Real stories and insights into parkour culture',
	session: 'Team edit or session footage from training',
	event: 'Jam, competition, or organized gathering',
	tutorial: 'Educational content teaching parkour techniques',
	'music-video': 'Music-driven edit with a track-focused structure',
	talk: 'Talk or presentation format with ideas, interviews, or lectures'
};

export const FACET_FOCUS_OPTIONS: FacetFocus[] = [
	'showreel',
	'competition',
	'jam',
	'conceptual',
	'gear',
	'awards'
];

export const FACET_FOCUS_LABELS: Record<FacetFocus, string> = {
	showreel: 'Showreel',
	competition: 'Competition',
	jam: 'Jam',
	conceptual: 'Conceptual',
	gear: 'Gear',
	awards: 'Awards'
};

export const FACET_FOCUS_DESCRIPTIONS: Record<FacetFocus, string> = {
	showreel: 'Best-of reel, athlete profile, or year compilation',
	competition: 'Contest, battle, speed run, or style competition',
	jam: 'Jam or community gathering recap',
	conceptual: 'Reflective, mindset-driven, or personal journey focus',
	gear: 'Equipment, setup, or training tool focused',
	awards: 'Annual ceremony or awards format recognizing others\' work'
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

export const FACET_PRODUCTION_OPTIONS: FacetProduction[] = [
	'raw',
	'casual',
	'produced',
	'premium'
];

export const FACET_PRODUCTION_LABELS: Record<FacetProduction, string> = {
	raw: 'Raw',
	casual: 'Casual',
	produced: 'Produced',
	premium: 'Premium'
};

export const FACET_PRODUCTION_DESCRIPTIONS: Record<FacetProduction, string> = {
	raw: 'Minimally edited — phone clips, rough capture, real sound, little polish',
	casual: 'Creator-made with light editing — vlog-ish or lightly structured, clear intent but not highly polished',
	produced: 'Clearly crafted edit or film with deliberate shooting, editing, and post-production',
	premium: 'Standout high-end production with exceptional cinematography, editing, sound, and design'
};

export const FACET_PRESENTATION_OPTIONS: FacetPresentation[] = [
	'standard',
	'pov',
	'vlog',
	'top-down',
	'stylized'
];

export const FACET_PRESENTATION_LABELS: Record<FacetPresentation, string> = {
	standard: 'Standard',
	pov: 'POV',
	vlog: 'Vlog',
	'top-down': 'Top-Down',
	stylized: 'Stylized'
};

export const FACET_PRESENTATION_DESCRIPTIONS: Record<FacetPresentation, string> = {
	standard: 'Traditional edited format — neither POV-led nor vlog-led',
	pov: 'First-person or tight follow-cam perspective is central to the experience',
	vlog: 'Personality-led, diary or travel format with direct-to-camera or creator framing',
	'top-down': 'Bird\'s-eye drone or overhead angle used as a primary visual style',
	stylized: 'Unconventional format concept — gameplay imitation, surreal framing, or intentional visual gimmick'
};

export const FACET_MEDIUM_OPTIONS: FacetMedium[] = [
	'live-action',
	'animation',
	'mixed-media'
];

export const FACET_MEDIUM_LABELS: Record<FacetMedium, string> = {
	'live-action': 'Live Action',
	animation: 'Animation',
	'mixed-media': 'Mixed Media'
};

export const FACET_MEDIUM_DESCRIPTIONS: Record<FacetMedium, string> = {
	'live-action': 'Standard filmed real-world footage',
	animation: 'Animated or illustrated content — traditional, 3D, or digital',
	'mixed-media': 'Combination of live footage and animated or graphical elements'
};

export const CONTENT_WARNING_OPTIONS: ContentWarning[] = [
	'violence',
	'substances',
	'strong-language',
	'sexual-content',
	'intense-themes'
];

export const CONTENT_WARNING_LABELS: Record<ContentWarning, string> = {
	violence: 'Violence',
	substances: 'Substances',
	'strong-language': 'Strong Language',
	'sexual-content': 'Sexual Content',
	'intense-themes': 'Intense Themes'
};

export const CONTENT_WARNING_DESCRIPTIONS: Record<ContentWarning, string> = {
	violence: 'Contains depictions of violence or injury',
	substances: 'Contains references to alcohol, drugs, or other substances',
	'strong-language': 'Contains explicit or strong language',
	'sexual-content': 'Contains sexual or adult content',
	'intense-themes': 'Contains emotionally intense or distressing themes'
};

export type ManualFacetKey =
	| 'type'
	| 'focus'
	| 'movement'
	| 'environment'
	| 'production'
	| 'presentation'
	| 'medium';

export type ManualFacetValueByKey = {
	type: FacetType;
	focus: FacetFocus;
	movement: FacetMovement;
	environment: FacetEnvironment;
	production: FacetProduction;
	presentation: FacetPresentation;
	medium: FacetMedium;
};

type ManualFacetDbColumn =
	| 'facet_type'
	| 'facet_focus'
	| 'facet_movement'
	| 'facet_environment'
	| 'facet_production'
	| 'facet_presentation'
	| 'facet_medium';

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
	'focus',
	'movement',
	'environment',
	'production',
	'presentation',
	'medium'
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
	focus: {
		key: 'focus',
		navLabel: 'Focus',
		singularLabel: 'focus facet',
		pluralLabel: 'focus facets',
		dbColumn: 'facet_focus',
		mode: 'single',
		options: FACET_FOCUS_OPTIONS,
		labels: FACET_FOCUS_LABELS,
		descriptions: FACET_FOCUS_DESCRIPTIONS
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
	production: {
		key: 'production',
		navLabel: 'Production',
		singularLabel: 'production facet',
		pluralLabel: 'production facets',
		dbColumn: 'facet_production',
		mode: 'single',
		options: FACET_PRODUCTION_OPTIONS,
		labels: FACET_PRODUCTION_LABELS,
		descriptions: FACET_PRODUCTION_DESCRIPTIONS
	},
	presentation: {
		key: 'presentation',
		navLabel: 'Presentation',
		singularLabel: 'presentation facet',
		pluralLabel: 'presentation facets',
		dbColumn: 'facet_presentation',
		mode: 'single',
		options: FACET_PRESENTATION_OPTIONS,
		labels: FACET_PRESENTATION_LABELS,
		descriptions: FACET_PRESENTATION_DESCRIPTIONS
	},
	medium: {
		key: 'medium',
		navLabel: 'Medium',
		singularLabel: 'medium facet',
		pluralLabel: 'medium facets',
		dbColumn: 'facet_medium',
		mode: 'single',
		options: FACET_MEDIUM_OPTIONS,
		labels: FACET_MEDIUM_LABELS,
		descriptions: FACET_MEDIUM_DESCRIPTIONS
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

