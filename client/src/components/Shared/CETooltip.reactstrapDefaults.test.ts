const PopperContent = require('reactstrap/lib/PopperContent').default;

describe('reactstrap tooltip defaults', () => {
  it('keeps PopperContent transition timeout defined for default tooltips', () => {
    const transition = (PopperContent as any)?.defaultProps?.transition;

    expect(transition).toEqual(
      expect.objectContaining({
        timeout: expect.any(Number),
      })
    );
    expect(transition.timeout).toBeGreaterThan(0);
  });
});
