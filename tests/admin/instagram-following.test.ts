import assert from 'node:assert/strict';
import test from 'node:test';
import {
	buildInstagramResearchContext,
	mergeInstagramAccounts,
	parseInstagramFollowing,
	suggestInstagramAccounts,
	type InstagramCredit
} from '../../src/lib/instagram/following';

const people = [
	{ name: 'José Smith', slug: 'jose-smith' },
	{ name: 'Sam Jones', slug: 'sam-jones' },
	{ name: 'Ann Park', slug: 'ann-park' }
];
const credits: InstagramCredit[] = [
	{
		slug: 'rooftops',
		title: 'Rooftops',
		type: 'movie',
		creators: ['Linked Creator'],
		starring: ['Jose Smith', 'Sam Jones', 'Ann Park']
	}
];
const profiles = [
	{ slug: 'linked-creator', name: 'Linked Creator', instagram_handles: ['creatorpk'] }
];

test('parses following exports with value entries and newer _u profile links', () => {
	const result = parseInstagramFollowing(
		JSON.stringify({
			relationships_following: [
				{
					title: 'José Smith',
					string_list_data: [{ value: 'Jose.Smith', href: 'https://www.instagram.com/jose.smith/' }]
				},
				{
					title: '',
					string_list_data: [{ href: 'https://www.instagram.com/_u/samjones/?igsh=example' }]
				}
			]
		})
	);
	assert.deepEqual(result, [
		{ handle: 'jose.smith', names: [] },
		{ handle: 'samjones', names: [] }
	]);
});

test('deduplicates files while preserving observed display names', () => {
	const first = parseInstagramFollowing(
		'\uFEFF' + JSON.stringify([{ username: 'SAMJONES', full_name: 'Sam Jones' }])
	);
	const second = parseInstagramFollowing(
		JSON.stringify([{ username: 'samjones', display_name: 'Samuel Jones' }])
	);
	assert.deepEqual(mergeInstagramAccounts([first, second]), [
		{ handle: 'samjones', names: ['Sam Jones', 'Samuel Jones'] }
	]);
});

test('rejects malformed, unrelated or empty exports and ignores invalid accounts', () => {
	for (const input of [
		'not JSON',
		JSON.stringify({ messages: [{ username: 'samjones' }] }),
		JSON.stringify({ relationships_following: [] })
	]) {
		assert.throws(() => parseInstagramFollowing(input));
	}
	const result = parseInstagramFollowing(
		JSON.stringify([
			{ string_list_data: [{ href: 'https://example.com/samjones' }] },
			{ string_list_data: [{ href: 'https://www.instagram.com/p/abcdef/' }] },
			{ username: 'invalid handle' },
			{ username: 'valid_handle' }
		])
	);
	assert.deepEqual(result, [{ handle: 'valid_handle', names: [] }]);
});

test('suggests only imported accounts, uses credit variants, and excludes saved handles', () => {
	const accounts = [
		{ handle: 'jose.smith', names: [] },
		{ handle: 'samjonespk', names: [] },
		{ handle: 'creatorpk', names: ['Ann Park'] },
		{ handle: 'sam', names: [] }
	];
	const result = suggestInstagramAccounts(people, accounts, profiles, credits);
	assert.deepEqual(
		result['jose-smith'].map((match) => [match.handle, match.strength]),
		[['jose.smith', 'name']]
	);
	assert.deepEqual(
		result['sam-jones'].map((match) => [match.handle, match.strength]),
		[['samjonespk', 'possible']]
	);
	assert.deepEqual(result['ann-park'], []);
	assert.ok(
		Object.values(result)
			.flat()
			.every((match) => accounts.some((account) => account.handle === match.handle))
	);
});

test('display names rank above username resemblance and initials remain possible matches', () => {
	const result = suggestInstagramAccounts(
		[people[1]],
		[
			{ handle: 'samjonespk', names: [] },
			{ handle: 'sjones', names: [] },
			{ handle: 'samjones', names: [] },
			{ handle: 'roof_runner', names: ['Sám Jones'] }
		],
		[],
		[]
	);
	assert.deepEqual(
		result['sam-jones'].map((match) => match.handle),
		['roof_runner', 'samjones', 'samjonespk', 'sjones']
	);
	assert.equal(result['sam-jones'].at(-1)?.strength, 'possible');
});

test('shared credits provide research context without fabricating matches or mutual friendships', () => {
	const accounts = [
		{ handle: 'creatorpk', names: [] },
		{ handle: 'unrelated_account', names: [] }
	];
	assert.deepEqual(suggestInstagramAccounts(people, accounts, profiles, credits)['sam-jones'], []);
	const context = buildInstagramResearchContext(credits, profiles, accounts);
	assert.deepEqual(context['sam-jones'].films, [{ title: 'Rooftops', url: '/movie/rooftops' }]);
	assert.deepEqual(context['sam-jones'].collaborators, [
		{
			slug: 'linked-creator',
			name: 'Linked Creator',
			handles: ['creatorpk'],
			followed: true
		}
	]);
	assert.deepEqual(context['linked-creator'].collaborators, []);
});

test('research prioritizes known collaborators in the export and deduplicates repeated credits', () => {
	const other = { slug: 'other-creator', name: 'Other Creator', instagram_handles: ['otherpk'] };
	const items = [
		...credits,
		{
			...credits[0],
			slug: 'series',
			type: 'series',
			creators: ['Other Creator', 'Linked Creator', 'Linked Creator']
		}
	];
	const context = buildInstagramResearchContext(
		items,
		[other, ...profiles],
		[{ handle: 'otherpk', names: [] }]
	);
	assert.deepEqual(
		context['sam-jones'].collaborators.map((person) => person.slug),
		['other-creator', 'linked-creator']
	);
	assert.ok(context['sam-jones'].films.some((film) => film.url === '/series/series'));
});

test('export limit rejects oversized account pools and prototype-like names remain valid context keys', () => {
	assert.throws(
		() =>
			parseInstagramFollowing(
				JSON.stringify(Array.from({ length: 20_001 }, (_, i) => ({ username: `account${i}` })))
			),
		/20,000/
	);
	const context = buildInstagramResearchContext(
		[{ ...credits[0], starring: ['Constructor'] }],
		profiles,
		[]
	);
	const personSlug: string = 'constructor';
	assert.equal(context[personSlug].films[0].title, 'Rooftops');
});
