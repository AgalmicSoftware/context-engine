import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SurveyQuestionTagControl from './SurveyQuestionTagControl';

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
    DropdownItem: ({ children, tag: Tag = 'button', ...props }: any) => {
      if (Tag === 'button') {
        return (
          <button type="button" {...props}>
            {children}
          </button>
        );
      }

      return <Tag {...props}>{children}</Tag>;
    },
  };
});

describe('SurveyQuestionTagControl', () => {
  it('renders nothing when no display tags are available', () => {
    const { container } = render(<SurveyQuestionTagControl tags={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('wraps the dropdown row and forwards modal tag selection when requested', () => {
    const onTagSelect = jest.fn();
    const { container } = render(
      <SurveyQuestionTagControl
        tags={['governance']}
        sessionSlug="edge"
        useTagModal
        onTagSelect={onTagSelect}
        rowStyle={{ marginTop: '4px' }}
      />,
    );

    const row = container.firstElementChild as HTMLElement | null;
    expect(row?.style.marginTop).toBe('4px');

    fireEvent.click(screen.getByRole('button', { name: /show question tags/i }));
    fireEvent.click(screen.getByRole('button', { name: '#governance' }));

    expect(onTagSelect).toHaveBeenCalledWith('governance');
  });
});
