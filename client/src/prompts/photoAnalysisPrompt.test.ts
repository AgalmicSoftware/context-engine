import buildPhotoAnalysisPrompt from './photoAnalysisPrompt.js';

describe('photoAnalysisPrompt', () => {
  it('includes the source filename when provided', () => {
    const prompt = buildPhotoAnalysisPrompt('scan.png');

    expect(prompt).toContain('Analyze this uploaded screenshot or document photo');
    expect(prompt).toContain('Source filename: scan.png');
    expect(prompt).toContain('Do not invent hidden or unreadable details.');
  });

  it('omits the filename line when no filename is provided', () => {
    const prompt = buildPhotoAnalysisPrompt('');

    expect(prompt).not.toContain('Source filename:');
  });
});
