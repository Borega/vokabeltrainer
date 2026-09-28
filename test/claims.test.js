import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeEntries, userFromClaims } from '../src/claims.js';

const config = {
  oidc: { groupsClaim: 'groups', rolesClaim: 'roles' },
  teacherRoles: ['role_teacher', 'lehrer'],
  teacherGroups: ['lehrer'],
};

test('Gruppen als Strings, Objekte oder Map', () => {
  assert.deepEqual(normalizeEntries(['klasse.7b']), [{ id: 'klasse.7b', name: 'klasse.7b' }]);
  assert.deepEqual(normalizeEntries([{ act: 'klasse.7b', name: 'Klasse 7b' }]), [{ id: 'klasse.7b', name: 'Klasse 7b' }]);
  assert.deepEqual(normalizeEntries([{ id: 'x', displayName: 'X' }]), [{ id: 'x', name: 'X' }]);
  assert.deepEqual(normalizeEntries({ 'klasse.7b': 'Klasse 7b' }), [{ id: 'klasse.7b', name: 'Klasse 7b' }]);
  assert.deepEqual(normalizeEntries('a b'), [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }]);
  assert.deepEqual(normalizeEntries(undefined), []);
});

test('Duplikate werden entfernt', () => {
  assert.equal(normalizeEntries(['a', 'a', { id: 'a' }]).length, 1);
});

test('Lehrkraft über Rolle oder Gruppe', () => {
  assert.equal(userFromClaims({ sub: '1', roles: ['ROLE_TEACHER'] }, config).isTeacher, true);
  assert.equal(userFromClaims({ sub: '1', roles: [{ id: 'ROLE_STUDENT', name: 'Lehrer' }] }, config).isTeacher, true);
  assert.equal(userFromClaims({ sub: '1', groups: [{ act: 'lehrer', name: 'Lehrer' }] }, config).isTeacher, true);
  assert.equal(userFromClaims({ sub: '1', groups: ['klasse.7b'] }, config).isTeacher, false);
});

test('IServ-Format: iserv:groups als Map, iserv:roles mit id/displayName', () => {
  // Struktur wie von IServ geliefert, Inhalte ausgedacht
  const iservClaims = {
    sub: '00000000-0000-4000-8000-000000000001',
    name: 'Test Lehrkraft',
    'iserv:groups': {
      AAAAAAAAAAAAAAAAAAAAA1: { id: 'AAAAAAAAAAAAAAAAAAAAA1', act: 'klasse-5b', name: 'Klasse 5b' },
      AAAAAAAAAAAAAAAAAAAAA2: { id: 'AAAAAAAAAAAAAAAAAAAAA2', act: 'kollegium', name: 'Kollegium' },
    },
    'iserv:roles': [
      { uuid: '00000000-0000-4000-8000-00000000000a', id: 'ROLE_TEACHER', displayName: 'Lehrer' },
      { uuid: '00000000-0000-4000-8000-00000000000b', id: 'ROLE_CUSTOM', displayName: 'Eigene Rolle' },
    ],
  };
  // mit IServ-Standard und auch mit veralteter Einstellung "groups"/"roles" (Fallback)
  for (const oidc of [{ groupsClaim: 'iserv:groups', rolesClaim: 'iserv:roles' }, { groupsClaim: 'groups', rolesClaim: 'roles' }]) {
    const user = userFromClaims(iservClaims, { ...config, oidc });
    assert.equal(user.isTeacher, true);
    assert.deepEqual(user.groups, [
      { id: 'klasse-5b', name: 'Klasse 5b' },
      { id: 'kollegium', name: 'Kollegium' },
    ]);
  }
});

test('Name aus Vor- und Nachname', () => {
  assert.equal(userFromClaims({ sub: '1', given_name: 'Max', family_name: 'Muster' }, config).name, 'Max Muster');
  assert.equal(userFromClaims({ sub: '1', name: 'Max M.' }, config).name, 'Max M.');
});
