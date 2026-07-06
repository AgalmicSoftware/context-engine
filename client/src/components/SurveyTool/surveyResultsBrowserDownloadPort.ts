export type SurveyResultsBrowserDownloadRequest = {
  fileContent: string;
  filename: string;
  mimeType: string;
};

export const runSurveyResultsBrowserDownload = ({
  fileContent,
  filename,
  mimeType,
}: SurveyResultsBrowserDownloadRequest): void => {
  const blob = new Blob([fileContent], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.setAttribute('hidden', '');
  anchor.setAttribute('href', url);
  anchor.setAttribute('download', filename);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};
