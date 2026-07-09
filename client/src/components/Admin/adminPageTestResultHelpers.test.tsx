import { render, screen } from '@testing-library/react';

import { isAdminLinkedResult, renderAdminTestResult } from './adminPageTestResultHelpers';

describe('adminPageTestResultHelpers', () => {
  it('renders empty, text, and non-linked result states without changing labels', () => {
    expect(renderAdminTestResult(null)).toBe('Not run');
    expect(renderAdminTestResult('OK (healthy)')).toBe('OK (healthy)');
    expect(renderAdminTestResult({ label: 'Complete' })).toBe('Complete');
    expect(renderAdminTestResult({ text: 'Fallback text' })).toBe('Fallback text');
    expect(renderAdminTestResult({})).toBe('OK');
    expect(isAdminLinkedResult({ href: 'https://example.test' })).toBe(true);
    expect(isAdminLinkedResult('OK')).toBe(false);
  });

  it('renders linked result states with the same target and rel contract', () => {
    render(<div>{renderAdminTestResult({ label: 'View tx', href: 'https://scan.example.test/tx/0x1' })}</div>);

    const link = screen.getByRole('link', { name: 'View tx' });
    expect(link).toHaveAttribute('href', 'https://scan.example.test/tx/0x1');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });
});
