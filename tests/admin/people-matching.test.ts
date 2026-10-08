import assert from 'node:assert/strict';
import test from 'node:test';
import {
	createPersonMatchIndex,
	findPersonMatchCandidates,
	type KnownPerson
} from '../../src/lib/server/person-profiles';
import { slugify } from '../../src/lib/tv/slug';

function people(names: string[]): KnownPerson[] {
	return names.map((name, index) => ({
		name,
		slug: `${slugify(name)}-${index}`,
		roles: { creator: index % 2 === 0, athlete: index % 3 === 0 }
	}));
}

function assertEquivalent(names: string[], inputs = names) {
	const known = people(names);
	const index = createPersonMatchIndex(known);
	for (const input of inputs) {
		for (const limit of [1, 5, 6, 20]) {
			const excludeSlug = known.find((person) => person.name === input)?.slug ?? '';
			assert.deepEqual(
				index.findCandidates(input, excludeSlug, limit),
				findPersonMatchCandidates(
					input,
					known.filter((p) => p.slug !== excludeSlug),
					limit
				),
				`Different candidates for ${input} (limit ${limit})`
			);
		}
	}
}

test('indexed matching preserves scores, ordering, roles and limits for name variants', () => {
	assertEquivalent(
		[
			'José Smith',
			'Jose Smith',
			'J. Smith',
			'Joe Smith',
			'Jo Smith',
			'John Smith',
			'John Smith Smith',
			'Smith John',
			'Jon Smith',
			'John Smyth',
			'John',
			'Smith',
			'John Smith Jr',
			'Joan Smith',
			'Max & Sam',
			'Max and Sam',
			'Max Sam',
			' Team  Storror ',
			'Team Storror',
			'Team Storm',
			'Storror',
			'Storrors',
			'Jan van der Meer',
			'Jan van de Meer',
			'Jan Meer',
			'',
			'---',
			'李',
			'Alexander Alexandra',
			'Alexandra Alexander',
			'Alexander Alexander'
		],
		[
			'José Smith',
			'John Smith',
			'John',
			'Storror',
			'Max & Sam',
			'Jan van der Meer',
			'',
			'---',
			'李',
			'Unknown'
		]
	);
});

test('indexed matching equals exhaustive matching across token combinations and typo names', () => {
	const tokens = ['ann', 'anna', 'an', 'annn', 'smith', 'smyth', 'van', 'and', 'lee', 'le'];
	const names = [...tokens];
	for (const first of tokens) for (const last of tokens) names.push(`${first} ${last}`);
	names.push('Ann van Lee', 'Ann Ann Lee', 'Anna van Lee', 'Ann Lee Lee', 'Lee Ann Ann');
	assertEquivalent(names);
});

test('empty index and excluded people do not produce candidates', () => {
	assert.deepEqual(createPersonMatchIndex([]).findCandidates('John Smith', ''), []);
	const [person] = people(['John Smith']);
	assert.deepEqual(createPersonMatchIndex([person]).findCandidates(person.name, person.slug), []);
});
