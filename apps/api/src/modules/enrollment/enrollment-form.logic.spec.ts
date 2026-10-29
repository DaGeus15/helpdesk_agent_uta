import { describe, expect, it } from 'vitest';
import {
  buildPrefilledUrl,
  parseFormFields,
  splitFullName,
} from './enrollment-form.logic';

const FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScEXAMPLEFORMID000000000000000000/viewform';

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

describe('enrollment-form.logic', () => {
  it('parseFormFields reads embedded Google Forms HTML', () => {
    const fields = parseFormFields(SAMPLE_HTML);
    expect(fields).toHaveLength(8);
    expect(fields[0]?.label).toBe('Nombres');
    expect(fields[3]?.entryId).toBe('444444');
  });

  it('parseFormFields returns [] on missing blob', () => {
    expect(parseFormFields('<html></html>')).toEqual([]);
  });

  it('splitFullName handles 4-part Ecuadorian names', () => {
    const split = splitFullName('María José Pérez López');
    expect(split.nombres).toBe('María José');
    expect(split.apellidos).toBe('Pérez López');
  });

  it('buildPrefilledUrl maps profile into entry params', () => {
    const fields = parseFormFields(SAMPLE_HTML);
    const url = buildPrefilledUrl(
      FORM_URL,
      fields,
      {
        name: 'María José Pérez López',
        email: 'maria@uta.edu.ec',
        phone: '0991234567',
        id_number: '1804567890',
        audience: 'estudiante UTA',
      },
      { courseName: 'Fundamentos de Python 1' },
    );
    expect(url).toContain('usp=pp_url');
    expect(decodeURIComponent(url)).toContain('entry.111111=María José');
    expect(decodeURIComponent(url)).toContain('entry.222222=Pérez López');
    expect(url).toContain('entry.444444=1804567890');
    expect(decodeURIComponent(url)).toContain('maria@uta.edu.ec');
    expect(decodeURIComponent(url)).toContain('entry.777777=Estudiante UTA');
    expect(decodeURIComponent(url)).toContain(
      'entry.888888=Fundamentos de Python 1',
    );
  });

  it('buildPrefilledUrl with empty fields returns viewform base', () => {
    expect(buildPrefilledUrl(FORM_URL, [], { name: 'Ana' })).toBe(FORM_URL);
  });

  it('buildPrefilledUrl pulls email/phone from contact', () => {
    const fields = parseFormFields(SAMPLE_HTML);
    const url = buildPrefilledUrl(
      FORM_URL,
      fields,
      { name: 'Ana Ruiz', contact: 'ana@mail.com / 0987654321' },
      {},
    );
    expect(decodeURIComponent(url)).toContain('ana@mail.com');
    expect(url).toContain('0987654321');
  });
});
