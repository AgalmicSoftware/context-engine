import fs from 'fs';
import path from 'path';

import {
  MAX_QUESTION_COUNT,
  MIN_QUESTION_COUNT,
  SURVEY_GENERATOR_AI_PROMPT_ICON_STYLE,
  SURVEY_GENERATOR_ERROR_STYLE,
  SURVEY_GENERATOR_TEXT_INPUT_STYLE,
  buildManualLibraryTextFile,
  buildPhotoAnalysisFilename,
  buildPhotoAnalysisMarkdown,
  buildPhotoPreviewUrl,
  buildAdditionalSourceId,
  buildEffectiveAdditionalSourceList,
  buildGeneratedSurveyStatements,
  buildQueuedFileSource,
  buildQueuedPhotoSourceBatch,
  buildQueuedPhotoSource,
  buildQueuedUploadedSourceBatch,
  buildSingleGenerationPrompt,
  buildSurveyGeneratorAiPromptCopyClassName,
  buildSurveyGeneratorDocSaveAudienceOptionClassName,
  buildSurveyGeneratorPhotoStatusChipClassName,
  buildSurveyGeneratorPhotoStatusToggleClassName,
  buildSurveyGeneratorTranscriptToggleClassName,
  buildSurveyGeneratorTypeButtonClassName,
  buildSurveyGeneratorTypePillClassName,
  buildUploadFilename,
  buildUnsupportedPhotoMessage,
  buildUnsupportedSourceMessage,
  clampQuestionCount,
  formatAiPromptModelLabel,
  getFileExtension,
  getSurveyGeneratorErrorMessage,
  getSelectedQuestionTypes,
  getPhotoStatusLabel,
  hasDatabaseToolInputContent,
  isLikelyImageUrl,
  isManualLibraryUploadableContent,
  isSingleHttpUrlInput,
  isSupportedAdditionalFile,
  isSupportedPhotoFile,
  normalizeTags,
  renameFileForLibraryUpload,
  revokePhotoPreviewUrl,
  sanitizeFileBaseName,
} from './surveyGeneratorHelpers';
import styles from './AudioSurveyGenerator.module.scss';

describe('surveyGeneratorHelpers', () => {
  it('clamps requested question counts to supported bounds', () => {
    expect(clampQuestionCount(MIN_QUESTION_COUNT - 1)).toBe(MIN_QUESTION_COUNT);
    expect(clampQuestionCount(MAX_QUESTION_COUNT + 1)).toBe(MAX_QUESTION_COUNT);
    expect(clampQuestionCount(25)).toBe(25);
  });

  it('builds display styles and control class names', () => {
    expect(SURVEY_GENERATOR_TEXT_INPUT_STYLE).toEqual({
      resize: 'both',
      minHeight: '100px',
      overflow: 'auto',
    });
    expect(SURVEY_GENERATOR_ERROR_STYLE).toEqual({ marginTop: '10px' });
    expect(SURVEY_GENERATOR_AI_PROMPT_ICON_STYLE).toEqual({ marginLeft: '6px' });
    expect(buildSurveyGeneratorTranscriptToggleClassName(styles, true)).toBe(
      `${styles.transcriptToggleBtn} ${styles.active}`,
    );
    expect(buildSurveyGeneratorTranscriptToggleClassName(styles, false)).toBe(`${styles.transcriptToggleBtn} `);
    expect(buildSurveyGeneratorAiPromptCopyClassName(styles, true)).toBe(
      `${styles.aiPromptCopyCorner} ${styles.aiPromptCopyCornerSuccess}`,
    );
    expect(buildSurveyGeneratorAiPromptCopyClassName(styles, false)).toBe(`${styles.aiPromptCopyCorner} `);
    const photoStyles = {
      photoStatusChip: 'photoStatusChip',
      photoStatusChipError: 'photoStatusChipError',
      photoStatusChipLoading: 'photoStatusChipLoading',
      photoStatusToggle: 'photoStatusToggle',
    };
    expect(buildSurveyGeneratorPhotoStatusToggleClassName(photoStyles)).toBe('photoStatusChip photoStatusToggle');
    expect(buildSurveyGeneratorPhotoStatusChipClassName(photoStyles, 'error')).toBe(
      'photoStatusChip photoStatusChipError',
    );
    expect(buildSurveyGeneratorPhotoStatusChipClassName(photoStyles, 'loading')).toBe(
      'photoStatusChip photoStatusChipLoading',
    );
    expect(buildSurveyGeneratorPhotoStatusChipClassName(photoStyles, 'unknown')).toBe('photoStatusChip ');
    expect(buildSurveyGeneratorDocSaveAudienceOptionClassName(styles, true)).toBe(
      `${styles.docSaveAudienceOption} ${styles.active}`,
    );
    expect(buildSurveyGeneratorDocSaveAudienceOptionClassName(styles, false)).toBe(`${styles.docSaveAudienceOption} `);
    expect(buildSurveyGeneratorTypeButtonClassName(styles, true)).toBe(`${styles.typeButton} ${styles.active}`);
    expect(buildSurveyGeneratorTypeButtonClassName(styles, false)).toBe(`${styles.typeButton} `);
    expect(buildSurveyGeneratorTypePillClassName(styles, 'agree')).toBe(`${styles.pill} ${styles.pillAgree}`);
    expect(buildSurveyGeneratorTypePillClassName(styles, 'unsure')).toBe(`${styles.pill} ${styles.pillUnsure}`);
    expect(buildSurveyGeneratorTypePillClassName(styles, 'disagree')).toBe(`${styles.pill} ${styles.pillDisagree}`);
  });

  it('uses the theme authoring contract for every always-visible generator control', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'AudioSurveyGenerator.module.scss'), 'utf8');

    expect(scss).toMatch(/\$background-color:\s*var\(--ce-authoring-panel-bg\);/);
    expect(scss).toMatch(/\$text-color:\s*var\(--ce-authoring-panel-text\);/);
    expect(scss).toMatch(/\$question-background:\s*var\(--ce-authoring-section-bg\);/);
    expect(scss).toMatch(/\.urlInputField\s*{[\s\S]*?background:\s*var\(--ce-authoring-input-bg\)\s*!important;/);
    expect(scss).toMatch(/\.typeButton\s*{[\s\S]*?background:\s*var\(--ce-authoring-control-bg\);/);
    expect(scss).toMatch(/\.countInlineLabel\s*{[\s\S]*?color:\s*var\(--ce-authoring-panel-muted\);/);
    expect(scss).toMatch(/\.aiPromptToggleBtn\s*{[\s\S]*?color:\s*var\(--ce-authoring-control-text\);/);
  });

  it('uses semantic theme tokens for the AI prompt preview', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'AudioSurveyGenerator.module.scss'), 'utf8');
    const classic95Theme = fs.readFileSync(path.join(__dirname, '../../../scss/themes/_classic-95.scss'), 'utf8');

    expect(scss).toMatch(
      /\.aiPromptWrapper\s*\{[\s\S]*?background:\s*var\(--ce-authoring-prompt-bg\);[\s\S]*?color:\s*var\(--ce-authoring-prompt-text\);/,
    );
    expect(scss).toMatch(/\.aiPromptHeader\s*\{[\s\S]*?color:\s*var\(--ce-authoring-prompt-heading\);/);
    expect(scss).toMatch(
      /\.aiPromptMeta\s*\{[\s\S]*?opacity:\s*var\(--ce-authoring-prompt-meta-opacity\);[\s\S]*?color:\s*var\(--ce-authoring-prompt-meta\);/,
    );
    expect(scss).toMatch(
      /\.aiVar\s*\{[\s\S]*?background:\s*var\(--ce-authoring-prompt-variable-bg\);[\s\S]*?color:\s*var\(--ce-authoring-prompt-variable-text\);/,
    );
    expect(scss).toMatch(/\.jsonDisplay\s*\{[\s\S]*?color:\s*var\(--ce-authoring-prompt-json-text\);/);
    expect(scss).not.toContain('@container ce-theme style(--ce-layout-profile: desktop-window)');
    expect(classic95Theme).toMatch(/authoring-prompt-bg:\s*#ffffff,/);
    expect(classic95Theme).toMatch(/authoring-prompt-text:\s*#000000,/);
    expect(classic95Theme).toMatch(/authoring-prompt-heading:\s*#000080,/);
    expect(classic95Theme).toMatch(/authoring-prompt-variable-bg:\s*#ffffc0,/);
    expect(classic95Theme).toMatch(/authoring-prompt-variable-text:\s*#604000,/);
  });

  it('builds stable additional source ids from a mutable counter ref', () => {
    const ref = { current: 7 };

    expect(buildAdditionalSourceId(ref)).toBe('database-source-8');
    expect(buildAdditionalSourceId(ref)).toBe('database-source-9');
    expect(ref.current).toBe(9);
  });

  it('recognizes supported photo files by mime type or extension', () => {
    expect(isSupportedPhotoFile({ name: 'diagram.bin', type: 'image/png' })).toBe(true);
    expect(isSupportedPhotoFile({ name: 'whiteboard.jpeg', type: '' })).toBe(true);
    expect(isSupportedPhotoFile({ name: 'notes.pdf', type: 'application/pdf' })).toBe(false);
  });

  it('recognizes supported additional files by mime type or extension', () => {
    expect(isSupportedAdditionalFile({ name: 'deck.bin', type: 'application/vnd.ms-powerpoint' })).toBe(true);
    expect(isSupportedAdditionalFile({ name: 'dataset.json', type: '' })).toBe(true);
    expect(isSupportedAdditionalFile({ name: 'photo.png', type: 'image/png' })).toBe(false);
  });

  it('builds queued file and photo source records', () => {
    const ref = { current: 0 };
    const file = { name: 'context.md', type: 'text/markdown' };
    const photo = { name: 'sketch.webp', type: 'image/webp' };

    expect(buildQueuedFileSource(file, ref)).toEqual({
      id: 'database-source-1',
      type: 'file',
      value: file,
      name: 'context.md',
    });
    expect(buildQueuedPhotoSource(photo, ref)).toEqual({
      id: 'database-source-2',
      type: 'photo',
      value: photo,
      name: 'sketch.webp',
      analysisStatus: 'queued',
      analysisError: '',
      analysisText: '',
      analysisExpanded: false,
    });
  });

  it('builds queued source batches from supported uploads', () => {
    const ref = { current: 0 };
    const photo = { name: 'photo.png', type: 'image/png' };
    const textFile = { name: 'notes.md', type: 'text/markdown' };
    const unsupported = { name: 'archive.zip', type: 'application/zip' };

    expect(buildQueuedPhotoSourceBatch([photo, textFile, unsupported], ref)).toEqual({
      invalidCount: 2,
      nextSources: [
        {
          id: 'database-source-1',
          type: 'photo',
          value: photo,
          name: 'photo.png',
          analysisStatus: 'queued',
          analysisError: '',
          analysisText: '',
          analysisExpanded: false,
        },
      ],
      validFiles: [photo],
    });

    expect(buildQueuedUploadedSourceBatch([textFile, photo, unsupported], ref)).toEqual({
      invalidCount: 1,
      nextSources: [
        {
          id: 'database-source-2',
          type: 'file',
          value: textFile,
          name: 'notes.md',
        },
        {
          id: 'database-source-3',
          type: 'photo',
          value: photo,
          name: 'photo.png',
          analysisStatus: 'queued',
          analysisError: '',
          analysisText: '',
          analysisExpanded: false,
        },
      ],
    });
  });

  it('builds effective additional source lists with pending URL input', () => {
    const ref = { current: 9 };
    const existing = [{ id: 'database-source-1', type: 'file', value: 'a', name: 'a.md' }];

    expect(
      buildEffectiveAdditionalSourceList({
        additionalSources: existing,
        additionalUrlInput: ' https://example.test/doc ',
        ref,
      }),
    ).toEqual({
      queuedAdditionalSources: existing,
      effectiveSources: [
        existing[0],
        {
          id: 'database-source-10',
          type: 'url',
          value: 'https://example.test/doc',
          name: 'https://example.test/doc',
        },
      ],
    });
    expect(ref.current).toBe(10);
    expect(
      buildEffectiveAdditionalSourceList({
        additionalSources: existing,
        additionalUrlInput: '  ',
        ref,
      }),
    ).toEqual({
      queuedAdditionalSources: existing,
      effectiveSources: existing,
    });
    expect(ref.current).toBe(10);
  });

  it('builds and revokes photo preview object URLs through an injectable API', () => {
    const urlApi = {
      createObjectURL: jest.fn(() => 'blob:preview-url'),
      revokeObjectURL: jest.fn(),
    };
    const file = { name: 'photo.png' };

    expect(buildPhotoPreviewUrl(null, urlApi)).toBe('');
    expect(urlApi.createObjectURL).not.toHaveBeenCalled();
    expect(buildPhotoPreviewUrl(file, urlApi)).toBe('blob:preview-url');
    expect(urlApi.createObjectURL).toHaveBeenCalledWith(file);
    expect(revokePhotoPreviewUrl('', urlApi)).toBe(false);
    expect(urlApi.revokeObjectURL).not.toHaveBeenCalled();
    expect(revokePhotoPreviewUrl('blob:preview-url', urlApi)).toBe(true);
    expect(urlApi.revokeObjectURL).toHaveBeenCalledWith('blob:preview-url');
  });

  it('normalizes thrown generator errors with fallback text', () => {
    expect(getSurveyGeneratorErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
    expect(getSurveyGeneratorErrorMessage({ message: '  ' }, 'fallback')).toBe('fallback');
    expect(getSurveyGeneratorErrorMessage('bad', 'fallback')).toBe('fallback');
  });

  it('detects image URLs by pathname extension', () => {
    expect(isLikelyImageUrl('https://example.test/uploads/photo.png?download=1')).toBe(true);
    expect(isLikelyImageUrl('https://example.test/uploads/file.pdf')).toBe(false);
    expect(isLikelyImageUrl('not a url')).toBe(false);
  });

  it('formats unsupported upload messages with singular and plural nouns', () => {
    expect(buildUnsupportedPhotoMessage(1)).toContain('unsupported photo.');
    expect(buildUnsupportedPhotoMessage(2)).toContain('unsupported photos.');
    expect(buildUnsupportedSourceMessage(1)).toContain('unsupported file.');
    expect(buildUnsupportedSourceMessage(3)).toContain('unsupported files.');
  });

  it('returns photo analysis status labels and error details', () => {
    expect(getPhotoStatusLabel({ analysisStatus: 'loading' })).toBe('Analyzing photo...');
    expect(getPhotoStatusLabel({ analysisStatus: 'ready' })).toBe('Analysis complete');
    expect(getPhotoStatusLabel({ analysisStatus: 'error', analysisError: 'Could not parse image' })).toBe(
      'Could not parse image',
    );
    expect(getPhotoStatusLabel({ analysisStatus: 'unknown' })).toBe('Queued for analysis');
  });

  it('detects single URL inputs without accepting prose', () => {
    expect(isSingleHttpUrlInput('https://example.com/article')).toBe(true);
    expect(isSingleHttpUrlInput(' this is plain text content ')).toBe(false);
  });

  it('builds photo analysis sidecar content and filenames', () => {
    expect(buildPhotoAnalysisMarkdown({ photoName: 'whiteboard.png', analysisText: 'Detected sticky notes.' })).toBe(
      '# Photo Analysis\n\nSource photo: whiteboard.png\n\nDetected sticky notes.',
    );
    expect(buildPhotoAnalysisMarkdown({ analysisText: 'No name' })).toContain('Source photo: uploaded photo');
    expect(buildPhotoAnalysisFilename('whiteboard.png')).toBe('whiteboard.analysis.md');
    expect(buildPhotoAnalysisFilename('')).toBe('photo.analysis.md');
  });

  it('sanitizes upload filenames while preserving extensions', () => {
    expect(sanitizeFileBaseName('  Research: Round/One?.pdf  ')).toBe('Research Round One');
    expect(getFileExtension('slides.final.pptx')).toBe('pptx');
    expect(getFileExtension('.hidden')).toBe('');
    expect(buildUploadFilename({ title: 'Session Notes', originalName: 'raw.txt' })).toBe('Session Notes.txt');
    expect(buildUploadFilename({ title: '', originalName: '', fallbackExtension: 'md' })).toBe('context.md');
  });

  it('renames library uploads only when given a File and non-empty title', () => {
    const original = new File(['hello'], 'raw name.txt', {
      type: 'text/plain',
      lastModified: 42,
    });

    const renamed = renameFileForLibraryUpload(original, 'Clean Title') as File;

    expect(renamed).not.toBe(original);
    expect(renamed.name).toBe('Clean Title.txt');
    expect(renamed.type).toBe('text/plain');
    expect(renamed.lastModified).toBe(42);
    expect(renamed.size).toBe(original.size);
    expect(renameFileForLibraryUpload(original, '')).toBe(original);
    expect(renameFileForLibraryUpload({ name: 'not-file.txt' }, 'Title')).toEqual({ name: 'not-file.txt' });
  });

  it('builds manual library text files as markdown or plain text', () => {
    const markdownFile = buildManualLibraryTextFile({ title: 'Agenda', text: '# Heading' });
    const textFile = buildManualLibraryTextFile({ title: 'Note', text: 'plain note' });

    expect(markdownFile.name).toBe('Agenda.md');
    expect(markdownFile.type).toBe('text/markdown');
    expect(markdownFile.size).toBe('# Heading'.length);
    expect(textFile.name).toBe('Note.txt');
    expect(textFile.type).toBe('text/plain');
    expect(textFile.size).toBe('plain note'.length);
  });

  it('detects database and library input content', () => {
    expect(hasDatabaseToolInputContent({ audioFile: { name: 'clip.wav' } })).toBe(true);
    expect(hasDatabaseToolInputContent({ pastedText: '  ', additionalSources: [] })).toBe(false);
    expect(isManualLibraryUploadableContent({ additionalUrlInput: 'https://example.test/doc' })).toBe(true);
    expect(isManualLibraryUploadableContent({ additionalSources: [{ id: 'source-1' }] })).toBe(true);
    expect(isManualLibraryUploadableContent({ pastedText: '', additionalUrlInput: '', additionalSources: [] })).toBe(
      false,
    );
  });

  it('formats configured AI prompt model labels', () => {
    expect(formatAiPromptModelLabel({ provider: 'openai', model: 'gpt-4o' })).toBe('OpenAI gpt-4o');
    expect(formatAiPromptModelLabel({ provider: 'custom', model: '' })).toBe('Custom');
    expect(formatAiPromptModelLabel({ provider: 'bespoke', model: 'local-model' })).toBe('Bespoke local-model');
    expect(formatAiPromptModelLabel({})).toBe('Configured model');
  });

  it('normalizes default tag inputs', () => {
    expect(normalizeTags('alpha, beta,, gamma ')).toEqual(['alpha', 'beta', 'gamma']);
    expect(normalizeTags(['alpha', '', false, ' beta '])).toEqual(['alpha', 'beta']);
    expect(normalizeTags(null)).toEqual([]);
  });

  it('gets selected question type keys from truthy flags', () => {
    expect(
      getSelectedQuestionTypes({
        binary: true,
        rating: false,
        freeform: 1,
        multichoice: '',
      }),
    ).toEqual(['binary', 'freeform']);
  });

  it('builds generated survey statements from AI question payloads', () => {
    const aiData = {
      surveyTitle: ' AI Suggested Title ',
      questions: [
        {
          questionType: 'binary',
          prompt: 'Keep this?',
        },
        {
          questionType: 'rating',
          prompt: 'Skip this?',
          tags: ['ignored'],
        },
        {
          questionType: 'multichoice',
          prompt: 'Pick one',
          options: ['A', 'B'],
          tags: ['choice'],
        },
      ],
    };

    const result = buildGeneratedSurveyStatements({
      aiData,
      questionTypes: {
        binary: true,
        rating: false,
        multichoice: true,
      },
      count: 5,
      fallbackTitle: 'Fallback Title',
    });

    expect(result.surveyTitle).toBe('AI Suggested Title');
    expect(result.statements).toHaveLength(2);
    expect(result.statements[0]).toMatchObject({
      type: 'binary',
      prompt: 'Keep this?',
      options: undefined,
      tags: [],
    });
    expect(result.statements[0].id).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.statements[1]).toMatchObject({
      type: 'multichoice',
      prompt: 'Pick one',
      options: ['A', 'B'],
      tags: ['choice'],
    });
  });

  it('falls back generated survey titles and limits returned statements', () => {
    const result = buildGeneratedSurveyStatements({
      aiData: {
        surveyTitle: '',
        questions: [
          { questionType: 'binary', prompt: 'First' },
          { questionType: 'binary', prompt: 'Second' },
        ],
      },
      questionTypes: { binary: true },
      count: 1,
      fallbackTitle: ' Fallback Title ',
    });

    expect(result.surveyTitle).toBe('Fallback Title');
    expect(result.statements.map((statement) => statement.prompt)).toEqual(['First']);
  });

  it('builds generation prompts from selected question types and defaults', () => {
    const prompt = buildSingleGenerationPrompt({
      promptTemplate: [
        '<SourceDocContent>',
        '<NumSeedStatements>',
        '<Types>',
        '<DefaultTags>|<DefaultTags>',
        '<SourceType>',
        '<MultiSpeakerHint>',
        '<GroupCustomInstructions>',
        '<ClipDurationMinutes>',
      ].join('\n'),
      sourceDocContent: 'Source body',
      count: 15,
      questionTypes: {
        binary: true,
        rating: false,
        freeform: true,
      },
      defaultTags: 'alpha, beta',
      transcriptMode: true,
      overrides: {
        sourceTypeOverride: 'document',
        multiSpeakerHintOverride: 'likely_multiple_speakers',
      },
      sessionInstructions: 'Keep prompts concise.',
    });

    expect(prompt).toBe(
      [
        'Source body',
        '15',
        'binary,freeform',
        'alpha, beta|alpha, beta',
        'document',
        'likely_multiple_speakers',
        'Keep prompts concise.',
        '',
      ].join('\n'),
    );
  });

  it('inserts user prompt replacements literally when values contain dollar tokens', () => {
    const prompt = buildSingleGenerationPrompt({
      promptTemplate: ['<SourceDocContent>', '<DefaultTags>', '<GroupCustomInstructions>'].join('\n'),
      sourceDocContent: "source $& $$ $` $'",
      count: 3,
      questionTypes: {
        binary: true,
      },
      defaultTags: ['$& default', '$$ tag'],
      sessionInstructions: "instructions $& $$ $` $'",
    });

    expect(prompt).toBe(["source $& $$ $` $'", '$& default, $$ tag', "instructions $& $$ $` $'"].join('\n'));
  });

  it('replaces every source type token in generation prompts', () => {
    const prompt = buildSingleGenerationPrompt({
      promptTemplate: 'source=<SourceType>\nconditional=<SourceType>',
      sourceDocContent: '',
      count: 2,
      questionTypes: {
        freeform: true,
      },
      defaultTags: [],
      transcriptMode: true,
    });

    expect(prompt).toBe('source=transcript\nconditional=transcript');
    expect(prompt).not.toContain('<SourceType>');
  });

  it('uses prompt defaults when no question types or overrides are selected', () => {
    const prompt = buildSingleGenerationPrompt({
      promptTemplate: '<Types>|<SourceType>|<MultiSpeakerHint>|<DefaultTags>',
      sourceDocContent: '',
      count: 10,
      questionTypes: {},
      defaultTags: null,
      transcriptMode: false,
    });

    expect(prompt).toBe('binary,rating,freeform,multichoice|text|unknown|');
  });
});
