import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { TestMemoryRouter as MemoryRouter } from 'testUtils/TestMemoryRouter';
import QuestionTagDropdown, { buildTagPagePath } from './QuestionTagDropdown';

jest.mock('reactstrap', () => {
  const React = require('react');
  const DropdownContext = React.createContext({
    isOpen: false,
    setIsOpen: () => {},
  });

  return {
    __esModule: true,
    UncontrolledDropdown: ({ children, ...props }: any) => {
      const [isOpen, setIsOpen] = React.useState(false);
      return (
        <DropdownContext.Provider value={{ isOpen, setIsOpen }}>
          <div {...props}>{children}</div>
        </DropdownContext.Provider>
      );
    },
    DropdownToggle: ({ children, onClick, color, caret, ...props }: any) => {
      const { isOpen, setIsOpen } = React.useContext(DropdownContext);
      const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (typeof onClick === 'function') onClick(event);
        setIsOpen(!isOpen);
      };

      return (
        <button type="button" onClick={handleClick} {...props}>
          {children}
        </button>
      );
    },
    DropdownMenu: ({ children, end, ...props }: any) => {
      const { isOpen } = React.useContext(DropdownContext);
      if (!isOpen) return null;
      return <div {...props}>{children}</div>;
    },
    DropdownItem: ({ children, tag: Tag = 'button', to, href, ...props }: any) => {
      if (Tag === 'button') {
        return (
          <button type="button" {...props}>
            {children}
          </button>
        );
      }

      return (
        <Tag to={to} href={href} {...props}>
          {children}
        </Tag>
      );
    },
  };
});

const renderDropdown = (props: any = {}) =>
  render(
    <MemoryRouter>
      <QuestionTagDropdown {...props} />
    </MemoryRouter>,
  );

describe('QuestionTagDropdown', () => {
  it('renders nothing when tags is empty', () => {
    const { container } = renderDropdown({ tags: [] });

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the hashtag button when tags are present', () => {
    renderDropdown({ tags: ['governance'] });

    expect(screen.getByRole('button', { name: /show question tags/i })).toBeInTheDocument();
    expect(document.querySelector('svg[data-icon="hashtag"]')).not.toBeNull();
  });

  it('shows tag links in the dropdown', () => {
    renderDropdown({ tags: ['governance', 'AI Policy'] });

    fireEvent.click(screen.getByRole('button', { name: /show question tags/i }));

    expect(screen.getByRole('link', { name: '#governance' })).toHaveAttribute('href', '/tag/governance');
    expect(screen.getByRole('link', { name: '#AI Policy' })).toHaveAttribute('href', '/tag/AI%20Policy');
  });

  it('calls onTagSelect and keeps tag items as buttons when modal mode is enabled', () => {
    const onTagSelect = jest.fn();
    renderDropdown({ tags: ['governance', 'AI Policy'], onTagSelect });

    fireEvent.click(screen.getByRole('button', { name: /show question tags/i }));
    fireEvent.click(screen.getByRole('button', { name: '#governance' }));

    expect(onTagSelect).toHaveBeenCalledWith('governance');
    expect(screen.queryByRole('link', { name: '#governance' })).not.toBeInTheDocument();
  });

  it('preserves explicit session pins in tag links', () => {
    renderDropdown({ tags: ['governance'], sessionSlug: 'edge' });

    fireEvent.click(screen.getByRole('button', { name: /show question tags/i }));

    expect(screen.getByRole('link', { name: '#governance' })).toHaveAttribute('href', '/tag/governance?session=edge');
  });

  it('keeps tag routes aligned with PUBLIC_URL subpath hosting when no explicit baseUrl is provided', () => {
    const mutableEnv = process.env as Record<string, string | undefined>;
    const priorPublicUrl = mutableEnv.PUBLIC_URL;
    mutableEnv.PUBLIC_URL = '/ce/';

    try {
      renderDropdown({ tags: ['governance'], sessionSlug: 'edge' });

      fireEvent.click(screen.getByRole('button', { name: /show question tags/i }));

      expect(screen.getByRole('link', { name: '#governance' })).toHaveAttribute(
        'href',
        '/ce/tag/governance?session=edge',
      );
      expect(buildTagPagePath(['governance', 'AI Policy'])).toBe('/ce/tag/governance+AI%20Policy');
      expect(buildTagPagePath([])).toBe('/ce/questions');
    } finally {
      if (priorPublicUrl === undefined) delete mutableEnv.PUBLIC_URL;
      else mutableEnv.PUBLIC_URL = priorPublicUrl;
    }
  });
});
