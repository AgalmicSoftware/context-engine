import {
  buildSbtPagePasswordExportFile,
  buildSbtPagePasswordExportRows,
  buildSbtPagePasswordInviteLink,
  decodeSbtPageJsonDataUri,
  encodeSbtPageGroupPasswordForUrl,
  generateSbtPageRandomPasswords,
  resolveSbtPagePasswordExportControlsState,
  resolveSbtPagePasswordExportSelection,
  resolveSbtPagePasswordInventoryDisplayState,
} from './sbtPagePasswordExportHelpers';

describe('sbtPagePasswordExportHelpers', () => {
  it('resolves password export selection and controls from cached and generated codes', () => {
    expect(
      resolveSbtPagePasswordExportSelection({
        cachedPasswords: ['cached-one'],
        adminGeneratedPasswords: [],
        includePreviousPasswords: false,
      }),
    ).toMatchObject({
      onlyCachedPasswords: true,
      effectiveIncludePreviousPasswords: true,
      passwordsToExport: ['cached-one'],
    });
    expect(
      resolveSbtPagePasswordExportSelection({
        cachedPasswords: ['cached-one'],
        adminGeneratedPasswords: ['admin-one'],
        includePreviousPasswords: false,
      }).passwordsToExport,
    ).toEqual(['admin-one']);
    expect(
      resolveSbtPagePasswordExportSelection({
        cachedPasswords: ['cached-one'],
        adminGeneratedPasswords: ['admin-one'],
        includePreviousPasswords: true,
      }).passwordsToExport,
    ).toEqual(['cached-one', 'admin-one']);
    expect(
      resolveSbtPagePasswordExportSelection({
        cachedPasswords: 'bad',
        adminGeneratedPasswords: [2, null, 'admin-two'],
      }).adminGeneratedPasswordList,
    ).toEqual(['2', '', 'admin-two']);

    expect(
      resolveSbtPagePasswordExportControlsState({
        adminGeneratedPasswordList: ['admin-one'],
        effectiveIncludePreviousPasswords: true,
        onlyCachedPasswords: false,
      }),
    ).toEqual({
      effectiveIncludePreviousPasswordsChecked: true,
      renderIncludePreviousCheckbox: true,
      showCachedPasswordsIncludedNote: false,
    });
    expect(
      resolveSbtPagePasswordExportControlsState({
        adminGeneratedPasswordList: [],
        effectiveIncludePreviousPasswords: true,
        onlyCachedPasswords: true,
      }),
    ).toEqual({
      effectiveIncludePreviousPasswordsChecked: true,
      renderIncludePreviousCheckbox: false,
      showCachedPasswordsIncludedNote: true,
    });
    expect(
      resolveSbtPagePasswordInventoryDisplayState({
        combinedPasswords: [],
        showNoMoreInvites: true,
        showPasswordGen: false,
      }),
    ).toEqual({
      shouldRenderGeneratedPasswordList: false,
      shouldRenderNoMoreInvitesEmptyState: true,
      shouldRenderPasswordGenerationSection: false,
      shouldRenderPreviousPasswordsSection: false,
    });
  });

  it('builds password invite links, export rows, and files', () => {
    const encodeGroupPassword = (code: string) => `enc:${code}`;

    expect(
      encodeSbtPageGroupPasswordForUrl(' One Two ', {
        normalizeGroupPasswordInput: (raw) =>
          String(raw || '')
            .trim()
            .toLowerCase(),
        encodeGroupPasswordForUrl: (raw) => `encoded:${raw}`,
      }),
    ).toBe('encoded:one two');
    expect(
      buildSbtPagePasswordInviteLink({
        baseUrl: 'https://app.example',
        code: 'one two',
        demoPath: '/s/alpha',
        encodeGroupPassword,
        isInvite: true,
        sbtAddr: '0xabc',
        sbtBasePathValue: '/sbt',
      }),
    ).toBe('https://app.example/s/alpha?auto=1&sbt=0xabc');

    const inviteRows = buildSbtPagePasswordExportRows({
      baseUrl: 'https://app.example',
      codeLabel: 'groupPassword',
      demoPath: '/s/alpha',
      encodeGroupPassword,
      isInvite: true,
      passwordsToExport: ['one two'],
      sbtAddr: '0xabc',
      sbtBasePathValue: '/sbt',
    });
    expect(inviteRows).toEqual([
      {
        groupPassword: 'one two',
        inviteLink: 'https://app.example/s/alpha?auto=1&sbt=0xabc',
      },
    ]);

    const passwordRows = buildSbtPagePasswordExportRows({
      baseUrl: 'https://app.example',
      codeLabel: 'password',
      isInvite: false,
      passwordsToExport: ['pw1'],
      sbtAddr: '0xdef',
      sbtBasePathValue: '/sbt',
    });
    expect(passwordRows).toEqual([
      {
        password: 'pw1',
        inviteLink: 'https://app.example/sbt/0xdef',
      },
    ]);
    expect(
      buildSbtPagePasswordExportFile({
        codeLabel: 'password',
        date: '2026-05-05',
        fileLabel: 'passwords',
        format: 'csv',
        rows: passwordRows,
        sbtSymbolOrName: 'ALPHA',
      }),
    ).toEqual({
      content: 'index,password,inviteLink\n0,pw1,https://app.example/sbt/0xdef',
      fileName: 'ALPHA_passwords_2026-05-05.csv',
      mimeType: 'text/csv',
    });
    expect(
      buildSbtPagePasswordExportFile({
        codeLabel: 'groupPassword',
        date: '2026-05-05',
        fileLabel: 'group-passwords',
        format: 'json',
        rows: inviteRows,
        sbtSymbolOrName: 'ALPHA',
      }),
    ).toMatchObject({
      content: JSON.stringify(inviteRows, null, 2),
      fileName: 'ALPHA_group-passwords_2026-05-05.json',
      mimeType: 'application/json',
    });
    expect(
      buildSbtPagePasswordExportFile({
        codeLabel: 'groupPassword',
        date: '2026-05-05',
        fileLabel: 'group-passwords',
        format: 'csv',
        rows: [
          {
            groupPassword: 'alpha,beta',
            inviteLink: 'https://app.example/session?gp=alpha,beta',
          },
          {
            groupPassword: 'quote"code',
            inviteLink: 'https://app.example/session?gp=quote"code',
          },
          {
            groupPassword: 'line\nbreak',
            inviteLink: 'https://app.example/session?gp=line%0Abreak',
          },
        ],
        sbtSymbolOrName: 'ALPHA',
      }),
    ).toEqual({
      content: [
        'index,groupPassword,inviteLink',
        '0,"alpha,beta",https://app.example/session',
        '1,"quote""code",https://app.example/session',
        '2,"line\nbreak",https://app.example/session',
      ].join('\n'),
      fileName: 'ALPHA_group-passwords_2026-05-05.csv',
      mimeType: 'text/csv',
    });
    expect(buildSbtPagePasswordExportFile({ format: 'txt' })).toBeNull();
  });

  it('generates unique 16-byte hex passwords using injected random sources', () => {
    let browserCall = 0;
    expect(
      generateSbtPageRandomPasswords({
        count: 2,
        getRandomValues: (arr) => {
          arr.fill(browserCall === 0 ? 1 : 2);
          browserCall += 1;
          return arr;
        },
        randomBytes: () => {
          throw new Error('fallback should not be used');
        },
      }),
    ).toEqual(['01010101010101010101010101010101', '02020202020202020202020202020202']);

    let fallbackCall = 0;
    expect(
      generateSbtPageRandomPasswords({
        count: 2,
        getRandomValues: null,
        randomBytes: () => {
          fallbackCall += 1;
          return new Uint8Array(16).fill(fallbackCall === 1 ? 3 : 4);
        },
      }),
    ).toEqual(['03030303030303030303030303030303', '04040404040404040404040404040404']);
    expect(
      generateSbtPageRandomPasswords({
        count: 'bad',
        randomBytes: () => new Uint8Array(16),
      }),
    ).toEqual([]);
  });

  it('decodes JSON data URIs for metadata fallback reads', () => {
    expect(
      decodeSbtPageJsonDataUri(`data:application/json,${encodeURIComponent(JSON.stringify({ name: 'Badge' }))}`),
    ).toEqual({ name: 'Badge' });
    expect(
      decodeSbtPageJsonDataUri(
        `data:application/json;base64,${Buffer.from(JSON.stringify({ name: 'Encoded' })).toString('base64')}`,
      ),
    ).toEqual({ name: 'Encoded' });
    expect(decodeSbtPageJsonDataUri('data:application/json,not-json')).toBeNull();
    expect(decodeSbtPageJsonDataUri('https://example.test/metadata.json')).toBeNull();
  });
});
