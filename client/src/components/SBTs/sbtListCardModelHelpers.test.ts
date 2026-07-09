import {
  buildSbtListDisplayCardModel,
  buildSbtListExpandedAddressSetToggle,
  buildSbtListFeaturedCardModel,
  buildSbtListInteractiveMiniCardModel,
  buildSbtListMetaRowModel,
  buildSbtListRenderItemKey,
  coerceSbtMintEndSeconds,
  isModifiedSbtListPointerNavigation,
  lowerSbtListAddressSet,
  normalizeSbtListAddressLower,
} from './sbtListCardModelHelpers';
import type {
  BuildSbtListDisplayCardModelOptions,
  BuildSbtListFeaturedCardModelOptions,
  SbtListHelperItem,
} from './sbtListHelpers';
import { isSbtListHelperRecord } from './sbtListHelpers';

type SbtListHelperTestItem = SbtListHelperItem & {
  locked?: boolean;
  slug?: string;
};

describe('sbtListCardModelHelpers', () => {
  it('normalizes render addresses and keys by display scope', () => {
    const sbt = { sbtAddress: ' 0xABC ', slug: 'alpha' };

    expect(normalizeSbtListAddressLower(sbt.sbtAddress)).toBe('0xabc');
    expect(Array.from(lowerSbtListAddressSet([' 0xABC ', '', null, '0xdef']))).toEqual(['0xabc', '0xdef']);
    expect(Array.from(buildSbtListExpandedAddressSetToggle(new Set(['0xabc']), ' 0xABC '))).toEqual([]);
    expect(Array.from(buildSbtListExpandedAddressSetToggle(new Set(['0xabc']), ' 0xDEF '))).toEqual(['0xabc', '0xdef']);
    expect(Array.from(buildSbtListExpandedAddressSetToggle('bad', ''))).toEqual([]);
    expect(
      buildSbtListRenderItemKey(sbt, {
        allSessionsMode: false,
        listSlug: 'alpha',
        resolveSbtSessionSlug: () => 'beta',
      }),
    ).toBe('alpha|0xabc');
    expect(
      buildSbtListRenderItemKey(sbt, {
        allSessionsMode: true,
        listSlug: 'alpha',
        resolveSbtSessionSlug: (item) => item.slug,
      }),
    ).toBe('alpha|0xabc');
  });

  it('detects modified pointer navigation', () => {
    expect(isModifiedSbtListPointerNavigation({ metaKey: true })).toBe(true);
    expect(isModifiedSbtListPointerNavigation({ ctrlKey: true })).toBe(true);
    expect(isModifiedSbtListPointerNavigation({ shiftKey: true })).toBe(true);
    expect(isModifiedSbtListPointerNavigation({ altKey: true })).toBe(true);
    expect(isModifiedSbtListPointerNavigation({ button: 1 })).toBe(true);
    expect(isModifiedSbtListPointerNavigation({ button: 0 })).toBe(false);
    expect(isModifiedSbtListPointerNavigation(null)).toBe(false);
  });

  it('builds interactive mini-card models from SBT list items', () => {
    expect(
      buildSbtListInteractiveMiniCardModel({
        keyPrefix: 'featured-mini',
        resolveSbtSessionSlug: (sbt) => sbt.slug,
        sbt: {
          sbtAddress: ' 0xABC ',
          slug: 'alpha',
        },
      }),
    ).toEqual({
      key: 'featured-mini-alpha|0xabc',
      sbtAddress: '0xABC',
      sbtAddressLower: '0xabc',
      sessionSlug: 'alpha',
    });
    expect(
      buildSbtListInteractiveMiniCardModel({
        resolveSbtSessionSlug: () => 'alpha',
        sbt: {
          sbtAddress: '',
        },
      }),
    ).toBeNull();
    expect(
      buildSbtListInteractiveMiniCardModel({
        resolveSbtSessionSlug: () => 'alpha',
        sbt: null,
      }),
    ).toBeNull();
  });

  it('builds display card models with explicit address handling', () => {
    const baseOptions: BuildSbtListDisplayCardModelOptions<SbtListHelperTestItem> = {
      getDescriptionText: (sbtInfo) => (isSbtListHelperRecord(sbtInfo) ? String(sbtInfo.description || '') : ''),
      getDisplayName: (sbtInfo) => (isSbtListHelperRecord(sbtInfo) ? sbtInfo.name : ''),
      isPasswordLocked: (sbt) => sbt.locked,
      resolveSbtSessionSlug: (sbt) => sbt.slug,
      sbt: {
        locked: true,
        sbtAddress: ' 0xABC ',
        sbtInfo: {
          description: 'Builder access',
          image: 'ipfs://bafy-image',
          name: '',
        },
        slug: 'alpha',
      },
      unnamedLabel: 'Badge',
    };

    expect(buildSbtListDisplayCardModel(baseOptions)).toEqual({
      description: 'Builder access',
      imageSrc: 'https://ipfs.io/ipfs/bafy-image',
      key: 'sbt-alpha|0xabc',
      locked: true,
      name: 'Unnamed Badge',
      sbtAddress: '0xABC',
      sbtAddressLower: '0xabc',
      sessionSlug: 'alpha',
    });
    expect(
      buildSbtListDisplayCardModel({
        ...baseOptions,
        addressMode: 'raw',
        keyPrefix: 'compact',
      }),
    ).toEqual(
      expect.objectContaining({
        key: 'compact-alpha| 0xabc ',
        sbtAddress: ' 0xABC ',
        sbtAddressLower: ' 0xabc ',
      }),
    );
    expect(
      buildSbtListDisplayCardModel({
        ...baseOptions,
        sbt: { sbtAddress: '0xABC' },
      }),
    ).toBeNull();
  });

  it('builds meta row models for tag and details controls', () => {
    expect(
      buildSbtListMetaRowModel({
        details: {
          documentUrls: [{ href: 'https://example.com/doc', label: 'https://example.com/doc' }],
          hasDetails: true,
          tags: ['Builder'],
        },
        expandedSbtAddresses: new Set([' 0xabc ']),
        sbt: { sbtAddress: ' 0xABC ' },
      }),
    ).toEqual({
      hasDetailsToggle: true,
      hasTags: true,
      isExpanded: true,
      sbtAddressLower: ' 0xabc ',
      tags: ['Builder'],
    });
    expect(
      buildSbtListMetaRowModel({
        details: {
          documentUrls: [{ href: 'https://example.com/doc', label: 'https://example.com/doc' }],
          hasDetails: true,
          tags: [],
        },
        miniaturized: true,
        sbt: { sbtAddress: '0xABC' },
      }),
    ).toBeNull();
    expect(
      buildSbtListMetaRowModel({
        details: {
          documentUrls: [],
          hasDetails: false,
          tags: ['Research'],
        },
        miniaturized: true,
        sbt: { sbtAddress: '0xABC' },
      }),
    ).toEqual(
      expect.objectContaining({
        hasDetailsToggle: false,
        hasTags: true,
        tags: ['Research'],
      }),
    );
  });

  it('builds featured card models from display state', () => {
    const featuredOptions: BuildSbtListFeaturedCardModelOptions<SbtListHelperTestItem> = {
      expandedSbtAddresses: new Set(['0xabc']),
      fallbackLabel: 'Credential',
      getDisplayName: (sbtInfo) => (isSbtListHelperRecord(sbtInfo) ? sbtInfo.name : ''),
      resolveSbtSessionSlug: (sbt) => sbt.slug,
      sbt: {
        sbtAddress: ' 0xABC ',
        sbtInfo: { name: '' },
        slug: 'alpha',
      },
    };

    expect(buildSbtListFeaturedCardModel(featuredOptions)).toEqual({
      detailsId: 'featured-sbt-details-0xabc',
      isExpanded: true,
      linkLabel: '0xABC',
      sbtAddress: '0xABC',
      sbtAddressLower: '0xabc',
      sessionSlug: 'alpha',
    });
    expect(
      buildSbtListFeaturedCardModel({
        fallbackLabel: 'Credential',
        getDisplayName: () => 'Named credential',
        resolveSbtSessionSlug: () => '',
        sbt: { sbtAddress: '0xDEF' },
      }),
    ).toEqual(
      expect.objectContaining({
        isExpanded: false,
        linkLabel: 'Named credential',
        sbtAddressLower: '0xdef',
        sessionSlug: '',
      }),
    );
    expect(
      buildSbtListFeaturedCardModel({
        getDisplayName: () => '',
        resolveSbtSessionSlug: () => 'alpha',
        sbt: null,
      }),
    ).toBeNull();
  });

  it('coerces mint end timestamps to seconds', () => {
    expect(coerceSbtMintEndSeconds('1700000000')).toBe(1700000000);
    expect(coerceSbtMintEndSeconds(1700000000000)).toBe(1700000000);
    expect(coerceSbtMintEndSeconds(-1)).toBe(0);
    expect(coerceSbtMintEndSeconds('bad')).toBe(0);
  });
});
