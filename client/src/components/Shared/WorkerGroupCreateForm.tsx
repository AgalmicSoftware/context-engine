import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEraser, faPlus, faTimes } from '@fortawesome/free-solid-svg-icons';
import type {
  WorkerGroupJoinMode,
  WorkerGroupMemberVisibility,
} from '../../domains/worker/workerGroupPorts';
import { validateWorkerGroupImageFile } from '../../domains/worker/workerGroupImageUpload';
import createStyles from '../SBTs/CreateSBTGroup.module.scss';
import CompactImageChooser from './CompactImageChooser';
import { readCompactImageClipboard } from './compactImageClipboard';
import styles from './WorkerGroupCreateForm.module.scss';

type WorkerGroupCreateFormProps = {
  busy: boolean;
  description: string;
  imageUrl: string;
  label: string;
  tags?: string[];
  documentURLs?: string[];
  memberLimit?: string;
  joinEndsAt?: string;
  adminAddress?: string;
  adminAddressReadOnly?: boolean;
  sessionName?: string;
  sessionSlug: string;
  status?: string;
  submitTestId: string;
  labelTestId: string;
  descriptionTestId: string;
  imageTestId: string;
  joinMode?: WorkerGroupJoinMode;
  joinModeTestId?: string;
  memberVisibility?: WorkerGroupMemberVisibility;
  memberVisibilityTestId?: string;
  participantDefaults?: boolean;
  onDescriptionChange: (value: string) => void;
  onDocumentURLsChange?: (value: string[]) => void;
  onImageFileUpload?: (file: Blob) => Promise<string>;
  onImageUrlChange: (value: string) => void;
  onJoinEndsAtChange?: (value: string) => void;
  onJoinModeChange?: (value: WorkerGroupJoinMode) => void;
  onLabelChange: (value: string) => void;
  onMemberLimitChange?: (value: string) => void;
  onMemberVisibilityChange?: (value: WorkerGroupMemberVisibility) => void;
  onAdminAddressChange?: (value: string) => void;
  onTagsChange?: (value: string[]) => void;
  onReset: () => void;
  onSubmit: (preparedImageUrl?: string) => void;
  deferImageUpload?: boolean;
  submitDisabled?: boolean;
  submitLabel?: string;
};

type WorkerGroupCreateMessageProps = {
  actionLabel?: string;
  children: React.ReactNode;
  onAction?: () => void;
  sessionName?: string;
  sessionSlug: string;
  testId?: string;
};

const ActiveSessionContext = ({
  sessionName,
  sessionSlug,
}: {
  sessionName?: string;
  sessionSlug: string;
}) => (
  <div className={styles.sessionContext} data-testid="ce-session-worker-group-create-active-session">
    <div className={styles.sessionContextCopy}>
      <span className={styles.sessionContextLabel}>Active session</span>
      <span className={styles.sessionContextName}>{sessionName || sessionSlug}</span>
    </div>
    <span className={styles.sessionContextSlug}>/{sessionSlug}</span>
  </div>
);

export const WorkerGroupCreateMessage = ({
  actionLabel,
  children,
  onAction,
  sessionName,
  sessionSlug,
  testId = 'ce-session-worker-group-create-message',
}: WorkerGroupCreateMessageProps) => (
  <section className={createStyles.createGroupExpanded} data-testid={testId}>
    <div className={createStyles.headerContainer}>
      <div className={createStyles.titleCluster}>
        <h1 className={createStyles.createGroupTitle}>Create Group</h1>
      </div>
    </div>
    <ActiveSessionContext sessionName={sessionName} sessionSlug={sessionSlug} />
    <div className={styles.messageBody}>
      <p>{children}</p>
      {actionLabel && onAction ? (
        <button type="button" className={styles.messageAction} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  </section>
);

const WorkerGroupCreateForm = ({
  busy,
  description,
  descriptionTestId,
  deferImageUpload = false,
  imageTestId,
  imageUrl,
  tags = [],
  documentURLs = [],
  memberLimit = '',
  joinEndsAt = '',
  adminAddress = '',
  adminAddressReadOnly = false,
  joinMode = 'open',
  joinModeTestId,
  label,
  labelTestId,
  memberVisibility = 'session',
  memberVisibilityTestId,
  onDescriptionChange,
  onDocumentURLsChange,
  onImageFileUpload,
  onImageUrlChange,
  onJoinEndsAtChange,
  onJoinModeChange,
  onLabelChange,
  onMemberLimitChange,
  onMemberVisibilityChange,
  onAdminAddressChange,
  onTagsChange,
  onReset,
  onSubmit,
  participantDefaults = false,
  sessionName,
  sessionSlug,
  status = '',
  submitDisabled = false,
  submitLabel = 'Create Group',
  submitTestId,
}: WorkerGroupCreateFormProps) => {
  const [useImageUrl, setUseImageUrl] = useState(true);
  const [selectedImageFile, setSelectedImageFile] = useState<Blob | null>(null);
  const [imageStatus, setImageStatus] = useState('');
  const [imageStatusTone, setImageStatusTone] = useState<'default' | 'loading' | 'error'>('default');
  const [imageUploadBusy, setImageUploadBusy] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [documentUrlInput, setDocumentUrlInput] = useState('');
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const imageRequestIdRef = useRef(0);
  const previousImageUrlRef = useRef(imageUrl);
  const preserveSelectedFileOnUrlClearRef = useRef(false);

  const resetImage = () => {
    imageRequestIdRef.current += 1;
    setUseImageUrl(true);
    setSelectedImageFile(null);
    setImageStatus('');
    setImageStatusTone('default');
    setImageUploadBusy(false);
    setTagInput('');
    setDocumentUrlInput('');
    if (imageFileInputRef.current) imageFileInputRef.current.value = '';
    onImageUrlChange('');
  };

  useEffect(() => {
    imageRequestIdRef.current += 1;
    setUseImageUrl(true);
    setSelectedImageFile(null);
    setImageStatus('');
    setImageStatusTone('default');
    setImageUploadBusy(false);
    setTagInput('');
    setDocumentUrlInput('');
    if (imageFileInputRef.current) imageFileInputRef.current.value = '';
  }, [sessionSlug]);

  useEffect(() => {
    if (!imageUrl && previousImageUrlRef.current) {
      if (preserveSelectedFileOnUrlClearRef.current) {
        preserveSelectedFileOnUrlClearRef.current = false;
      } else {
        setSelectedImageFile(null);
        setImageStatus('');
        setImageStatusTone('default');
        if (imageFileInputRef.current) imageFileInputRef.current.value = '';
      }
    }
    previousImageUrlRef.current = imageUrl;
  }, [imageUrl]);

  const uploadImageFile = async (file: Blob | null | undefined): Promise<string> => {
    const validationError = validateWorkerGroupImageFile(file);
    if (validationError) {
      setImageStatus(validationError);
      setImageStatusTone('error');
      return '';
    }
    if (!file) return '';

    imageRequestIdRef.current += 1;
    setUseImageUrl(false);
    setSelectedImageFile(file);
    setImageUploadBusy(false);
    if (imageUrl) {
      preserveSelectedFileOnUrlClearRef.current = true;
      onImageUrlChange('');
    }
    if (deferImageUpload) {
      setImageStatus('Image ready. It will upload after you sign in.');
      setImageStatusTone('default');
      return '';
    }
    if (!onImageFileUpload) {
      setImageStatus('Image upload is unavailable for this session.');
      setImageStatusTone('error');
      return '';
    }

    const requestId = imageRequestIdRef.current + 1;
    imageRequestIdRef.current = requestId;
    setImageStatus('Uploading image…');
    setImageStatusTone('loading');
    setImageUploadBusy(true);
    try {
      const uploadedImageUrl = String(await onImageFileUpload(file)).trim();
      if (imageRequestIdRef.current !== requestId) return '';
      if (!/^https:\/\//i.test(uploadedImageUrl)) {
        throw new Error('Image upload did not return a public HTTPS URL.');
      }
      onImageUrlChange(uploadedImageUrl);
      setImageStatus('Image uploaded.');
      setImageStatusTone('default');
      return uploadedImageUrl;
    } catch (error) {
      if (imageRequestIdRef.current !== requestId) return '';
      setImageStatus(error instanceof Error ? error.message : 'Image upload failed.');
      setImageStatusTone('error');
      return '';
    } finally {
      if (imageRequestIdRef.current === requestId) setImageUploadBusy(false);
    }
  };

  const pasteImage = async () => {
    const clipboardResult = await readCompactImageClipboard({
      fileNamePrefix: 'clipboard-worker-group-image',
    });
    if (clipboardResult.kind === 'file' && clipboardResult.file) {
      await uploadImageFile(clipboardResult.file);
      return;
    }
    if (clipboardResult.kind === 'text') {
      const pastedUrl = String(clipboardResult.text || '').trim();
      if (!/^https:\/\//i.test(pastedUrl)) {
        setImageStatus('Use a public HTTPS image URL.');
        setImageStatusTone('error');
        return;
      }
      imageRequestIdRef.current += 1;
      setUseImageUrl(true);
      setSelectedImageFile(null);
      setImageStatus('');
      setImageStatusTone('default');
      onImageUrlChange(pastedUrl);
      return;
    }
    setImageStatus(clipboardResult.error || 'Clipboard does not contain a supported image or URL.');
    setImageStatusTone('error');
  };

  const updateImageUrl = (value: string) => {
    imageRequestIdRef.current += 1;
    setUseImageUrl(true);
    setSelectedImageFile(null);
    setImageUploadBusy(false);
    if (value && !/^https:\/\//i.test(value.trim())) {
      setImageStatus('Use a public HTTPS image URL.');
      setImageStatusTone('error');
    } else {
      setImageStatus('');
      setImageStatusTone('default');
    }
    onImageUrlChange(value);
  };

  const addTag = () => {
    const next = tagInput.trim();
    if (!next || next.length > 64 || tags.length >= 20) return;
    if (!tags.some((tag) => tag.toLowerCase() === next.toLowerCase())) onTagsChange?.([...tags, next]);
    setTagInput('');
  };

  const addDocumentUrl = () => {
    const next = documentUrlInput.trim();
    if (!/^https:\/\//i.test(next) || documentURLs.length >= 10) return;
    if (!documentURLs.includes(next)) onDocumentURLsChange?.([...documentURLs, next]);
    setDocumentUrlInput('');
  };

  const hasDraft = Boolean(
    label ||
      description ||
      imageUrl ||
      selectedImageFile ||
      tags.length ||
      documentURLs.length ||
      memberLimit ||
      joinEndsAt ||
      adminAddress,
  );
  const imageUrlInvalid = Boolean(imageUrl.trim() && !/^https:\/\//i.test(imageUrl.trim()));
  const imageSelectionPending = Boolean(selectedImageFile && !imageUrl.trim());
  const memberLimitNumber = Number(memberLimit);
  const memberLimitInvalid = Boolean(
    memberLimit.trim() &&
      (!Number.isSafeInteger(memberLimitNumber) || memberLimitNumber < 1 || memberLimitNumber > 1000),
  );
  const joinEndsAtTime = joinEndsAt ? new Date(joinEndsAt).getTime() : 0;
  const joinEndsAtInvalid = Boolean(joinEndsAt && (!Number.isFinite(joinEndsAtTime) || joinEndsAtTime <= Date.now()));
  const adminAddressInvalid = Boolean(adminAddress.trim() && !/^0x[0-9a-fA-F]{40}$/.test(adminAddress.trim()));
  const submitForm = async () => {
    if (selectedImageFile && !imageUrl.trim()) {
      if (deferImageUpload) {
        onSubmit();
        return;
      }
      const uploadedImageUrl = await uploadImageFile(selectedImageFile);
      if (!uploadedImageUrl) return;
      onSubmit(uploadedImageUrl);
      return;
    }
    onSubmit(imageUrl.trim() || undefined);
  };

  return (
    <section className={createStyles.createGroupExpanded} data-testid="ce-session-worker-group-create">
      <div className={createStyles.headerContainer}>
        <div className={createStyles.titleCluster}>
          <h1 className={createStyles.createGroupTitle}>Create Group</h1>
        </div>
        {hasDraft ? (
          <button
            type="button"
            className={createStyles.clearFormButton}
            disabled={busy || imageUploadBusy}
            onClick={() => {
              resetImage();
              onReset();
            }}
          >
            <FontAwesomeIcon icon={faEraser} /> Clear
          </button>
        ) : null}
      </div>

      <ActiveSessionContext sessionName={sessionName} sessionSlug={sessionSlug} />

      <div className={createStyles.collapsibleSection}>
        <div className={createStyles.inputColumn}>
          <h2 className={styles.sectionHeading}>Info</h2>
          <div className={styles.infoGrid}>
            <div className={styles.fieldStack}>
              <div className={styles.field}>
                <label htmlFor={`${labelTestId}-input`}>Group name</label>
                <input
                  id={`${labelTestId}-input`}
                  type="text"
                  value={label}
                  maxLength={120}
                  placeholder="Name"
                  data-testid={labelTestId}
                  onChange={(event) => onLabelChange(event.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor={`${descriptionTestId}-input`}>Description</label>
                <textarea
                  id={`${descriptionTestId}-input`}
                  value={description}
                  maxLength={500}
                  rows={4}
                  placeholder="Event / Group Description"
                  data-testid={descriptionTestId}
                  onChange={(event) => onDescriptionChange(event.target.value)}
                />
              </div>
            </div>

            <div className={styles.imageColumn}>
              <span className={styles.imageLabel}>Image</span>
              <CompactImageChooser
                rootTestId={`${imageTestId}-chooser`}
                isUrlMode={useImageUrl}
                isUploadMode={!useImageUrl}
                showUrlInput={useImageUrl}
                urlValue={imageUrl}
                urlInputName="workerGroupImageUrl"
                urlInputType="url"
                urlMaxLength={2048}
                onUrlChange={(event) => updateImageUrl(event.target.value)}
                onToggleUrlMode={() => {
                  imageRequestIdRef.current += 1;
                  setUseImageUrl(true);
                  setSelectedImageFile(null);
                  setImageStatus('');
                  setImageStatusTone('default');
                }}
                onPaste={() => void pasteImage()}
                onUploadClick={() => {
                  setUseImageUrl(false);
                  setImageStatus('');
                  setImageStatusTone('default');
                  imageFileInputRef.current?.click();
                }}
                onFileChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  void uploadImageFile(file);
                }}
                fileInputRef={imageFileInputRef}
                fileInputTestId={`${imageTestId}-file`}
                pasteButtonTestId={`${imageTestId}-paste`}
                uploadButtonTestId={`${imageTestId}-upload`}
                urlButtonTestId={`${imageTestId}-url-mode`}
                urlInputTestId={imageTestId}
                urlPlaceholder="Paste image URL"
                urlInputAriaLabel="Image URL"
                selectedFileLabel={
                  selectedImageFile
                    ? String((selectedImageFile as File).name || 'Pasted image')
                    : ''
                }
                previewFile={selectedImageFile}
                previewSrc={selectedImageFile ? '' : imageUrl}
                previewAlt="Group artwork preview"
                onClear={resetImage}
                statusText={imageStatus}
                statusTone={imageStatusTone}
                helpText="Paste a public HTTPS URL, paste an image, or upload a PNG, JPEG, GIF, or WebP file up to 10 MB."
                disabled={busy || imageUploadBusy}
              />
            </div>
          </div>
          <div className={styles.metadataGrid}>
            <div className={styles.metadataCard}>
              <label htmlFor={`${labelTestId}-document-url`}>Reference URLs</label>
              <div className={styles.inlineInputRow}>
                <input
                  id={`${labelTestId}-document-url`}
                  type="url"
                  value={documentUrlInput}
                  maxLength={2048}
                  placeholder="https://…"
                  aria-label="Reference URL"
                  onChange={(event) => setDocumentUrlInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addDocumentUrl();
                    }
                  }}
                />
                <button
                  type="button"
                  aria-label="Add reference URL"
                  disabled={!/^https:\/\//i.test(documentUrlInput.trim()) || documentURLs.length >= 10}
                  onClick={addDocumentUrl}
                >
                  <FontAwesomeIcon icon={faPlus} />
                </button>
              </div>
              <div className={styles.pillList}>
                {documentURLs.map((url) => (
                  <span key={url} className={styles.urlPill}>
                    <span>{url}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${url}`}
                      onClick={() => onDocumentURLsChange?.(documentURLs.filter((candidate) => candidate !== url))}
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </span>
                ))}
              </div>
              <span className={styles.formHelp}>Add up to 10 public HTTPS references.</span>
            </div>

            <div className={styles.metadataCard}>
              <label htmlFor={`${labelTestId}-tag`}>Tags</label>
              <div className={styles.inlineInputRow}>
                <input
                  id={`${labelTestId}-tag`}
                  type="text"
                  value={tagInput}
                  maxLength={64}
                  placeholder="Add tag…"
                  aria-label="Tag"
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addTag();
                    }
                  }}
                />
                <button type="button" aria-label="Add tag" disabled={!tagInput.trim() || tags.length >= 20} onClick={addTag}>
                  <FontAwesomeIcon icon={faPlus} />
                </button>
              </div>
              <div className={styles.pillList}>
                {tags.map((tag) => (
                  <span key={tag} className={styles.tagPill}>
                    {tag}
                    <button
                      type="button"
                      aria-label={`Remove ${tag}`}
                      onClick={() => onTagsChange?.(tags.filter((candidate) => candidate !== tag))}
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </span>
                ))}
              </div>
              <span className={styles.formHelp}>Add up to 20 tags.</span>
            </div>
          </div>
        </div>
      </div>

      <div className={createStyles.collapsibleSection}>
        <div>
          <h2 className={styles.sectionHeading}>Membership options</h2>
          <div className={styles.accessStack}>
            <div className={styles.accessRow}>
              <div className={styles.accessCopy}>
                <span className={styles.accessLabel}>Member limit</span>
                <span className={styles.accessHelp}>
                  Optional maximum membership—the Worker equivalent of a token supply limit.
                </span>
              </div>
              <input
                className={styles.accessInput}
                type="number"
                min="1"
                max="1000"
                step="1"
                value={memberLimit}
                placeholder="Unlimited"
                aria-label="Member limit"
                onChange={(event) => onMemberLimitChange?.(event.target.value)}
              />
            </div>

            <div className={styles.accessRow}>
              <div className={styles.accessCopy}>
                <span className={styles.accessLabel}>Join deadline</span>
                <span className={styles.accessHelp}>Optional end time for participant self-join.</span>
              </div>
              <input
                className={styles.accessInput}
                type="datetime-local"
                value={joinEndsAt}
                aria-label="Join deadline"
                onChange={(event) => onJoinEndsAtChange?.(event.target.value)}
              />
            </div>

            <div className={styles.accessRow}>
              <div className={styles.accessCopy}>
                <span className={styles.accessLabel}>Group admin address</span>
                <span className={styles.accessHelp}>
                  {adminAddressReadOnly
                    ? 'This signed participant will be recorded as the group administrator.'
                    : 'Identifies the EVM address responsible for this group. Session admins retain control.'}
                </span>
              </div>
              <input
                className={styles.accessInput}
                type="text"
                value={adminAddress}
                maxLength={42}
                placeholder="0x…"
                aria-label="Group admin address"
                readOnly={adminAddressReadOnly}
                onChange={(event) => onAdminAddressChange?.(event.target.value)}
              />
            </div>

            <div className={styles.accessRow}>
              <div className={styles.accessCopy}>
                <span className={styles.accessLabel}>Who can join</span>
                <span className={styles.accessHelp}>
                  {participantDefaults
                    ? 'Participant-created groups use this session’s configured open-join behavior.'
                    : 'Choose whether participants join themselves or are added by an admin.'}
                </span>
              </div>
              {participantDefaults ? (
                <span className={styles.fixedValue}>Open to participants</span>
              ) : (
                <select
                  className={styles.accessSelect}
                  value={joinMode}
                  aria-label="Who can join"
                  data-testid={joinModeTestId}
                  onChange={(event) => onJoinModeChange?.(event.target.value as WorkerGroupJoinMode)}
                >
                  <option value="admin_add">Admin adds members</option>
                  <option value="open">Open self-join</option>
                </select>
              )}
            </div>

            <div className={styles.accessRow}>
              <div className={styles.accessCopy}>
                <span className={styles.accessLabel}>Who can see members</span>
                <span className={styles.accessHelp}>
                  {participantDefaults
                    ? 'Participant-created groups are visible to authenticated session participants.'
                    : 'Choose the audience that can view this group’s membership.'}
                </span>
              </div>
              {participantDefaults ? (
                <span className={styles.fixedValue}>Session participants</span>
              ) : (
                <select
                  className={styles.accessSelect}
                  value={memberVisibility}
                  aria-label="Who can see members"
                  data-testid={memberVisibilityTestId}
                  onChange={(event) =>
                    onMemberVisibilityChange?.(event.target.value as WorkerGroupMemberVisibility)
                  }
                >
                  <option value="admin_only">Admins only</option>
                  <option value="members">Group members</option>
                  <option value="session">All session members</option>
                </select>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={createStyles.mintingSteps}>
        <button
          type="button"
          className={createStyles.primaryCreateButton}
          data-testid={submitTestId}
          disabled={
            busy ||
            imageUploadBusy ||
            imageUrlInvalid ||
            (imageSelectionPending && !deferImageUpload && !onImageFileUpload) ||
            memberLimitInvalid ||
            joinEndsAtInvalid ||
            adminAddressInvalid ||
            submitDisabled
          }
          onClick={() => void submitForm()}
        >
          <span className={createStyles.primaryCreateButtonContent}>
            {imageUploadBusy ? 'Uploading image…' : busy ? 'Creating…' : submitLabel}
          </span>
        </button>
      </div>

      {status ? (
        <div role="status" className={styles.status}>
          {status}
        </div>
      ) : null}
    </section>
  );
};

export default WorkerGroupCreateForm;
