#!/usr/bin/env node
/**
 * Offline test for Google Form prefill helpers.
 * Uses an embedded FB_PUBLIC_LOAD_DATA_ sample (no network).
 *
 * Usage: node apps/api/scripts/test-enrollment.mjs
 * Requires: pnpm --filter api build (imports from dist/)
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logicPath = join(
  __dirname,
  '..',
  'dist',
  'modules',
  'enrollment',
  'enrollment-form.logic.js',
);

if (!existsSync(logicPath)) {
  console.error(
    'FAIL: dist/modules/enrollment/enrollment-form.logic.js missing. Run: pnpm --filter api build',
  );
  process.exit(1);
}

const require = createRequire(import.meta.url);
const {
  parseFormFields,
  buildPrefilledUrl,
  splitFullName,
  extractEmail,
  extractPhone,
  extractCedula,
  matchAudienceOption,
} = require(logicPath);

const FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScEXAMPLEFORMID000000000000000000/viewform';

/**
 * Minimal Google Form payload shaped like FB_PUBLIC_LOAD_DATA_.
 * Types: 0 short text, 2 multiple choice, 3 dropdown.
 */
const SAMPLE_DATA = [
  null,
  [
    null,
    [
      [null, 'Nombres', null, 0, [[111111, null, true]]],
      [null, 'Apellidos', null, 0, [[222222, null, true]]],
      [null, 'Nombre completo', null, 0, [[333333, null, true]]],
      [null, 'Cédula', null, 0, [[444444, null, true]]],
      [null, 'Correo electrónico', null, 0, [[555555, null, true]]],
      [null, 'Teléfono / Celular', null, 0, [[666666, null, true]]],
      [
        null,
        'Tipo de participante',
        null,
        3,
        [
          [
            777777,
            [
              ['Estudiante UTA', null, null, null, 0],
              ['Graduados, Docentes y Administrativos UTA', null, null, null, 0],
              ['Público en general', null, null, null, 0],
            ],
            null,
            null,
            null,
            null,
            null,
            null,
          ],
        ],
      ],
      [
        null,
        'Curso',
        null,
        3,
        [
          [
            888888,
            [
              ['Fundamentos de Python 1', null, null, null, 0],
              ['CCNA: Introducción a las redes', null, null, null, 0],
            ],
            null,
            null,
            null,
            null,
            null,
            null,
          ],
        ],
      ],
    ],
  ],
];

const SAMPLE_HTML = `<!DOCTYPE html><html><head></head><body>
<script>var FB_PUBLIC_LOAD_DATA_ = ${JSON.stringify(SAMPLE_DATA)};</script>
</body></html>`;

let failed = 0;
function check(name, cond, detail = '') {
  if (cond) {
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const fields = parseFormFields(SAMPLE_HTML);
check('parseFormFields count', fields.length === 8, `got ${fields.length}`);
check(
  'parseFormFields labels',
  fields[0]?.label === 'Nombres' && fields[3]?.entryId === '444444',
);

const split = splitFullName('María José Pérez López');
check(
  'splitFullName',
  split.nombres === 'María José' &&
    split.apellidos === 'Pérez López' &&
    split.completo === 'María José Pérez López',
  JSON.stringify(split),
);

check(
  'extractEmail',
  extractEmail('soy maria@uta.edu.ec y mi celu 0991234567') ===
    'maria@uta.edu.ec',
);
check(
  'extractPhone',
  /0991234567/.test(
    extractPhone('soy maria@uta.edu.ec y mi celu 0991234567') || '',
  ),
);
check('extractCedula', extractCedula('mi cédula es 1804567890') === '1804567890');

const opt = matchAudienceOption(
  [
    'Estudiante UTA',
    'Graduados, Docentes y Administrativos UTA',
    'Público en general',
  ],
  'estudiante de la UTA',
);
check('matchAudienceOption', opt === 'Estudiante UTA', `got ${opt}`);

const profile = {
  name: 'María José Pérez López',
  email: 'maria@uta.edu.ec',
  phone: '0991234567',
  id_number: '1804567890',
  audience: 'estudiante UTA',
  contact: 'maria@uta.edu.ec 0991234567',
};

const url = buildPrefilledUrl(FORM_URL, fields, profile, {
  courseName: 'Fundamentos de Python 1',
});

check('buildPrefilledUrl starts with viewform', url.startsWith(FORM_URL));
check('buildPrefilledUrl has usp=pp_url', url.includes('usp=pp_url'));
check(
  'buildPrefilledUrl encodes nombres',
  url.includes('entry.111111=') &&
    decodeURIComponent(url).includes('María José'),
);
check(
  'buildPrefilledUrl apellidos',
  decodeURIComponent(url).includes('entry.222222=Pérez López'),
);
check(
  'buildPrefilledUrl nombre completo',
  decodeURIComponent(url).includes('entry.333333=María José Pérez López'),
);
check('buildPrefilledUrl cedula', url.includes('entry.444444=1804567890'));
check(
  'buildPrefilledUrl email',
  url.includes('entry.555555=') &&
    decodeURIComponent(url).includes('maria@uta.edu.ec'),
);
check('buildPrefilledUrl phone', url.includes('entry.666666=0991234567'));
check(
  'buildPrefilledUrl audience option',
  decodeURIComponent(url).includes('entry.777777=Estudiante UTA'),
);
check(
  'buildPrefilledUrl course option',
  decodeURIComponent(url).includes('entry.888888=Fundamentos de Python 1'),
);

const bare = buildPrefilledUrl(FORM_URL, [], profile, {});
check(
  'buildPrefilledUrl empty fields → original',
  bare === FORM_URL,
  bare,
);

const fromContact = buildPrefilledUrl(
  FORM_URL,
  fields,
  { name: 'Ana Ruiz', contact: 'ana@mail.com / 0987654321' },
  {},
);
check(
  'buildPrefilledUrl pulls email/phone from contact',
  decodeURIComponent(fromContact).includes('ana@mail.com') &&
    fromContact.includes('0987654321'),
);

console.log(failed === 0 ? '\nAll PASS' : `\n${failed} FAIL`);
process.exit(failed === 0 ? 0 : 1);
