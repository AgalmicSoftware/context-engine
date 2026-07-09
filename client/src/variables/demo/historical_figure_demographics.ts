import historicalFiguresMerged from './historical_figures_merged.json';
import additionalHistoricalFigures from './additional_historical_figures.json';
import historicalFigureUsers from './historical_figure_users.json';

export const DEMO_ANALYSIS_DEMOGRAPHIC_FIELDS = Object.freeze([
  'displayName',
  'bio',
  'eraLabel',
  'eraBucket',
  'country',
  'region',
  'gender',
  'affiliation',
  'atlasCategory',
] as const);

type DemoAnalysisDemographicField = (typeof DEMO_ANALYSIS_DEMOGRAPHIC_FIELDS)[number];

export type HistoricalFigureDemographicsEntry = Record<DemoAnalysisDemographicField, string>;

type SourceDemographicsEntry = Omit<HistoricalFigureDemographicsEntry, 'region'> & {
  region?: string;
};

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null;

const getRecordEntries = (value: unknown): [string, UnknownRecord][] =>
  isRecord(value) ? Object.entries(value).filter((entry): entry is [string, UnknownRecord] => isRecord(entry[1])) : [];

const COUNTRY_OVERRIDES = Object.freeze({
  USA: 'United States',
  UK: 'United Kingdom',
  Babylonia: 'Iraq',
});

const REGION_BY_COUNTRY = Object.freeze({
  China: 'East Asia',
  Egypt: 'Africa',
  France: 'Europe',
  Germany: 'Europe',
  Greece: 'Europe',
  India: 'South Asia',
  Iran: 'Middle East',
  Iraq: 'Middle East',
  Italy: 'Europe',
  Poland: 'Europe',
  Russia: 'Europe',
  SouthAfrica: 'Africa',
  'South Africa': 'Africa',
  Switzerland: 'Europe',
  Turkey: 'Middle East',
  'United Kingdom': 'Europe',
  'United States': 'North America',
  Venezuela: 'Latin America',
});

const MANUAL_DEMOGRAPHICS = Object.freeze({
  AlanTuring: {
    displayName: 'Alan Turing',
    bio: 'British mathematician and computing pioneer whose wartime codebreaking and foundational work on machine intelligence shaped modern computer science.',
    eraLabel: 'Early 20th century',
    eraBucket: 'Modern',
    country: 'United Kingdom',
    gender: 'Male',
    affiliation: 'Scientist',
    atlasCategory: 'Supply Chains',
  },
  AndrewCarnegie: {
    displayName: 'Andrew Carnegie',
    bio: 'Scottish-American steel magnate and philanthropist who helped define Gilded Age industrial capitalism and large-scale private philanthropy.',
    eraLabel: 'Late 19th century industrial era',
    eraBucket: 'Industrial',
    country: 'United States',
    gender: 'Male',
    affiliation: 'Industrialist',
    atlasCategory: 'Supply Chains',
  },
  JRobertOppenheimer: {
    displayName: 'J. Robert Oppenheimer',
    bio: 'American theoretical physicist who led the Manhattan Project and later became a central public voice on nuclear responsibility and scientific governance.',
    eraLabel: 'Mid-20th century',
    eraBucket: 'Modern',
    country: 'United States',
    gender: 'Male',
    affiliation: 'Scientist',
    atlasCategory: 'Macro Trends',
  },
  GraceHopper: {
    displayName: 'Grace Hopper',
    bio: 'American computer scientist and naval officer who advanced compilers, programming languages, and practical large-scale computing.',
    eraLabel: 'Mid-20th century',
    eraBucket: 'Modern',
    country: 'United States',
    gender: 'Female',
    affiliation: 'Scientist',
    atlasCategory: 'Supply Chains',
  },
  AlexanderGrahamBell: {
    displayName: 'Alexander Graham Bell',
    bio: 'Inventor and communications researcher whose work on the telephone accelerated long-distance connectivity and modern communications infrastructure.',
    eraLabel: 'Late 19th century industrial era',
    eraBucket: 'Industrial',
    country: 'United States',
    gender: 'Male',
    affiliation: 'Scientist',
    atlasCategory: 'Supply Chains',
  },
  Machiavelli: {
    displayName: 'Niccolo Machiavelli',
    bio: 'Florentine political thinker whose writings on statecraft, republicanism, and power remain foundational to modern political analysis.',
    eraLabel: 'Renaissance / early modern period',
    eraBucket: 'Enlightenment',
    country: 'Italy',
    gender: 'Male',
    affiliation: 'Philosopher',
    atlasCategory: 'Governance Institutions',
  },
  JamesMadison: {
    displayName: 'James Madison',
    bio: 'American constitutional framer and fourth U.S. president whose thinking on faction, federalism, and institutional design shaped modern republican government.',
    eraLabel: 'Founding era',
    eraBucket: 'Enlightenment',
    country: 'United States',
    gender: 'Male',
    affiliation: 'Political Leader',
    atlasCategory: 'Governance Institutions',
  },
  JustinianI: {
    displayName: 'Justinian I',
    bio: 'Byzantine emperor known for legal codification, imperial administration, and ambitious state-building across the eastern Mediterranean.',
    eraLabel: 'Early Byzantine era',
    eraBucket: 'Medieval',
    country: 'Turkey',
    gender: 'Male',
    affiliation: 'Political Leader',
    atlasCategory: 'Governance Institutions',
  },
  NapoleonBonaparte: {
    displayName: 'Napoleon Bonaparte',
    bio: 'French military ruler whose campaigns, administrative reforms, and centralized legal model reshaped European state power.',
    eraLabel: 'Revolutionary and Napoleonic era',
    eraBucket: 'Enlightenment',
    country: 'France',
    gender: 'Male',
    affiliation: 'Political Leader',
    atlasCategory: 'Governance Institutions',
  },
  CyrusTheGreat: {
    displayName: 'Cyrus the Great',
    bio: 'Founder of the Achaemenid Empire, remembered for imperial administration, strategic tolerance, and large-scale governance across diverse peoples.',
    eraLabel: '6th century BCE',
    eraBucket: 'Ancient',
    country: 'Iran',
    gender: 'Male',
    affiliation: 'Political Leader',
    atlasCategory: 'Governance Institutions',
  },
  Archimedes: {
    displayName: 'Archimedes',
    bio: 'Ancient mathematician and engineer whose work on mechanics, geometry, and applied invention became a touchstone for scientific method.',
    eraLabel: '3rd century BCE',
    eraBucket: 'Ancient',
    country: 'Italy',
    gender: 'Male',
    affiliation: 'Scientist',
    atlasCategory: 'Supply Chains',
  },
  JamesWatt: {
    displayName: 'James Watt',
    bio: 'Scottish engineer whose steam-engine improvements became central to industrial manufacturing, transport, and mechanized production.',
    eraLabel: 'Industrial Revolution',
    eraBucket: 'Industrial',
    country: 'United Kingdom',
    gender: 'Male',
    affiliation: 'Scientist',
    atlasCategory: 'Supply Chains',
  },
  OttoVonBismarck: {
    displayName: 'Otto von Bismarck',
    bio: 'Prussian statesman who unified Germany through pragmatic diplomacy, war, and modern bureaucratic statecraft.',
    eraLabel: 'Late 19th century industrial era',
    eraBucket: 'Industrial',
    country: 'Germany',
    gender: 'Male',
    affiliation: 'Political Leader',
    atlasCategory: 'Governance Institutions',
  },
  CatherineTheGreat: {
    displayName: 'Catherine the Great',
    bio: 'Russian empress who expanded imperial power while engaging Enlightenment debates about administration, law, and culture.',
    eraLabel: '18th century imperial enlightenment',
    eraBucket: 'Enlightenment',
    country: 'Russia',
    gender: 'Female',
    affiliation: 'Political Leader',
    atlasCategory: 'Governance Institutions',
  },
  MarcusAurelius: {
    displayName: 'Marcus Aurelius',
    bio: 'Roman emperor and Stoic philosopher remembered for reflective leadership under pressure and enduring writings on duty and self-government.',
    eraLabel: '2nd century CE',
    eraBucket: 'Ancient',
    country: 'Italy',
    gender: 'Male',
    affiliation: 'Philosopher',
    atlasCategory: 'Governance Institutions',
  },
  WinstonChurchill: {
    displayName: 'Winston Churchill',
    bio: 'British wartime prime minister whose rhetoric, coalition-building, and strategic resolve shaped twentieth-century democratic statecraft.',
    eraLabel: 'Mid-20th century',
    eraBucket: 'Modern',
    country: 'United Kingdom',
    gender: 'Male',
    affiliation: 'Political Leader',
    atlasCategory: 'Governance Institutions',
  },
  AugustusCaesar: {
    displayName: 'Augustus Caesar',
    bio: 'First Roman emperor whose consolidation of authority created a durable imperial administrative model.',
    eraLabel: '1st century BCE / CE transition',
    eraBucket: 'Ancient',
    country: 'Italy',
    gender: 'Male',
    affiliation: 'Political Leader',
    atlasCategory: 'Governance Institutions',
  },
  AlexanderTheGreat: {
    displayName: 'Alexander the Great',
    bio: 'Macedonian conqueror whose campaigns rapidly expanded imperial scale and cross-regional political integration.',
    eraLabel: '4th century BCE',
    eraBucket: 'Ancient',
    country: 'Greece',
    gender: 'Male',
    affiliation: 'Political Leader',
    atlasCategory: 'Macro Trends',
  },
  AdamSmith: {
    displayName: 'Adam Smith',
    bio: 'Scottish moral philosopher and economist whose ideas on markets, specialization, and political economy shaped modern liberal capitalism.',
    eraLabel: 'Scottish Enlightenment',
    eraBucket: 'Enlightenment',
    country: 'United Kingdom',
    gender: 'Male',
    affiliation: 'Philosopher',
    atlasCategory: 'Macro Trends',
  },
  AlbertEinstein: {
    displayName: 'Albert Einstein',
    bio: 'Theoretical physicist whose work transformed scientific understanding while making him a global moral voice on war, peace, and responsibility.',
    eraLabel: 'Early to mid-20th century',
    eraBucket: 'Modern',
    country: 'Germany',
    gender: 'Male',
    affiliation: 'Scientist',
    atlasCategory: 'Macro Trends',
  },
  RachelCarson: {
    displayName: 'Rachel Carson',
    bio: 'American marine biologist and writer whose environmental warnings catalyzed modern ecological regulation and public scientific literacy.',
    eraLabel: 'Mid-20th century',
    eraBucket: 'Modern',
    country: 'United States',
    gender: 'Female',
    affiliation: 'Scientist',
    atlasCategory: 'Actors/Civil Society',
  },
  NormanBorlaug: {
    displayName: 'Norman Borlaug',
    bio: 'Agronomist and humanitarian whose crop science helped drive the Green Revolution and global food security gains.',
    eraLabel: 'Mid-20th century',
    eraBucket: 'Modern',
    country: 'United States',
    gender: 'Male',
    affiliation: 'Scientist',
    atlasCategory: 'Supply Chains',
  },
  CharlesDarwin: {
    displayName: 'Charles Darwin',
    bio: 'Naturalist whose theory of evolution transformed biology and altered modern understandings of adaptation, change, and humanity.',
    eraLabel: '19th century scientific revolution',
    eraBucket: 'Industrial',
    country: 'United Kingdom',
    gender: 'Male',
    affiliation: 'Scientist',
    atlasCategory: 'Macro Trends',
  },
  QueenElizabethI: {
    displayName: 'Queen Elizabeth I',
    bio: 'English monarch whose long reign consolidated state authority, maritime ambition, and the early modern English political settlement.',
    eraLabel: 'Late 16th century early modern period',
    eraBucket: 'Enlightenment',
    country: 'United Kingdom',
    gender: 'Female',
    affiliation: 'Political Leader',
    atlasCategory: 'Governance Institutions',
  },
  KarlMarx: {
    displayName: 'Karl Marx',
    bio: 'Philosopher and critic of capitalism whose theories of class, labor, and historical change deeply influenced modern political movements.',
    eraLabel: '19th century industrial era',
    eraBucket: 'Industrial',
    country: 'Germany',
    gender: 'Male',
    affiliation: 'Philosopher',
    atlasCategory: 'Macro Trends',
  },
  MahatmaGandhi: {
    displayName: 'Mahatma Gandhi',
    bio: 'Indian anti-colonial leader whose nonviolent mass politics became a global model for civil resistance.',
    eraLabel: 'Early to mid-20th century',
    eraBucket: 'Modern',
    country: 'India',
    gender: 'Male',
    affiliation: 'Activist',
    atlasCategory: 'Actors/Civil Society',
  },
  NelsonMandela: {
    displayName: 'Nelson Mandela',
    bio: 'South African anti-apartheid leader and president whose reconciliation-focused politics helped steer a democratic transition.',
    eraLabel: 'Late 20th century',
    eraBucket: 'Modern',
    country: 'South Africa',
    gender: 'Male',
    affiliation: 'Activist',
    atlasCategory: 'Actors/Civil Society',
  },
  SusanBAnthony: {
    displayName: 'Susan B. Anthony',
    bio: "American suffragist and reformer whose organizing helped build durable movements for women's political rights.",
    eraLabel: '19th century reform era',
    eraBucket: 'Industrial',
    country: 'United States',
    gender: 'Female',
    affiliation: 'Activist',
    atlasCategory: 'Actors/Civil Society',
  },
  SimonBolivar: {
    displayName: 'Simon Bolivar',
    bio: 'South American independence leader whose campaigns helped dismantle Spanish imperial rule across much of northern Latin America.',
    eraLabel: 'Age of Atlantic revolutions',
    eraBucket: 'Enlightenment',
    country: 'Venezuela',
    gender: 'Male',
    affiliation: 'Political Leader',
    atlasCategory: 'Governance Institutions',
  },
  JohnLocke: {
    displayName: 'John Locke',
    bio: 'English philosopher whose ideas on rights, consent, and legitimate authority became foundational to liberal constitutionalism.',
    eraLabel: 'Late 17th century',
    eraBucket: 'Enlightenment',
    country: 'United Kingdom',
    gender: 'Male',
    affiliation: 'Philosopher',
    atlasCategory: 'Governance Institutions',
  },
  JeanJacquesRousseau: {
    displayName: 'Jean-Jacques Rousseau',
    bio: 'Genevan philosopher whose arguments about sovereignty, civic freedom, and inequality influenced democratic and revolutionary politics.',
    eraLabel: '18th century enlightenment',
    eraBucket: 'Enlightenment',
    country: 'Switzerland',
    gender: 'Male',
    affiliation: 'Philosopher',
    atlasCategory: 'Governance Institutions',
  },
  FrederickDouglass: {
    displayName: 'Frederick Douglass',
    bio: 'American abolitionist, writer, and statesman whose speeches and organizing tied emancipation to democratic equality.',
    eraLabel: '19th century abolition era',
    eraBucket: 'Industrial',
    country: 'United States',
    gender: 'Male',
    affiliation: 'Activist',
    atlasCategory: 'Actors/Civil Society',
  },
  DesmondTutu: {
    displayName: 'Desmond Tutu',
    bio: 'South African cleric and human rights advocate who became a moral voice for anti-apartheid resistance and restorative justice.',
    eraLabel: 'Late 20th century',
    eraBucket: 'Modern',
    country: 'South Africa',
    gender: 'Male',
    affiliation: 'Activist',
    atlasCategory: 'Actors/Civil Society',
  },
  LechWalesa: {
    displayName: 'Lech Walesa',
    bio: 'Polish labor organizer and president whose Solidarity movement challenged communist rule through mass civic action.',
    eraLabel: 'Late 20th century',
    eraBucket: 'Modern',
    country: 'Poland',
    gender: 'Male',
    affiliation: 'Activist',
    atlasCategory: 'Actors/Civil Society',
  },
  SunYatSen: {
    displayName: 'Sun Yat-sen',
    bio: 'Chinese revolutionary and political thinker who helped overthrow the Qing dynasty and articulate a republican national program.',
    eraLabel: 'Late 19th to early 20th century',
    eraBucket: 'Modern',
    country: 'China',
    gender: 'Male',
    affiliation: 'Political Leader',
    atlasCategory: 'Governance Institutions',
  },
  SunTzu: {
    displayName: 'Sun Tzu',
    bio: 'Ancient Chinese strategist whose writings on conflict, deception, and preparation have shaped political and military thought for centuries.',
    eraLabel: 'Late Spring and Autumn period',
    eraBucket: 'Ancient',
    country: 'China',
    gender: 'Male',
    affiliation: 'Military Strategist',
    atlasCategory: 'Governance Institutions',
  },
  Fuller: {
    displayName: 'Buckminster Fuller',
    bio: 'American designer and systems thinker whose work emphasized planetary stewardship, design science, and anticipatory coordination.',
    eraLabel: 'Mid-20th century',
    eraBucket: 'Modern',
    country: 'United States',
    gender: 'Male',
    affiliation: 'Polymath',
    atlasCategory: 'Macro Trends',
  },
  FlorenceNightingale: {
    displayName: 'Florence Nightingale',
    bio: 'Founder of modern nursing and pioneer of statistical graphics who used data visualization to reform military healthcare.',
    eraLabel: '19th century',
    eraBucket: 'Industrial',
    country: 'United Kingdom',
    gender: 'Female',
    affiliation: 'Healthcare Reformer',
    atlasCategory: 'Supply Chains',
  },
  GalileoGalilei: {
    displayName: 'Galileo Galilei',
    bio: 'Father of modern observational science who challenged institutional dogma with empirical evidence.',
    eraLabel: '16th–17th century',
    eraBucket: 'Early Modern',
    country: 'Italy',
    gender: 'Male',
    affiliation: 'Scientist',
    atlasCategory: 'Supply Chains',
  },
  RosaParks: {
    displayName: 'Rosa Parks',
    bio: 'Civil rights activist whose refusal to surrender her bus seat catalyzed the Montgomery Bus Boycott and the broader movement to dismantle segregation.',
    eraLabel: 'Mid-20th century',
    eraBucket: 'Modern',
    country: 'United States',
    gender: 'Female',
    affiliation: 'Activist',
    atlasCategory: 'Actors/Civil Society',
  },
  WangariMaathai: {
    displayName: 'Wangari Maathai',
    bio: "Kenyan Nobel laureate who founded the Green Belt Movement, linking environmental conservation with women's rights and democratic governance.",
    eraLabel: 'Late 20th century',
    eraBucket: 'Modern',
    country: 'Kenya',
    gender: 'Female',
    affiliation: 'Activist',
    atlasCategory: 'Actors/Civil Society',
  },
  Aristotle: {
    displayName: 'Aristotle',
    bio: 'Ancient Greek philosopher whose empirical method, logic, and political theory shaped Western thought for two millennia.',
    eraLabel: '4th century BCE',
    eraBucket: 'Ancient',
    country: 'Greece',
    gender: 'Male',
    affiliation: 'Philosopher',
    atlasCategory: 'Governance Institutions',
  },
});

const normalizeCountry = (value: unknown = ''): string =>
  (COUNTRY_OVERRIDES as Record<string, string>)[String(value || '').trim()] || String(value || '').trim();

const normalizeEraBucket = (value: unknown = ''): string => {
  const normalized = String(value || '').trim();
  return normalized;
};

const buildMergedFigureLookup = (): Map<string, UnknownRecord> => {
  const mergedData = historicalFiguresMerged as { figures?: unknown };
  const figures = Array.isArray(mergedData.figures) ? mergedData.figures.filter(isRecord) : [];
  const lookup = new Map<string, UnknownRecord>();
  figures.forEach((figure) => {
    const keys = [
      String(figure?.username || '').trim(),
      ...(Array.isArray(figure?.aliases) ? figure.aliases : []).map((alias) => String(alias || '').trim()),
    ].filter(Boolean);
    keys.forEach((key) => {
      if (!lookup.has(key)) {
        lookup.set(key, figure);
      }
    });
  });
  return lookup;
};

const MERGED_FIGURE_LOOKUP = buildMergedFigureLookup();

const ADDITIONAL_FIGURE_LOOKUP = new Map<string, UnknownRecord>(
  getRecordEntries(additionalHistoricalFigures).map(
    ([key, value]) => [String(key || '').trim(), value] as [string, UnknownRecord],
  ),
);

const historicalUserRecords = Array.isArray(historicalFigureUsers) ? historicalFigureUsers.filter(isRecord) : [];

const HISTORICAL_USER_LOOKUP = new Map<string, UnknownRecord>(
  historicalUserRecords
    .map((entry) => [String(entry?.username || '').trim(), entry] as [string, UnknownRecord])
    .filter(([key]) => key),
);

const buildSourceBackedEntry = (xid = ''): SourceDemographicsEntry | null => {
  const mergedFigure = MERGED_FIGURE_LOOKUP.get(xid);
  const additionalFigure = ADDITIONAL_FIGURE_LOOKUP.get(xid);
  const historicalUser = HISTORICAL_USER_LOOKUP.get(xid);

  if (!mergedFigure && !additionalFigure && !historicalUser) {
    return null;
  }

  const country = normalizeCountry(mergedFigure?.country);
  const eraBucket = normalizeEraBucket(mergedFigure?.era);
  return {
    displayName: String(mergedFigure?.displayName || historicalUser?.name || xid).trim(),
    bio: String(mergedFigure?.bio || '').trim(),
    eraLabel: eraBucket ? `${eraBucket} era` : '',
    eraBucket,
    country,
    gender: String(mergedFigure?.gender || '').trim(),
    affiliation: String(mergedFigure?.affiliation || '').trim(),
    atlasCategory: String(mergedFigure?.atlasCategory || additionalFigure?.atlasCategory || '').trim(),
  };
};

const withRegion = (entry: SourceDemographicsEntry): HistoricalFigureDemographicsEntry => {
  const country = normalizeCountry(entry.country);
  return {
    ...entry,
    country,
    region: (REGION_BY_COUNTRY as Record<string, string>)[country] || '',
  };
};

const buildCanonicalEntry = (xid = ''): HistoricalFigureDemographicsEntry | null => {
  const manualEntry = (MANUAL_DEMOGRAPHICS as Readonly<Record<string, SourceDemographicsEntry>>)[xid];
  if (manualEntry) {
    return withRegion(manualEntry);
  }
  const sourceEntry = buildSourceBackedEntry(xid);
  if (sourceEntry) {
    return withRegion(sourceEntry);
  }
  return null;
};

const DEMO_PARTICIPANT_XIDS = Object.freeze(
  historicalUserRecords.map((figure) => String(figure?.username || '').trim()).filter(Boolean),
);

const HISTORICAL_FIGURE_DEMOGRAPHICS = Object.freeze(
  DEMO_PARTICIPANT_XIDS.reduce<Record<string, HistoricalFigureDemographicsEntry>>((acc, xid) => {
    if (!xid || acc[xid]) {
      return acc;
    }
    const entry = buildCanonicalEntry(xid);
    if (!entry) {
      throw new Error(`Missing canonical demographics for demo participant "${xid}".`);
    }
    const missingFields = DEMO_ANALYSIS_DEMOGRAPHIC_FIELDS.filter((field) => !String(entry?.[field] || '').trim());
    if (missingFields.length > 0) {
      throw new Error(`Incomplete canonical demographics for "${xid}": ${missingFields.join(', ')}`);
    }
    acc[xid] = Object.freeze(entry);
    return acc;
  }, {}),
);

export default HISTORICAL_FIGURE_DEMOGRAPHICS;
