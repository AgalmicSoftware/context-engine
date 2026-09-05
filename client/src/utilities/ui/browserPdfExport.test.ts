import {
  loadBrowserModuleWithRetry,
  resolveDefaultExport,
  resolveJsPdfConstructor,
  saveCanvasAsPagedPdf,
} from './browserPdfExport';

describe('browser PDF export primitives', () => {
  it('retries transient module loading failures', async () => {
    const loader = jest.fn().mockRejectedValueOnce(new Error('chunk unavailable')).mockResolvedValue({ default: 'ok' });

    await expect(loadBrowserModuleWithRetry(loader, { attempts: 2, delayMs: 0 })).resolves.toEqual({ default: 'ok' });
    expect(loader).toHaveBeenCalledTimes(2);
    expect(resolveDefaultExport({ default: 'ok' })).toBe('ok');
  });

  it('resolves supported jsPDF module shapes', () => {
    function DefaultJsPdf() {}
    function NamedJsPdf() {}
    function NamespacedJsPdf() {}

    expect(resolveJsPdfConstructor({ default: DefaultJsPdf })).toBe(DefaultJsPdf);
    expect(resolveJsPdfConstructor({ jsPDF: NamedJsPdf })).toBe(NamedJsPdf);
    expect(resolveJsPdfConstructor({ default: { jsPDF: NamespacedJsPdf } })).toBe(NamespacedJsPdf);
    expect(() => resolveJsPdfConstructor({ default: {} })).toThrow('jsPDF constructor is unavailable');
  });

  it('renders a canvas across A4 pages and saves the result', () => {
    const addImage = jest.fn();
    const addPage = jest.fn();
    const save = jest.fn();
    const JsPdf = jest.fn().mockImplementation(() => ({
      addImage,
      addPage,
      internal: { pageSize: { getHeight: () => 842, getWidth: () => 595 } },
      save,
    }));
    const canvas = {
      height: 2000,
      toDataURL: jest.fn(() => 'data:image/jpeg;base64,report'),
      width: 500,
    } as unknown as HTMLCanvasElement;

    saveCanvasAsPagedPdf({ canvas, filename: 'report.pdf', JsPdf });

    expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.82);
    expect(addImage).toHaveBeenCalledTimes(3);
    expect(addPage).toHaveBeenCalledTimes(2);
    expect(addImage.mock.calls.map((call) => call[3])).toEqual([0, -842, -1684]);
    expect(save).toHaveBeenCalledWith('report.pdf');
  });

  it('rejects unusable captures before constructing a PDF', () => {
    const JsPdf = jest.fn();
    const canvas = { height: 10, toDataURL: jest.fn(), width: 0 } as unknown as HTMLCanvasElement;

    expect(() => saveCanvasAsPagedPdf({ canvas, filename: 'report.pdf', JsPdf })).toThrow(
      'PDF export capture did not produce a usable canvas.',
    );
    expect(JsPdf).not.toHaveBeenCalled();
  });
});
