import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readCompactImageClipboard } from './compactImageClipboard';
import WorkerGroupCreateForm from './WorkerGroupCreateForm';

jest.mock('./compactImageClipboard', () => ({
  readCompactImageClipboard: jest.fn(),
}));

const mockReadCompactImageClipboard = readCompactImageClipboard as jest.MockedFunction<
  typeof readCompactImageClipboard
>;

const Harness = ({
  deferImageUpload = false,
  onImageFileUpload = async () => 'https://demo-sh-worker.example/storage/read?id=cf_group_image',
  onSubmit = () => {},
  submitLabel,
}: {
  deferImageUpload?: boolean;
  onImageFileUpload?: (file: Blob) => Promise<string>;
  onSubmit?: (preparedImageUrl?: string) => void;
  submitLabel?: string;
}) => {
  const [imageUrl, setImageUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [documentURLs, setDocumentURLs] = useState<string[]>([]);
  const [memberLimit, setMemberLimit] = useState('');
  const [joinEndsAt, setJoinEndsAt] = useState('');
  const [adminAddress, setAdminAddress] = useState('');
  return (
    <WorkerGroupCreateForm
      busy={false}
      description=""
      descriptionTestId="description"
      deferImageUpload={deferImageUpload}
      imageTestId="image"
      imageUrl={imageUrl}
      tags={tags}
      documentURLs={documentURLs}
      memberLimit={memberLimit}
      joinEndsAt={joinEndsAt}
      adminAddress={adminAddress}
      label=""
      labelTestId="label"
      sessionName="Demo Session"
      sessionSlug="demo-sh"
      submitTestId="submit"
      submitLabel={submitLabel}
      onDescriptionChange={() => {}}
      onDocumentURLsChange={setDocumentURLs}
      onImageFileUpload={onImageFileUpload}
      onImageUrlChange={setImageUrl}
      onJoinEndsAtChange={setJoinEndsAt}
      onLabelChange={() => {}}
      onMemberLimitChange={setMemberLimit}
      onAdminAddressChange={setAdminAddress}
      onTagsChange={setTags}
      onReset={() => {
        setImageUrl('');
        setTags([]);
        setDocumentURLs([]);
        setMemberLimit('');
        setJoinEndsAt('');
        setAdminAddress('');
      }}
      onSubmit={onSubmit}
    />
  );
};

describe('WorkerGroupCreateForm image chooser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('offers URL, Paste, and Upload modes while preserving the HTTPS metadata limit', () => {
    render(<Harness />);

    expect(screen.getByRole('button', { name: 'URL' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paste' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload image' })).toBeInTheDocument();
    expect(screen.getByLabelText('Image URL')).toHaveAttribute('type', 'url');
    expect(screen.getByLabelText('Image URL')).toHaveAttribute('maxlength', '2048');

    fireEvent.change(screen.getByLabelText('Image URL'), {
      target: { value: 'http://images.example/group.png' },
    });
    expect(screen.getByText('Use a public HTTPS image URL.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Group' })).toBeDisabled();
  });

  it('uploads a selected image before enabling group creation and retains the resulting URL', async () => {
    let finishUpload: (value: string) => void = () => {};
    const onImageFileUpload = jest.fn(
      (_file: Blob) =>
        new Promise<string>((resolve) => {
          finishUpload = resolve;
        }),
    );
    render(<Harness onImageFileUpload={onImageFileUpload} />);
    const file = new File(['image'], 'group.png', { type: 'image/png' });

    fireEvent.change(screen.getByTestId('image-file'), {
      target: { files: [file] },
    });

    expect(onImageFileUpload).toHaveBeenCalledWith(file);
    expect(screen.getByRole('button', { name: 'Uploading image…' })).toBeDisabled();

    finishUpload('https://demo-sh-worker.example/storage/read?id=cf_group_image');
    expect(await screen.findByText('Image uploaded.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'URL' }));
    expect(screen.getByLabelText('Image URL')).toHaveValue(
      'https://demo-sh-worker.example/storage/read?id=cf_group_image',
    );
    expect(screen.getByRole('button', { name: 'Create Group' })).toBeEnabled();
  });

  it('keeps a selected image local until the final sign-in action', () => {
    const onImageFileUpload = jest.fn(async () => 'https://demo-sh-worker.example/storage/read?id=unused');
    const onSubmit = jest.fn();
    render(
      <Harness
        deferImageUpload={true}
        onImageFileUpload={onImageFileUpload}
        onSubmit={onSubmit}
        submitLabel="Sign in & create"
      />,
    );
    const file = new File(['image'], 'group.png', { type: 'image/png' });

    fireEvent.change(screen.getByTestId('image-file'), {
      target: { files: [file] },
    });

    expect(onImageFileUpload).not.toHaveBeenCalled();
    expect(screen.getByText('Image ready. It will upload after you sign in.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in & create' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]).toEqual([]);
  });

  it('pastes an HTTPS URL into URL mode and rejects an HTTP clipboard URL', async () => {
    mockReadCompactImageClipboard.mockResolvedValueOnce({
      kind: 'text',
      text: 'https://images.example/group.png',
    });
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Paste' }));
    await waitFor(() => expect(screen.getByLabelText('Image URL')).toHaveValue('https://images.example/group.png'));

    mockReadCompactImageClipboard.mockResolvedValueOnce({
      kind: 'text',
      text: 'http://images.example/group.png',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Paste' }));
    expect(await screen.findByText('Use a public HTTPS image URL.')).toBeInTheDocument();
    expect(screen.getByLabelText('Image URL')).toHaveValue('https://images.example/group.png');
  });

  it('reuses the SBT-style metadata and limit controls with Worker-native labels', () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText('Tag'), { target: { value: 'reviewers' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    expect(screen.getByText('reviewers')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Reference URL'), {
      target: { value: 'https://docs.example.test/brief' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add reference URL' }));
    expect(screen.getByText('https://docs.example.test/brief')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Member limit'), { target: { value: '1001' } });
    expect(screen.getByRole('button', { name: 'Create Group' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Member limit'), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText('Group admin address'), { target: { value: 'not-an-address' } });
    expect(screen.getByRole('button', { name: 'Create Group' })).toBeDisabled();
  });
});
